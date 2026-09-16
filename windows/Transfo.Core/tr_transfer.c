/* tr_transfer.c - async chunked/resumable transfer engine.
 * Upload: local file -> server session (256 KiB base64 chunks, offset-aligned
 * resume). Download: pull a server session's assembled file to disk.
 * All work runs on background threads; progress is delivered via callbacks. */
#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <sys/stat.h>
#include "transfo_internal.h"
#include "transfo.h"
#include "vendor/cJSON.h"

#define TRC_TRANSFER_MAX  64
#define TRC_XFER_BUF      (TRC_DEFAULT_CHUNK + 8)

/* phase constants (must match header docs) */
#define TRC_PH_STARTED   0
#define TRC_PH_PROGRESS  1
#define TRC_PH_DONE      2
#define TRC_PH_CANCELED  3
#define TRC_PH_FAILED    4

typedef struct XferRow {
    uint64_t handle;             /* 1 + slot index */
    int used;
    volatile LONG cancel;
    HANDLE thread;
    CRITICAL_SECTION lock;
    int kind;                    /* 0 upload, 1 download */
    int phase;
    long long transferred;
    long long total;
    char sessionId[TRC_ID_MAX];
    char fileName[TRC_NAME_MAX];
    char baseUrl[1024];
    char token[2048];
    char path[1024];             /* source (upload) or dest (download) */
    int resume;
    TrcTransferCb cb;
    void* user;
    char error[TRC_ERR_MAX];
} XferRow;

static CRITICAL_SECTION g_lock;
static XferRow g_rows[TRC_TRANSFER_MAX];
static int g_xfer_inited = 0;

static void xlock(XferRow* r) { EnterCriticalSection(&r->lock); }
static void xunlock(XferRow* r) { LeaveCriticalSection(&r->lock); }

static XferRow* find_row(uint64_t handle, int* outIdx) {
    int idx = (int)handle - 1;
    if (idx < 0 || idx >= TRC_TRANSFER_MAX) return NULL;
    EnterCriticalSection(&g_lock);
    XferRow* r = &g_rows[idx];
    if (!r->used) { LeaveCriticalSection(&g_lock); return NULL; }
    *outIdx = idx;
    LeaveCriticalSection(&g_lock);
    return r;
}

static void report(XferRow* r, int phase, const char* sessionId, long long transferred,
                   long long total, const char* err) {
    xlock(r);
    r->phase = phase;
    r->transferred = transferred;
    r->total = total;
    if (err) {
        strncpy(r->error, err, sizeof r->error - 1);
        r->error[sizeof r->error - 1] = '\0';
    }
    xunlock(r);
    if (r->cb) r->cb(r->handle, phase, sessionId, r->fileName,
                     transferred, total, err, r->user);
}

/* ---- json response helpers ------------------------------------------- */

static char* obj_str(cJSON* root, const char* key) {
    const cJSON* v = cJSON_GetObjectItemCaseSensitive(root, key);
    return (v && cJSON_IsString(v) && v->valuestring) ? v->valuestring : NULL;
}
static long long obj_i64(cJSON* root, const char* key) {
    const cJSON* v = cJSON_GetObjectItemCaseSensitive(root, key);
    return (v && cJSON_IsNumber(v)) ? (long long)v->valuedouble : 0;
}
static int obj_bool(cJSON* root, const char* key) {
    const cJSON* v = cJSON_GetObjectItemCaseSensitive(root, key);
    return (v && cJSON_IsBool(v)) ? cJSON_IsTrue(v) : 0;
}

/* Truncate a possibly-long server error payload into the caller's buffer. */
static void extract_error(const char* body, char* out, size_t cap) {
    out[0] = '\0';
    if (!body) return;
    cJSON* j = cJSON_Parse(body);
    if (j) {
        const char* e = obj_str(j, "error");
        if (e) { snprintf(out, cap, "%s", e); cJSON_Delete(j); return; }
        cJSON_Delete(j);
    }
    snprintf(out, cap, "%.*s", (int)cap - 1, body);
}

/* ---- HTTP against the server ----------------------------------------- */

static int api_get(const XferRow* r, const char* url, int* status, cJSON** out) {
    char* body = NULL;
    int rc = trc_http_get(url, r->token, &body, status);
    if (rc != 0) return -1;
    *out = body ? cJSON_Parse(body) : NULL;
    trc_free(body);
    if (!*out) { trc_error_set("invalid JSON from server"); return -1; }
    return 0;
}

