/* core_test.c - exercise the native TransfoCore.dll against a live server.
 *
 *   [01] base64 round-trip                 [02] UDP discovery (loopback)
 *   [03] out-of-order chunk -> 409         [04] small upload -> pull == src
 *   [05] cancel mid-upload -> resume       [06] 100 MB upload -> pull == src
 *
 * Usage: core_test.exe <baseUrl> [email] [password]
 *   baseUrl like http://localhost:4000. A fresh account is registered when
 *   email/password are omitted.
 *
 * Build: gcc -O2 test/core_test.c vendor/cJSON.c -I. -Lbin -lTransfoCore
 *        -lws2_32 -liphlpapi -static-libgcc -o test/core_test.exe
 */
#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <time.h>
#include "transfo.h"
#include "vendor/cJSON.h"

static int g_pass = 0, g_fail = 0;

#define CHECK(cond, name) do { \
    if (cond) { g_pass++; printf("  PASS  %s\n", name); } \
    else      { g_fail++; printf("  FAIL  %s\n", name); } \
} while (0)

/* ---------- JSON + HTTP helpers ----------------------------------------- */

static const char* obj_str(const cJSON* root, const char* key) {
    const cJSON* v = cJSON_GetObjectItemCaseSensitive(root, key);
    return (v && cJSON_IsString(v) && v->valuestring) ? v->valuestring : NULL;
}
static long long obj_i64(const cJSON* root, const char* key) {
    const cJSON* v = cJSON_GetObjectItemCaseSensitive(root, key);
    return (v && cJSON_IsNumber(v)) ? (long long)v->valuedouble : 0;
}

static int http_json(const char* method, const char* url, const char* token,
                     const char* json, cJSON** out, int* status) {
    char* body = NULL; int rc = -1;
    if (strcmp(method, "POST") == 0) rc = trc_http_post(url, token, json, &body, status);
    else if (strcmp(method, "GET") == 0) rc = trc_http_get(url, token, &body, status);
    else if (strcmp(method, "DELETE") == 0) rc = trc_http_del(url, token, &body, status);
    else return -1;
    if (rc != 0) { *status = 0; return -1; }
    *out = body ? cJSON_Parse(body) : NULL;
    trc_free(body);
    return (cJSON_IsObject(*out) || cJSON_IsArray(*out)) ? 0 : -1;
}

static char g_token[2048];

static int login_or_register(const char* base, const char* email, const char* pw) {
    char body[512]; cJSON* j = NULL; int status = 0; char url[1536];
    snprintf(body, sizeof body, "{\"email\":\"%s\",\"password\":\"%s\"}", email, pw);
    snprintf(url, sizeof url, "%s/api/auth/login", base);
    if (http_json("POST", url, NULL, body, &j, &status) == 0 && status == 200) {
        const char* t = obj_str(j, "token");
        if (t) { snprintf(g_token, sizeof g_token, "%s", t); cJSON_Delete(j); return 0; }
    }
    if (j) cJSON_Delete(j);
    snprintf(url, sizeof url, "%s/api/auth/register", base);
    if (http_json("POST", url, NULL, body, &j, &status) == 0 && status == 200) {
        const char* t = obj_str(j, "token");
        if (t) { snprintf(g_token, sizeof g_token, "%s", t); cJSON_Delete(j); return 0; }
    }
    if (j) cJSON_Delete(j);
    printf("  register/login failed (HTTP %d)\n", status);
    return -1;
}

static int wait_for_terminal(uint64_t handle, int wantPhase, int timeoutMs) {
    int phase = -1; long long tr = 0, to = 0;
    int waited = 0;
    for (;;) {
        if (trc_transfer_status(handle, &phase, NULL, &tr, &to) != 0) return -2;
        if (phase >= 2) break;
        Sleep(100); waited += 100;
        if (waited > timeoutMs) { printf("    (timeout after %d ms)\n", timeoutMs); return -1; }
    }
    if (wantPhase >= 0 && phase != wantPhase) {
        printf("    (expected phase %d, got %d)\n", wantPhase, phase);
    }
    return phase;
}

static void transfer_cb(uint64_t handle, int phase, const char* sid, const char* name,
                        long long transferred, long long total, const char* err, void* user) {
    (void)handle; (void)sid; (void)user;
    if (phase == 0)      printf("      transfer started  (%s)\n", name ? name : "");
    else if (phase == 2) printf("      + DONE  %s  %lld/%lld B\n", name ? name : "", transferred, total);
    else if (phase == 3) printf("      x CANCELED at %lld B\n", transferred);
    else if (phase == 4) printf("      ! FAILED: %s\n", err ? err : "(unknown)");
}

