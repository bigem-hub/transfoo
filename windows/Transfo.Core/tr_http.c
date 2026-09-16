/* tr_http.c - minimal Winsock HTTP/1.1 client (JSON + file streaming).
 * Connection: close per request; honors Content-Length and chunked encoding.
 * Uses a connection-level byte buffer so header/body read boundaries are safe. */
#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <ctype.h>
#include "transfo_internal.h"
#include "transfo.h"

#define TRC_CONNECT_TIMEOUT_MS  3000
#define TRC_IO_TIMEOUT_MS       30000
#define TRC_BODY_CAP_MAX        (16 * 1024 * 1024)  /* JSON response cap */

#define set_err trc_error_set

int trc_http_init(void) {
    WSADATA wsa;
    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
        set_err("WSAStartup failed");
        return -1;
    }
    return 0;
}

void trc_http_cleanup(void) { WSACleanup(); }

void trc_init(void) {
    if (trc_http_init() != 0) return;
    xfer_tbl_init();
}

/* ---- growable byte buffer ------------------------------------------- */
typedef struct Buf { char* p; int cap; int len; } Buf;

static int buf_reserve(Buf* b, int extra) {
    int need = b->len + extra;
    if (need <= b->cap) return 0;
    int nc = b->cap ? b->cap : 4096;
    while (nc < need) nc *= 2;
    char* np = (char*)realloc(b->p, (size_t)nc);
    if (!np) return -1;
    b->p = np;
    b->cap = nc;
    return 0;
}

static void buf_append(Buf* b, const char* d, int n) {
    if (buf_reserve(b, n) == 0) {
        memcpy(b->p + b->len, d, (size_t)n);
        b->len += n;
    }
}

/* ---- connection with a read buffer ----------------------------------- */
typedef struct Conn {
    SOCKET s;
    Buf in;          /* unread bytes */
    int eof;
} Conn;

static Conn conn_new(SOCKET s) { Conn c = {0}; c.s = s; return c; }

static void conn_close(Conn* c) {
    closesocket(c->s);
    free(c->in.p);
    memset(c, 0, sizeof *c);
}

/* Top up the inbound buffer with one recv. Returns bytes added, 0 on EOF,
 * -1 on error. */
static int conn_fill(Conn* c) {
    if (c->eof) return 0;
    if (buf_reserve(&c->in, 16384) != 0) { set_err("out of memory"); return -1; }
    int n = recv(c->s, c->in.p + c->in.len, 16384, 0);
    if (n == 0) { c->eof = 1; return 0; }
    if (n == SOCKET_ERROR) {
        int err = WSAGetLastError();
        if (err == WSAETIMEDOUT) set_err("read timed out");
        else set_err("read failed: %d", err);
        c->eof = 1;
        return -1;
    }
    c->in.len += n;
    return n;
}

/* Read one CRLF line into out (no CR/LF; NUL-terminated). out.len reused.
 * Returns 1 on line, 0 on EOF before any data, -1 on error. */
static int conn_read_line(Conn* c, Buf* out) {
    out->len = 0;
    while (1) {
        for (int i = 0; i < c->in.len; ++i) {
            if (c->in.p[i] == '\n') {
                int lineLen = (i > 0 && c->in.p[i - 1] == '\r') ? i - 1 : i;
                if (out->cap < lineLen + 1) {
                    char* np = (char*)realloc(out->p, (size_t)lineLen + 1);
                    if (!np) { set_err("out of memory"); return -1; }
                    out->p = np;
                    out->cap = lineLen + 1;
                }
                memcpy(out->p, c->in.p, (size_t)lineLen);
                out->p[lineLen] = '\0';
                /* consume line from input buffer */
                memmove(c->in.p, c->in.p + i + 1, (size_t)(c->in.len - i - 1));
                c->in.len -= (i + 1);
                out->len = lineLen;
                return 1;
            }
        }
        if (c->in.len > 64 * 1024) { set_err("line too long"); return -1; }
        int n = conn_fill(c);
        if (n == 0) return c->in.len > 0 ? 1 : 0;   /* bare EOF */
        if (n < 0) return -1;
    }
}

/* Read exactly n bytes into dst (must hold n). */
static int conn_read_exact(Conn* c, char* dst, int n) {
    int got = 0;
    while (got < n) {
        int avail = c->in.len;
        if (avail > 0) {
            int take = n - got;
            if (take > avail) take = avail;
            memcpy(dst + got, c->in.p, (size_t)take);
            memmove(c->in.p, c->in.p + take, (size_t)(avail - take));
            c->in.len -= take;
            got += take;
        } else {
            int r = conn_fill(c);
            if (r <= 0) return -1;
        }
    }
    return 0;
}