static int api_post(const XferRow* r, const char* url, const char* json,
                    int* status, cJSON** out) {
    char* body = NULL;
    int rc = trc_http_post(url, r->token, json, &body, status);
    if (rc != 0) return -1;
    *out = body ? cJSON_Parse(body) : NULL;
    trc_free(body);
    if (!*out) { trc_error_set("invalid JSON from server"); return -1; }
    return 0;
}

/* ---- upload worker ---------------------------------------------------- */

static int create_or_resume_session(XferRow* r, long long fileSize, cJSON** outSession) {
    char url[1536];
    int status = 0;
    cJSON* j = NULL;

    if (r->resume) {
        snprintf(url, sizeof url, "%s/api/transfer/sessions", r->baseUrl);
        if (api_get(r, url, &status, &j) != 0) return -1;
        if (status == 200) {
            if (!cJSON_IsArray(j)) { cJSON_Delete(j); return -1; }
            const char* want = r->fileName;
            cJSON* hit = NULL;
            int n = cJSON_GetArraySize(j);
            for (int i = 0; i < n; ++i) {
                cJSON* item = cJSON_GetArrayItem(j, i);
                const char* nm = obj_str(item, "name");
                if (!nm) continue;
                long long sz = obj_i64(item, "size");
                if (strcmp(nm, want) == 0 && sz == fileSize) { hit = item; break; }
            }
            if (hit) {
                const char* sid = obj_str(hit, "id");
                if (!sid) { cJSON_Delete(j); return -1; }
                /* fetch precise chunkSize + received */
                cJSON* det = NULL;
                snprintf(url, sizeof url, "%s/api/transfer/sessions/%s", r->baseUrl, sid);
                if (api_get(r, url, &status, &det) != 0) { cJSON_Delete(j); return -1; }
                if (status != 200) { cJSON_Delete(det); cJSON_Delete(j); return -1; }
                cJSON* out = cJSON_Duplicate(det, 1);
                snprintf(r->sessionId, sizeof r->sessionId, "%s", sid);
                cJSON_Delete(det);
                cJSON_Delete(j);
                *outSession = out;
                return 0;
            }
        }
        cJSON_Delete(j);
    }

    /* create new session */
    cJSON* body = cJSON_CreateObject();
    cJSON_AddStringToObject(body, "name", r->fileName);
    cJSON_AddNumberToObject(body, "size", (double)fileSize);
    cJSON_AddStringToObject(body, "type", "file");
    cJSON_AddNumberToObject(body, "chunkSize", (double)TRC_DEFAULT_CHUNK);
    char* text = cJSON_PrintUnformatted(body);
    cJSON_Delete(body);
    if (!text) return -1;

    snprintf(url, sizeof url, "%s/api/transfer/sessions", r->baseUrl);
    if (api_post(r, url, text, &status, &j) != 0) { free(text); return -1; }
    free(text);
    if (status != 201) {
        char e[TRC_ERR_MAX];
        extract_error(j ? cJSON_PrintUnformatted(j) : NULL, e, sizeof e);
        trc_error_set("session create failed (HTTP %d): %s", status, e);
        cJSON_Delete(j);
        return -1;
    }
    const char* sid = obj_str(j, "id");
    if (!sid) { cJSON_Delete(j); trc_error_set("session create missing id"); return -1; }
    snprintf(r->sessionId, sizeof r->sessionId, "%s", sid);
    *outSession = j;
    return 0;
}