/* basename for both separators (file path is stored in the session as the
 * bare name, so a full Windows path must be trimmed the same way). */
static const char* base_name(const char* p) {
    const char* last = p;
    for (const char* q = p; *q; ++q) if (*q == '/' || *q == '\\') last = q + 1;
    return last;
}

/* Find the live session row for a file name on the server. Returns pointer to
 * a static copy of the id ("" when missing). Also sets received when requested. */
static const char* find_session(const char* base, const char* name, long long* outReceived) {
    static char sid[TRC_ID_MAX];
    sid[0] = '\0';
    char url[1600]; cJSON* list = NULL; int status = 0;
    snprintf(url, sizeof url, "%s/api/transfer/sessions", base);
    if (http_json("GET", url, g_token, NULL, &list, &status) != 0 || status != 200) {
        if (list) cJSON_Delete(list);
        return sid;
    }
    int n = cJSON_GetArraySize(list);
    for (int i = 0; i < n; ++i) {
        cJSON* item = cJSON_GetArrayItem(list, i);
        const char* nm = obj_str(item, "name");
        if (nm && strcmp(nm, name) == 0) {
            const char* id = obj_str(item, "id");
            if (id) snprintf(sid, sizeof sid, "%s", id);
            if (outReceived) *outReceived = obj_i64(item, "received");
            break;
        }
    }
    cJSON_Delete(list);
    return sid;
}

/* ---------- files ------------------------------------------------------- */

static void fill_pattern(unsigned char* buf, size_t n, unsigned* seed) {
    for (size_t i = 0; i < n; ++i) {
        *seed = *seed * 1103515245u + 12345u;
        buf[i] = (unsigned char)((*seed >> 16) & 0xff);
    }
}

static int gen_file(const char* path, long long size) {
    FILE* f = fopen(path, "wb");
    if (!f) return -1;
    unsigned seed = 0x20160916u;
    unsigned char buf[1 << 20];
    long long left = size;
    while (left > 0) {
        size_t n = left > (long long)sizeof buf ? sizeof buf : (size_t)left;
        fill_pattern(buf, n, &seed);
        if (fwrite(buf, 1, n, f) != n) { fclose(f); return -1; }
        left -= (long long)n;
    }
    fclose(f);
    return 0;
}

static long long file_size(const char* path) {
    FILE* f = fopen(path, "rb");
    if (!f) return -1;
    if (fseek(f, 0, SEEK_END) != 0) { fclose(f); return -1; }
    long long sz = (long long)ftell(f);
    fclose(f);
    return sz;
}

static int files_equal(const char* a, const char* b) {
    FILE* fa = fopen(a, "rb");
    FILE* fb = fopen(b, "rb");
    if (!fa || !fb) { if (fa) fclose(fa); if (fb) fclose(fb); return 0; }
    unsigned char ba[1 << 16], bb[1 << 16];
    int eq = 1;
    for (;;) {
        size_t na = fread(ba, 1, sizeof ba, fa);
        size_t nb = fread(bb, 1, sizeof bb, fb);
        if (na != nb || memcmp(ba, bb, na) != 0) { eq = 0; break; }
        if (na == 0) break;
    }
    fclose(fa); fclose(fb);
    return eq;
}

/* ======================================================================== */
/* Tests                                                                     */
/* ======================================================================== */

static void test_base64(void) {
    printf("[01] base64 round-trip\n");
    static const unsigned char raw[] = {0x00, 0xde, 0xad, 0xbe, 0xef, 0x01, 0x02,
                                        0xfe, 0xff, 'A', 'B', 0x80, 0x7f, 0x00};
    size_t need = trc_base64_encoded_len(sizeof raw);
    char* b64 = (char*)malloc(need);
    unsigned char* back = (unsigned char*)malloc(sizeof raw);
    trc_base64_encode(raw, sizeof raw, b64);
    printf("      \"%.*s\"\n", (int)need - 1, b64);
    size_t got = trc_base64_decode(b64, strlen(b64), back);
    CHECK(got == sizeof raw && memcmp(back, raw, sizeof raw) == 0,
          "decode(encode(x)) == x (14 bytes)");
    trc_base64_encode((const unsigned char*)"", 0, b64);
    CHECK(strcmp(b64, "") == 0, "empty encode");
    free(b64); free(back);
}