/* Discard exactly n bytes. */
static int conn_skip(Conn* c, int n) {
    while (n > 0) {
        int avail = c->in.len;
        if (avail >= n) {
            memmove(c->in.p, c->in.p + n, (size_t)(avail - n));
            c->in.len -= n;
            return 0;
        }
        c->in.len = 0;
        n -= avail;
        int r = conn_fill(c);
        if (r <= 0) return -1;
    }
    return 0;
}

/* ---- connection setup ------------------------------------------------ */
static int connect_with_timeout(const char* host, int port, SOCKET* out) {
    struct addrinfo hints, *res = NULL;
    memset(&hints, 0, sizeof hints);
    hints.ai_socktype = SOCK_STREAM;
    hints.ai_family = AF_UNSPEC;
    char portstr[16];
    snprintf(portstr, sizeof portstr, "%d", port);

    if (getaddrinfo(host, portstr, &hints, &res) != 0) {
        set_err("could not resolve host '%s'", host);
        return -1;
    }
    SOCKET s = INVALID_SOCKET;
    int ok = -1;
    for (struct addrinfo* ai = res; ai; ai = ai->ai_next) {
        s = socket(ai->ai_family, ai->ai_socktype, ai->ai_protocol);
        if (s == INVALID_SOCKET) continue;
        u_long nb = 1;
        ioctlsocket(s, FIONBIO, &nb);
        int rc = connect(s, ai->ai_addr, (int)ai->ai_addrlen);
        if (rc == SOCKET_ERROR) {
            int err = WSAGetLastError();
            if (err == WSAEWOULDBLOCK || err == WSAEINPROGRESS) {
                fd_set wf, ef;
                FD_ZERO(&wf); FD_ZERO(&ef);
                FD_SET(s, &wf); FD_SET(s, &ef);
                struct timeval tv = { TRC_CONNECT_TIMEOUT_MS / 1000,
                                     (TRC_CONNECT_TIMEOUT_MS % 1000) * 1000 };
                rc = select(0, NULL, &wf, &ef, &tv);
                if (rc > 0) {
                    int soerr = 0;
                    int slen = sizeof soerr;
                    getsockopt(s, SOL_SOCKET, SO_ERROR, (char*)&soerr, &slen);
                    rc = soerr ? -1 : 0;
                } else rc = -1;
            } else rc = -1;
        }
        nb = 0;
        ioctlsocket(s, FIONBIO, &nb);
        DWORD rcv = TRC_IO_TIMEOUT_MS, snd = TRC_IO_TIMEOUT_MS;
        setsockopt(s, SOL_SOCKET, SO_RCVTIMEO, (const char*)&rcv, sizeof rcv);
        setsockopt(s, SOL_SOCKET, SO_SNDTIMEO, (const char*)&snd, sizeof snd);
        if (rc == 0) { ok = 0; break; }
        closesocket(s);
        s = INVALID_SOCKET;
    }
    freeaddrinfo(res);
    if (ok != 0) set_err("could not connect to %s:%d", host, port);
    *out = s;
    return ok;
}

static int send_all(SOCKET s, const char* data, int len) {
    int sent = 0;
    while (sent < len) {
        int n = send(s, data + sent, len - sent, 0);
        if (n == SOCKET_ERROR) {
            set_err("send failed: %d", WSAGetLastError());
            return -1;
        }
        sent += n;
    }
    return 0;
}