static DWORD WINAPI upload_worker(LPVOID arg) {
    XferRow* r = (XferRow*)arg;

    wchar_t* wpath = trc_utf8_to_wide(r->path);
    HANDLE h = wpath ? CreateFileW(wpath, GENERIC_READ,
                                   FILE_SHARE_READ | FILE_SHARE_WRITE,
                                   NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL)
                     : INVALID_HANDLE_VALUE;
    free(wpath);
    if (h == INVALID_HANDLE_VALUE) {
        report(r, TRC_PH_FAILED, NULL, 0, 0, "cannot open source file");
        return 0;
    }
    LARGE_INTEGER sz;
    if (!GetFileSizeEx(h, &sz) || sz.QuadPart < 0) {
        CloseHandle(h);
        report(r, TRC_PH_FAILED, NULL, 0, 0, "cannot stat source file");
        return 0;
    }
    long long fileSize = sz.QuadPart;
    r->total = fileSize;

    cJSON* sess = NULL;
    if (create_or_resume_session(r, fileSize, &sess) != 0) {
        CloseHandle(h);
        report(r, TRC_PH_FAILED, NULL, 0, 0, trc_last_error());
        return 0;
    }
    long long chunkSize = obj_i64(sess, "chunkSize");
    if (chunkSize <= 0) chunkSize = TRC_DEFAULT_CHUNK;
    long long received = obj_i64(sess, "received");
    /* alalign resume cursor to a chunk boundary */
    long long offset = (received / chunkSize) * chunkSize;
    cJSON_Delete(sess);

    report(r, TRC_PH_STARTED, r->sessionId, offset, fileSize, NULL);

    char* b64 = (char*)malloc(trc_base64_encoded_len((size_t)chunkSize));
    unsigned char* buf = (unsigned char*)malloc((size_t)chunkSize);
    if (!b64 || !buf) {
        free(b64); free(buf); CloseHandle(h);
        report(r, TRC_PH_FAILED, r->sessionId, offset, fileSize, "out of memory");
        return 0;
    }

    int result = 0; /* 0 running, 1 done, 2 canceled, -1 failed */
    int reconnectRetries = 0;
    if (offset > 0) {
        LARGE_INTEGER pos;
        pos.QuadPart = offset;
        SetFilePointerEx(h, pos, NULL, FILE_BEGIN);
    }

    char url[1536];
    while (offset < fileSize && !InterlockedCompareExchange(&r->cancel, 0, 0)) {
        /* read next chunk */
        DWORD want = (DWORD)((fileSize - offset) < chunkSize ? (fileSize - offset) : chunkSize);
        DWORD got = 0;
        if (!ReadFile(h, buf, want, &got, NULL) || got == 0) {
            report(r, TRC_PH_FAILED, r->sessionId, offset, fileSize, "read failed");
            result = -1;
            break;
        }
        size_t b64len = trc_base64_encoded_len(got);
        (void)b64len;
        trc_base64_encode(buf, got, b64);

        /* POST chunk */
        cJSON* body = cJSON_CreateObject();
        cJSON_AddNumberToObject(body, "index", (double)(offset / chunkSize));
        cJSON_AddNumberToObject(body, "offset", (double)offset);
        cJSON_AddStringToObject(body, "data", b64);
        char* text = cJSON_PrintUnformatted(body);
        cJSON_Delete(body);
        if (!text) { result = -1; break; }

        snprintf(url, sizeof url, "%s/api/transfer/sessions/%s/chunk", r->baseUrl, r->sessionId);
        int status = 0;
        char* rbody = NULL;
        int rc = trc_http_post(url, r->token, text, &rbody, &status);
        free(text);
        if (rc != 0) {
            free(rbody);
            if (InterlockedCompareExchange(&r->cancel, 0, 0)) { result = 2; break; }
            if (++reconnectRetries > 4) { report(r, TRC_PH_FAILED, r->sessionId, offset, fileSize, trc_last_error()); result = -1; break; }
            Sleep(300); /* transient — retry same chunk */
            continue;
        }
        reconnectRetries = 0;
        if (status == 200) {
            cJSON* j = cJSON_Parse(rbody ? rbody : "");
            long long adv = (j && obj_i64(j, "received")) ? obj_i64(j, "received") : offset + got;
            cJSON_Delete(j);
            offset = adv;
            if (offset < 0) offset = fileSize; /* safety */
            /* progress at ~1 MB granularity or at the end */
            if ((offset - (long long)r->transferred) >= (1024 * 1024) || offset >= fileSize) {
                report(r, TRC_PH_PROGRESS, r->sessionId, offset, fileSize, NULL);
            }
        } else if (status == 409) {
            /* de-sync: realign to the server cursor */
            cJSON* st = NULL;
            snprintf(url, sizeof url, "%s/api/transfer/sessions/%s", r->baseUrl, r->sessionId);
            int s2 = 0;
            if (api_get(r, url, &s2, &st) == 0 && s2 == 200) {
                long long recv = obj_i64(st, "received");
                cJSON_Delete(st);
                if (recv > offset) offset = recv; /* server got a retried chunk */
            } else { cJSON_Delete(st); }
            LARGE_INTEGER pos;
            pos.QuadPart = offset;
            SetFilePointerEx(h, pos, NULL, FILE_BEGIN);
            if (InterlockedCompareExchange(&r->cancel, 0, 0)) { result = 2; break; }
            continue;
        } else {
            char err[TRC_ERR_MAX];
            extract_error(rbody, err, sizeof err);
            trc_error_set("chunk rejected (HTTP %d): %s", status, err);
            report(r, TRC_PH_FAILED, r->sessionId, offset, fileSize, trc_last_error());
            result = -1;
            break;
        }
        free(rbody);
    }
    free(b64);
    free(buf);

    if (!result && InterlockedCompareExchange(&r->cancel, 0, 0)) result = 2;

    if (result == 0) {
        /* verify session finalized on the server */
        cJSON* st = NULL;
        snprintf(url, sizeof url, "%s/api/transfer/sessions/%s", r->baseUrl, r->sessionId);
        int s2 = 0;
        long long finalReceived = offset;
        int done = (offset >= fileSize);
        if (api_get(r, url, &s2, &st) == 0 && s2 == 200) {
            finalReceived = obj_i64(st, "received");
            done = obj_bool(st, "done");
            cJSON_Delete(st);
        }
        if (!done && finalReceived >= fileSize) done = 1;
        if (done) {
            report(r, TRC_PH_DONE, r->sessionId, fileSize, fileSize, NULL);
        } else {
            trc_error_set("upload finished but session not marked done (received %lld/%lld)",
                          finalReceived, fileSize);
            report(r, TRC_PH_FAILED, r->sessionId, finalReceived, fileSize, trc_last_error());
        }
    } else if (result == 2) {
        report(r, TRC_PH_CANCELED, r->sessionId, offset, fileSize, NULL);
    } else {
        report(r, TRC_PH_FAILED, r->sessionId, offset, fileSize, trc_last_error());
    }
    CloseHandle(h);
    return 0;
}