static void test_discovery(void) {
    printf("[02] UDP discovery (loopback)\n");
    const char* selfId = "coretest-self";
    int rc = trc_discovery_start(selfId, "CoreTest Windows", 4000, NULL, NULL);
    CHECK(rc == 0, "discovery start");
    if (rc != 0) return;

    SOCKET s = socket(AF_INET, SOCK_DGRAM, 0);
    CHECK(s != INVALID_SOCKET, "peer socket");
    if (s == INVALID_SOCKET) { trc_discovery_stop(); return; }

    cJSON* j = cJSON_CreateObject();
    cJSON_AddStringToObject(j, "deviceId", "coretest-peer");
    cJSON_AddStringToObject(j, "deviceName", "Fake Phone");
    cJSON_AddStringToObject(j, "ip", "10.0.0.77");
    cJSON_AddNumberToObject(j, "port", 4111);
    cJSON_AddNumberToObject(j, "ts", (double)time(NULL) * 1000);
    char* text = cJSON_PrintUnformatted(j);
    cJSON_Delete(j);

    struct sockaddr_in dst;
    memset(&dst, 0, sizeof dst);
    dst.sin_family = AF_INET;
    dst.sin_port = htons(TRC_DISCOVERY_PORT);
    dst.sin_addr.s_addr = inet_addr("127.0.0.1");
    int sent = sendto(s, text, (int)strlen(text), 0, (struct sockaddr*)&dst, sizeof dst);
    CHECK(sent == (int)strlen(text), "peer announce datagram sent");
    free(text);
    closesocket(s);

    TrcDevice devs[8];
    int found = 0, n = 0;
    for (int i = 0; i < 50; ++i) {
        n = trc_discovery_snapshot(devs, 8);
        for (int k = 0; k < n; ++k) if (strcmp(devs[k].id, "coretest-peer") == 0) found = 1;
        if (found) break;
        Sleep(100);
    }
    CHECK(found, "peer discovered in snapshot");
    int peerOk = 0;
    n = trc_discovery_snapshot(devs, 8);
    for (int k = 0; k < n; ++k)
        if (strcmp(devs[k].id, "coretest-peer") == 0) {
            printf("      peer: %s @ %s:%d\n", devs[k].name, devs[k].ip, devs[k].port);
            peerOk = (strcmp(devs[k].ip, "10.0.0.77") == 0 && devs[k].port == 4111);
        }
    CHECK(peerOk, "announced ip/port preserved");
    int selfSeen = 0;
    for (int k = 0; k < n; ++k) if (strcmp(devs[k].id, selfId) == 0) selfSeen = 1;
    CHECK(!selfSeen, "self filtered from snapshot");
    CHECK(trc_discovery_stop() == 0, "discovery stop");
}

/* [03]: the server rejects a chunk whose offset equals neither the received
 * cursor nor its expected boundary — POST index 0 at offset 262144 first. */
static void test_out_of_order(const char* base) {
    printf("[03] out-of-order chunk rejected (409)\n");
    char url[1600]; cJSON* j = NULL; int status = 0;

    snprintf(url, sizeof url, "%s/api/transfer/sessions", base);
    static const char* create =
        "{\"name\":\"o3.bin\",\"size\":786432,\"type\":\"file\",\"chunkSize\":262144}";
    CHECK(http_json("POST", url, g_token, create, &j, &status) == 0 && status == 201,
          "create session");
    const char* sid = j ? obj_str(j, "id") : NULL;
    CHECK(sid != NULL, "session id returned");
    char sidbuf[64];
    if (sid) snprintf(sidbuf, sizeof sidbuf, "%s", sid);
    if (!sid) { if (j) cJSON_Delete(j); return; }
    cJSON_Delete(j);
    sid = sidbuf;   /* sid must be copied BEFORE cJSON_Delete above (use-after-free) */

    /* base64 of 262144 zero bytes, via the core encoder */
    unsigned char* zeros = (unsigned char*)calloc(1, TRC_DEFAULT_CHUNK);
    size_t blen = trc_base64_encoded_len(TRC_DEFAULT_CHUNK);
    char* data = (char*)malloc(blen);
    trc_base64_encode(zeros, TRC_DEFAULT_CHUNK, data);
    char* payload = (char*)malloc(blen + 64);

    snprintf(url, sizeof url, "%s/api/transfer/sessions/%s/chunk", base, sid);
    snprintf(payload, blen + 64, "{\"index\":0,\"offset\":262144,\"data\":\"%s\"}", data);
    CHECK(http_json("POST", url, g_token, payload, &j, &status) == 0 && status == 409,
          "index0@offset262144 -> HTTP 409");
    if (j) cJSON_Delete(j);

    snprintf(payload, blen + 64, "{\"index\":0,\"offset\":0,\"data\":\"%s\"}", data);
    CHECK(http_json("POST", url, g_token, payload, &j, &status) == 0 && status == 200,
          "index0@offset0 accepted");
    if (j) cJSON_Delete(j);

    snprintf(url, sizeof url, "%s/api/transfer/sessions/%s", base, sid);
    {
        int gs = 0;
        cJSON* gj = NULL;
        int grc = http_json("GET", url, g_token, NULL, &gj, &gs);
        long long got = gj ? obj_i64(gj, "received") : -1;
        char* js = gj ? cJSON_PrintUnformatted(gj) : NULL;
        printf("      diag GET rc=%d status=%d received=%lld body=%s\n", grc, gs, got,
               js ? (strlen(js) > 120 ? js : js) : "(none)");
        free(js);
        if (gj) cJSON_Delete(gj);
        CHECK(grc == 0 && gs == 200 && got == 262144,
              "received cursor == 262144");
    }

    free(zeros); free(data); free(payload);
    snprintf(url, sizeof url, "%s/api/transfer/sessions/%s", base, sid);
    if (http_json("DELETE", url, g_token, NULL, &j, &status) == 0) { if (j) cJSON_Delete(j); }
    printf("      (session cleaned: HTTP %d)\n", status);
}