static inline int hexval(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

/* ---- response --------------------------------------------------------- */
typedef struct Resp {
    int status;
    Buf body;                 /* decoded JSON body (empty when streaming) */
    long long content_length;
    void (*stream_cb)(const char* data, int n, void* user);
    void* stream_user;
    int failed;
} Resp;

static void resp_stream_out(Resp* r, const char* data, int n) {
    if (r->stream_cb) r->stream_cb(data, n, r->stream_user);
    else buf_append(&r->body, data, n);
}

/* Core exchange. Returns 0 on completed HTTP exchange, -1 on transport error. */
static int exchange(const char* host, int port, const char* method,
                    const char* path, const char* token, const char* jsonBody,
                    Resp* resp) {
    SOCKET s;
    if (connect_with_timeout(host, port, &s) != 0) return -1;
    Conn c = conn_new(s);

    Buf req = {0};
    char hdr[512];
    snprintf(hdr, sizeof hdr, "%s %s HTTP/1.1\r\nHost: %s:%d\r\nUser-Agent: TransfoCore/1.0\r\n",
             method, path[0] ? path : "/", host, port);
    buf_append(&req, hdr, (int)strlen(hdr));
    if (token) {
        static const char a[] = "Authorization: Bearer ";
        buf_append(&req, a, (int)strlen(a));
        buf_append(&req, token, (int)strlen(token));
        buf_append(&req, "\r\n", 2);
    }
    if (jsonBody) {
        static const char ct[] = "Content-Type: application/json\r\n";
        buf_append(&req, ct, (int)sizeof ct - 1);
        char cl[64];
        snprintf(cl, sizeof cl, "Content-Length: %d\r\n", (int)strlen(jsonBody));
        buf_append(&req, cl, (int)strlen(cl));
    }
    static const char connhdr[] = "Connection: close\r\n\r\n";
    buf_append(&req, connhdr, (int)sizeof connhdr - 1);
    if (jsonBody) buf_append(&req, jsonBody, (int)strlen(jsonBody));

    int rc = send_all(s, req.p, req.len);
    free(req.p);
    if (rc != 0) { conn_close(&c); return -1; }

    /* status line */
    Buf line = {0};
    int lr = conn_read_line(&c, &line);
    if (lr != 1) {
        if (lr == 0 && !c.in.len) set_err("connection closed before status");
        free(line.p); conn_close(&c); return -1;
    }
    if (strncmp(line.p, "HTTP/", 5) != 0) {
        set_err("malformed status line");
        free(line.p); conn_close(&c); return -1;
    }
    const char* sp = strchr(line.p, ' ');
    if (!sp) { free(line.p); conn_close(&c); return -1; }
    resp->status = atoi(sp + 1);
    free(line.p);
    line.p = NULL; line.cap = 0;   /* don't reuse the freed status-line buffer */

    /* headers */
    resp->content_length = -1;
    int chunked = 0;
    while (1) {
        int r = conn_read_line(&c, &line);
        if (r != 1) {
            if (r == 0) set_err("connection closed during headers");
            free(line.p); conn_close(&c); return -1;
        }
        if (line.len == 0) break;
        char key[64];
        int ki = 0;
        while (line.p[ki] != ':' && line.p[ki] != '\0' && ki < 63) {
            key[ki] = (char)tolower((unsigned char)line.p[ki]);
            ki++;
        }
        key[ki] = '\0';
        const char* val = line.p + ki;
        while (*val == ':') val++;
        while (*val == ' ') val++;
        if (strcmp(key, "content-length") == 0) {
            resp->content_length = atoll(val);
        } else if (strcmp(key, "transfer-encoding") == 0 && strstr(val, "chunked")) {
            chunked = 1;
        }
    }
    free(line.p);
    line.p = NULL; line.cap = 0;

    /* body */
    if (chunked) {
        while (1) {
            int r = conn_read_line(&c, &line);
            if (r != 1) { free(line.p); conn_close(&c); return -1; }
            long sz = 0;
            const char* q = line.p;
            for (; *q && *q != ';'; ++q) {
                int v = hexval(*q);
                if (v < 0) break;
                sz = sz * 16 + v;
            }
            free(line.p); line.p = NULL; line.cap = 0;
            if (sz == 0) {
                Buf t = {0};
                while (1) {
                    int tr = conn_read_line(&c, &t);
                    if (tr != 1 || t.len == 0) break;
                    t.len = 0;
                }
                free(t.p);
                break;
            }
            if (!resp->stream_cb && resp->body.len + (int)sz + 1 > TRC_BODY_CAP_MAX) {
                set_err("response exceeds %d bytes", TRC_BODY_CAP_MAX);
                conn_close(&c); return -1;
            }
            if (buf_reserve(&resp->body, (int)sz) != 0) { conn_close(&c); return -1; }
            /* stream chunks incrementally when streaming */
            if (resp->stream_cb) {
                char tmp[8192];
                long left = sz;
                while (left > 0) {
                    int want = (int)(left > 8192 ? 8192 : left);
                    if (conn_read_exact(&c, tmp, want) != 0) { conn_close(&c); return -1; }
                    resp->stream_cb(tmp, want, resp->stream_user);
                    left -= want;
                }
            } else {
                if (conn_read_exact(&c, resp->body.p + resp->body.len, (int)sz) != 0) {
                    conn_close(&c); return -1;
                }
                resp->body.len += (int)sz;
            }
            if (conn_skip(&c, 2) != 0) { conn_close(&c); return -1; } /* CRLF */
        }
    } else if (resp->content_length >= 0) {
        long long remaining = resp->content_length;
        if (!resp->stream_cb && remaining > TRC_BODY_CAP_MAX) {
            set_err("response too large (%lld bytes)", remaining);
            conn_close(&c); return -1;
        }
        char tmp[16384];
        while (remaining > 0) {
            int want = (int)(remaining > 16384 ? 16384 : remaining);
            if (conn_read_exact(&c, tmp, want) != 0) { conn_close(&c); return -1; }
            resp_stream_out(resp, tmp, want);
            remaining -= want;
        }
    } else {
        /* read until close */
        while (!c.eof) {
            if (conn_fill(&c) < 0) { conn_close(&c); return -1; }
            int avail = c.in.len;
            if (avail > 0) {
                resp_stream_out(resp, c.in.p, avail);
                c.in.len = 0;
                if (!resp->stream_cb && resp->body.len > TRC_BODY_CAP_MAX) {
                    set_err("response exceeds %d bytes", TRC_BODY_CAP_MAX);
                    conn_close(&c); return -1;
                }
            }
        }
    }

    conn_close(&c);
    if (resp->body.p) resp->body.p[resp->body.len] = '\0';
    return 0;
}

static int http_json(const char* url, const char* token, const char* jsonBody,
                     char** out_body, int* out_status, int is_post) {
    char host[TRC_HOST_MAX], path[1024];
    int port;
    if (trc_split_url(url, host, sizeof host, &port, path, sizeof path) != 0) {
        set_err("bad url '%s'", url ? url : "(null)");
        return -1;
    }
    Resp resp = {0};
    int rc = exchange(host, port, is_post ? "POST" : "GET", path, token, jsonBody, &resp);
    if (rc != 0) return -1;
    if (out_status) *out_status = resp.status;
    if (out_body) {
        *out_body = resp.body.p ? resp.body.p : strdup("");
        if (!*out_body) { free(resp.body.p); return -1; }
    } else {
        free(resp.body.p);
    }
    return 0;
}

int trc_http_post(const char* url, const char* token, const char* json,
                  char** out_body, int* statusCode) {
    return http_json(url, token, json, out_body, statusCode, 1);
}

int trc_http_get(const char* url, const char* token, char** out_body, int* statusCode) {
    return http_json(url, token, NULL, out_body, statusCode, 0);
}

int trc_http_del(const char* url, const char* token, char** out_body, int* statusCode) {
    char host[TRC_HOST_MAX], path[1024];
    int port;
    if (trc_split_url(url, host, sizeof host, &port, path, sizeof path) != 0) {
        trc_error_set("bad url '%s'", url ? url : "(null)");
        return -1;
    }
    Resp resp = {0};
    int rc = exchange(host, port, "DELETE", path, token, NULL, &resp);
    if (rc != 0) return -1;
    if (statusCode) *statusCode = resp.status;
    if (out_body) {
        *out_body = resp.body.p ? resp.body.p : strdup("");
        if (!*out_body) { free(resp.body.p); return -1; }
    } else {
        free(resp.body.p);
    }
    return 0;
}

/* ---- download (stream to file) -------------------------------------- */
typedef struct DlCtx {
    FILE* f;
    long long total;
    TrcIoProgressCb cb;
    void* user;
    int lastCbKb;
} DlCtx;

static void dl_stream_cb(const char* data, int n, void* user) {
    DlCtx* ctx = (DlCtx*)user;
    if (fwrite(data, 1, (size_t)n, ctx->f) != (size_t)n) {
        set_err("disk write failed");
        return;
    }
    ctx->total += n;
    int kb = (int)(ctx->total / 1024);
    if (ctx->cb && kb != ctx->lastCbKb) {
        ctx->lastCbKb = kb;
        ctx->cb(ctx->total, ctx->total, ctx->user);
    }
}

int trc_http_download(const char* url, const char* token, const char* destPath,
                      TrcIoProgressCb progress, void* user) {
    char host[TRC_HOST_MAX], path[1024];
    int port;
    if (trc_split_url(url, host, sizeof host, &port, path, sizeof path) != 0) {
        set_err("bad url '%s'", url ? url : "(null)");
        return -1;
    }
    wchar_t* w = trc_utf8_to_wide(destPath);
    FILE* f = w ? _wfopen(w, L"wb") : NULL;
    free(w);
    if (!f) { set_err("cannot open '%s' for writing", destPath); return -1; }
    DlCtx ctx = {0};
    ctx.f = f;
    ctx.cb = progress;
    ctx.user = user;
    Resp resp = {0};
    resp.stream_cb = dl_stream_cb;
    resp.stream_user = &ctx;
    int rc = exchange(host, port, "GET", path, token, NULL, &resp);
    if (rc != 0 || resp.status < 200 || resp.status >= 300) {
        fclose(f);
        wchar_t* wp = trc_utf8_to_wide(destPath);
        if (wp) { _wremove(wp); free(wp); }
        if (rc == 0) set_err("server returned HTTP %d", resp.status);
        return -1;
    }
    fclose(f);
    if (progress) progress(ctx.total, ctx.total, user);
    return 0;
}

void trc_free(void* p) { free(p); }