/* ---- download worker -------------------------------------------------- */

typedef struct DlCtx2 {
    XferRow* row;
    FILE* f;
    long long bytes;
    int cancelOut;   /* set when canceled mid-stream (best effort) */
} DlCtx2;

static void dl_progress(long long bytes, long long totalHint, void* user) {
    (void)totalHint;
    DlCtx2* dc = (DlCtx2*)user;
    dc->bytes = bytes;
    XferRow* r = dc->row;
    if (InterlockedCompareExchange(&r->cancel, 0, 0)) {
        dc->cancelOut = 1;
        return;
    }
    if (r->cb && (bytes - (long long)r->transferred) >= (1024 * 1024)) {
        report(r, TRC_PH_PROGRESS, r->sessionId, bytes, r->total, NULL);
    }
}

static DWORD WINAPI download_worker(LPVOID arg) {
    XferRow* r = (XferRow*)arg;
    char url[1536];

    /* size from the session (best effort) */
    int status = 0;
    cJSON* st = NULL;
    snprintf(url, sizeof url, "%s/api/transfer/sessions/%s", r->baseUrl, r->sessionId);
    if (api_get(r, url, &status, &st) == 0 && status == 200) {
        r->total = obj_i64(st, "size");
        cJSON_Delete(st);
    } else if (st) cJSON_Delete(st);

    DlCtx2 dc = {0};
    dc.row = r;

    snprintf(url, sizeof url, "%s/api/transfer/sessions/%s/pull", r->baseUrl, r->sessionId);
    int rc = trc_http_download(url, r->token, r->path, dl_progress, &dc);
    if (rc != 0) {
        if (dc.cancelOut) {
            report(r, TRC_PH_CANCELED, r->sessionId, dc.bytes, r->total, NULL);
        } else {
            report(r, TRC_PH_FAILED, r->sessionId, dc.bytes, r->total, trc_last_error());
        }
        return 0;
    }
    if (dc.cancelOut || InterlockedCompareExchange(&r->cancel, 0, 0)) {
        wchar_t* wd = trc_utf8_to_wide(r->path);
        if (wd) { _wremove(wd); free(wd); }
        report(r, TRC_PH_CANCELED, r->sessionId, dc.bytes, r->total, NULL);
        return 0;
    }

    /* successful pull: release server session */
    snprintf(url, sizeof url, "%s/api/transfer/sessions/%s", r->baseUrl, r->sessionId);
    char* rb = NULL;
    trc_http_del(url, r->token, &rb, &status);
    trc_free(rb);

    report(r, TRC_PH_DONE, r->sessionId, dc.bytes, r->total, NULL);
    return 0;
}

/* ---- public API ------------------------------------------------------- */

static int alloc_row(XferRow** out) {
    EnterCriticalSection(&g_lock);
    for (int i = 0; i < TRC_TRANSFER_MAX; ++i) {
        if (!g_rows[i].used) {
            XferRow* r = &g_rows[i];
            memset(r, 0, sizeof *r);
            r->handle = (uint64_t)(i + 1);
            r->used = 1;
            InitializeCriticalSection(&r->lock);
            *out = r;
            LeaveCriticalSection(&g_lock);
            return 0;
        }
    }
    LeaveCriticalSection(&g_lock);
    return -1;
}

static void free_row(XferRow* r) {
    DeleteCriticalSection(&r->lock);
    EnterCriticalSection(&g_lock);
    r->used = 0;
    LeaveCriticalSection(&g_lock);
}