/* Run an upload+download of a known file and assert byte equality. */
static int upload_pull_compare(const char* base, const char* src, const char* dst,
                               long long sz, int resume, const char* label) {
    char lab[160];
    snprintf(lab, sizeof lab, "%s upload %s", label, resume ? "(resume)" : "");
    uint64_t h = 0;
    if (trc_transfer_start(base, g_token, src, resume, &h, transfer_cb, NULL) != 0) {
        CHECK(0, lab);
        return 0;
    }
    int ph = wait_for_terminal(h, 2, 300000);
    trc_transfer_forget(h);
    CHECK(ph == 2, lab);

    const char* sid = find_session(base, base_name(src), NULL);
    if (!sid[0]) { CHECK(0, "session found (upload)"); return 0; }
    char dp[200];
    snprintf(dp, sizeof dp, "%s %s pull", label, sid);
    printf("      session %s -> pulling\n", sid);
    uint64_t dh = 0;
    if (trc_download_start(base, g_token, sid, base_name(src), dst, &dh, transfer_cb, NULL) != 0) {
        CHECK(0, dp);
        return 0;
    }
    int dph = wait_for_terminal(dh, 2, 300000);
    trc_transfer_forget(dh);
    CHECK(dph == 2, dp);
    CHECK(file_size(dst) == sz, "pulled size matches");
    CHECK(files_equal(src, dst), "pulled bytes identical");
    return 1;
}

static void test_small_xfer(const char* base, const char* src, const char* dst) {
    printf("[04] small upload -> pull == source (2 MiB)\n");
    const long long sz = 2LL * 1024 * 1024;
    CHECK(gen_file(src, sz) == 0, "generated 2 MiB source");
    upload_pull_compare(base, src, dst, sz, 0, "[04]");
}

static void test_resume(const char* base, const char* src, const char* dst) {
    printf("[05] cancel mid-upload -> resume\n");
    const long long sz = 16LL * 1024 * 1024 + 137;  /* big enough to interrupt */
    CHECK(gen_file(src, sz) == 0, "generated 16 MiB+137 source");

    /* attempt 1: cancel as soon as meaningful progress has landed */
    uint64_t h = 0;
    CHECK(trc_transfer_start(base, g_token, src, 0, &h, transfer_cb, NULL) == 0,
          "attempt 1 started");
    int phase = -1; long long tr = 0;
    for (int i = 0; i < 30; ++i) {          /* up to ~3 s */
        trc_transfer_status(h, &phase, NULL, &tr, NULL);
        if (phase >= 2 || tr >= (1024 * 1024)) break;
        Sleep(100);
    }
    trc_transfer_cancel(h);
    int ph = wait_for_terminal(h, -1, 120000);
    trc_transfer_forget(h);
    CHECK(ph == 3 || ph == 2, "attempt 1 ended canceled-or-done");

    /* the server must record a PARTIAL cursor for a genuine resume */
    long long recv = -1;
    const char* sid1 = find_session(base, base_name(src), &recv);
    printf("      server cursor after cancel: %lld/%lld bytes\n",
           recv > 0 ? recv : 0, sz);
    CHECK(recv >= 0 && (recv >= sz || recv > 0) && recv < sz,
          "server has a partial cursor to resume from");
    (void)sid1;

    /* attempt 2 resumes from the server cursor regardless */
    uint64_t h2 = 0;
    CHECK(trc_transfer_start(base, g_token, src, 1, &h2, transfer_cb, NULL) == 0,
          "resume started");
    long long startTr = -1, rTr = -1;
    trc_transfer_status(h2, &phase, NULL, &startTr, NULL);
    int rph = wait_for_terminal(h2, 2, 300000);
    trc_transfer_status(h2, &phase, NULL, &rTr, NULL);
    trc_transfer_forget(h2);
    CHECK(rph == 2, "resume completed (done)");

    const char* sid2 = find_session(base, base_name(src), NULL);
    if (sid2[0]) {
        uint64_t dh = 0;
        CHECK(trc_download_start(base, g_token, sid2, base_name(src), dst, &dh,
                                 transfer_cb, NULL) == 0, "resumed pull started");
        int dph = wait_for_terminal(dh, 2, 300000);
        trc_transfer_forget(dh);
        CHECK(dph == 2, "resumed pull completed");
        CHECK(file_size(dst) == sz, "pulled size matches 16 MiB+137");
        CHECK(files_equal(src, dst), "pulled bytes identical (incl. partial final chunk)");
    } else {
        CHECK(0, "session for resumed pull found");
    }
}