void xfer_tbl_init(void) {
    if (g_xfer_inited) return;      /* idempotent; trc_transfer_start calls this */
    g_xfer_inited = 1;
    InitializeCriticalSection(&g_lock);
    memset(g_rows, 0, sizeof g_rows);
}

int trc_transfer_start(const char* baseUrl, const char* token, const char* filePath,
                       int resume, uint64_t* outHandle, TrcTransferCb cb, void* user) {
    xfer_tbl_init();
    XferRow* r = NULL;
    if (alloc_row(&r) != 0) { trc_error_set("no free transfer slots"); return -1; }
    strncpy(r->baseUrl, baseUrl ? baseUrl : "", sizeof r->baseUrl - 1);
    strncpy(r->token, token ? token : "", sizeof r->token - 1);
    strncpy(r->path, filePath ? filePath : "", sizeof r->path - 1);
    strncpy(r->fileName, trc_path_basename(r->path), sizeof r->fileName - 1);
    r->resume = resume ? 1 : 0;
    r->cb = cb;
    r->user = user;
    r->kind = 0;
    *outHandle = r->handle;

    /* delay reporting STARTED until session is known (worker does it) */
    r->thread = CreateThread(NULL, 0, upload_worker, r, 0, NULL);
    if (!r->thread) {
        free_row(r);
        trc_error_set("cannot create worker thread");
        return -1;
    }
    CloseHandle(r->thread); /* detached; row outlives via used flag */
    return 0;
}

int trc_download_start(const char* baseUrl, const char* token, const char* sessionId,
                       const char* name, const char* destPath, uint64_t* outHandle,
                       TrcTransferCb cb, void* user) {
    xfer_tbl_init();
    XferRow* r = NULL;
    if (alloc_row(&r) != 0) { trc_error_set("no free transfer slots"); return -1; }
    strncpy(r->baseUrl, baseUrl ? baseUrl : "", sizeof r->baseUrl - 1);
    strncpy(r->token, token ? token : "", sizeof r->token - 1);
    strncpy(r->path, destPath ? destPath : "", sizeof r->path - 1);
    strncpy(r->fileName, (name && name[0]) ? name : (trc_path_basename(r->path)),
            sizeof r->fileName - 1);
    snprintf(r->sessionId, sizeof r->sessionId, "%s", sessionId ? sessionId : "");
    r->cb = cb;
    r->user = user;
    r->kind = 1;
    *outHandle = r->handle;

    r->thread = CreateThread(NULL, 0, download_worker, r, 0, NULL);
    if (!r->thread) {
        free_row(r);
        trc_error_set("cannot create worker thread");
        return -1;
    }
    CloseHandle(r->thread);
    return 0;
}

int trc_transfer_cancel(uint64_t handle) {
    int idx = 0;
    XferRow* r = find_row(handle, &idx);
    if (!r) return -1;
    InterlockedExchange(&r->cancel, 1);
    return 0;
}

int trc_download_cancel(uint64_t handle) { return trc_transfer_cancel(handle); }

int trc_transfer_status(uint64_t handle, int* outPhase, int* outCode,
                        long long* outTransferred, long long* outTotal) {
    int idx = 0;
    XferRow* r = find_row(handle, &idx);
    if (!r) return -1;
    xlock(r);
    if (outPhase) *outPhase = r->phase;
    if (outCode) *outCode = r->phase;
    if (outTransferred) *outTransferred = r->transferred;
    if (outTotal) *outTotal = r->total;
    xunlock(r);
    return 0;
}

int trc_transfer_forget(uint64_t handle) {
    int idx = 0;
    XferRow* r = find_row(handle, &idx);
    if (!r) return -1;
    free_row(r);
    return 0;
}

void trc_shutdown(void) {
    for (int i = 0; i < TRC_TRANSFER_MAX; ++i) {
        if (g_rows[i].used) InterlockedExchange(&g_rows[i].cancel, 1);
    }
    /* brief grace for workers to notice and exit */
    for (int t = 0; t < 50; ++t) {
        int busy = 0;
        for (int i = 0; i < TRC_TRANSFER_MAX; ++i)
            if (g_rows[i].used) { busy = 1; break; }
        if (!busy) break;
        Sleep(100);
    }
    for (int i = 0; i < TRC_TRANSFER_MAX; ++i) {
        if (g_rows[i].used) {
            DeleteCriticalSection(&g_rows[i].lock);
            g_rows[i].used = 0;
        }
    }
    DeleteCriticalSection(&g_lock);
    g_xfer_inited = 0;
}