static void test_large_xfer(const char* base, const char* src, const char* dst) {
    printf("[06] large upload -> pull == source (100 MiB)\n");
    const long long sz = 100LL * 1024 * 1024;
    CHECK(gen_file(src, sz) == 0, "generated 100 MiB source");
    DWORD t0 = GetTickCount();
    upload_pull_compare(base, src, dst, sz, 0, "[06]");
    DWORD t1 = GetTickCount();
    printf("      [06] round trip took %.1f s\n", (t1 - t0) / 1000.0);
}

int main(int argc, char** argv) {
    const char* base = (argc > 1) ? argv[1] : "http://localhost:4000";
    char email[128], pw[64];
    if (argc > 3) {
        snprintf(email, sizeof email, "%s", argv[2]);
        snprintf(pw, sizeof pw, "%s", argv[3]);
    } else {
        snprintf(email, sizeof email, "coretest-%u@transfo.local",
                 (unsigned)GetCurrentProcessId());
        snprintf(pw, sizeof pw, "Test1234!");
    }

    printf("Transfo native core test\n  server : %s\n  account: %s\n\n", base, email);

    trc_init();
    if (login_or_register(base, email, pw) != 0) {
        printf("\nFAILED: cannot authenticate.\n"); return 1;
    }
    printf("  authenticated ok\n\n");

    test_base64();
    test_discovery();

    char baseDir[MAX_PATH], srcDir[MAX_PATH], dstDir[MAX_PATH];
    snprintf(baseDir, sizeof baseDir, "%s\\TransfoCoreTest", getenv("TEMP"));
    snprintf(srcDir, sizeof srcDir, "%s\\src", baseDir);
    snprintf(dstDir, sizeof dstDir, "%s\\dst", baseDir);
    CreateDirectoryA(baseDir, NULL);
    CreateDirectoryA(srcDir, NULL);
    CreateDirectoryA(dstDir, NULL);

    char p1s[MAX_PATH], p1d[MAX_PATH], p2s[MAX_PATH], p2d[MAX_PATH], p3s[MAX_PATH], p3d[MAX_PATH];
    snprintf(p1s, sizeof p1s, "%s\\small-%u.bin", srcDir, (unsigned)GetCurrentProcessId());
    snprintf(p1d, sizeof p1d, "%s\\small-%u.out", dstDir, (unsigned)GetCurrentProcessId());
    snprintf(p2s, sizeof p2s, "%s\\resume-%u.bin", srcDir, (unsigned)GetCurrentProcessId());
    snprintf(p2d, sizeof p2d, "%s\\resume-%u.out", dstDir, (unsigned)GetCurrentProcessId());
    snprintf(p3s, sizeof p3s, "%s\\large-%u.bin", srcDir, (unsigned)GetCurrentProcessId());
    snprintf(p3d, sizeof p3d, "%s\\large-%u.out", dstDir, (unsigned)GetCurrentProcessId());

    test_out_of_order(base);
    test_small_xfer(base, p1s, p1d);
    test_resume(base, p2s, p2d);
    test_large_xfer(base, p3s, p3d);

    DeleteFileA(p1s); DeleteFileA(p1d);
    DeleteFileA(p2s); DeleteFileA(p2d);
    DeleteFileA(p3s); DeleteFileA(p3d);

    trc_shutdown();
    printf("\n==== %d passed, %d failed ====\n", g_pass, g_fail);
    return g_fail ? 1 : 0;
}