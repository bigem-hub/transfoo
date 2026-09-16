/* tr_util.c - shared helpers: UTF-8<->UTF-16, local IPv4, URL split. */
#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <iphlpapi.h>
#include <wchar.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <stdarg.h>
#include "transfo_internal.h"
#include "transfo.h"

static _Thread_local char g_err[TRC_ERR_MAX];

void trc_error_set(const char* fmt, ...) {
    va_list ap;
    va_start(ap, fmt);
    vsnprintf(g_err, sizeof g_err, fmt, ap);
    va_end(ap);
}

const char* trc_last_error(void) { return g_err; }

/* ---- UTF conversion -------------------------------------------------- */

wchar_t* trc_utf8_to_wide(const char* s) {
    if (!s) return NULL;
    int n = MultiByteToWideChar(CP_UTF8, 0, s, -1, NULL, 0);
    if (n <= 0) return NULL;
    wchar_t* w = (wchar_t*)calloc((size_t)n, sizeof(wchar_t));
    if (!w) return NULL;
    MultiByteToWideChar(CP_UTF8, 0, s, -1, w, n);
    return w;
}

char* trc_wide_to_utf8(const wchar_t* w) {
    if (!w) return NULL;
    int n = WideCharToMultiByte(CP_UTF8, 0, w, -1, NULL, 0, NULL, NULL);
    if (n <= 0) return NULL;
    char* s = (char*)calloc((size_t)n, 1);
    if (!s) return NULL;
    WideCharToMultiByte(CP_UTF8, 0, w, -1, s, n, NULL, NULL);
    return s;
}

/* ---- Path helpers ---------------------------------------------------- */

/* Base file name (last component after / or \). Returns pointer into input. */
const char* trc_path_basename(const char* path) {
    const char* p = path;
    const char* last = path;
    for (; *p; ++p) {
        if (*p == '/' || *p == '\\') last = p + 1;
    }
    return last;
}

/* ---- Local IPv4 (first private address) ------------------------------ */

char* trc_local_ipv4(void) {
    char* result = NULL;
    ULONG buflen = 15 * 1024;
    IP_ADAPTER_ADDRESSES* addrs = (IP_ADAPTER_ADDRESSES*)malloc(buflen);
    if (!addrs) return NULL;
    ULONG rc = GetAdaptersAddresses(AF_INET, 0, NULL, addrs, &buflen);
    if (rc == ERROR_BUFFER_OVERFLOW) {
        free(addrs);
        addrs = (IP_ADAPTER_ADDRESSES*)malloc(buflen);
        if (!addrs) return NULL;
        rc = GetAdaptersAddresses(AF_INET, 0, NULL, addrs, &buflen);
    }
    if (rc == NO_ERROR) {
        for (IP_ADAPTER_ADDRESSES* a = addrs; a && !result; a = a->Next) {
            if (a->OperStatus != IfOperStatusUp) continue;
            if (a->IfType == IF_TYPE_SOFTWARE_LOOPBACK) continue;
            for (IP_ADAPTER_UNICAST_ADDRESS* u = a->FirstUnicastAddress;
                 u; u = u->Next) {
                if (u->Address.lpSockaddr->sa_family != AF_INET) continue;
                struct sockaddr_in* si = (struct sockaddr_in*)u->Address.lpSockaddr;
                unsigned long a4 = ntohl(si->sin_addr.s_addr);
                /* prefer RFC1918 private ranges: 10.x, 172.16-31, 192.168.x */
                int b1 = (a4 >> 24) & 0xff, b2 = (a4 >> 16) & 0xff;
                if (b1 == 10 || (b1 == 172 && b2 >= 16 && b2 <= 31) || (b1 == 192 && b2 == 168)) {
                    char buf[64];
                    snprintf(buf, sizeof buf, "%u.%u.%u.%u",
                             (unsigned)((a4 >> 24) & 0xff), (unsigned)((a4 >> 16) & 0xff),
                             (unsigned)((a4 >> 8) & 0xff), (unsigned)(a4 & 0xff));
                    result = strdup(buf);
                    break;
                }
            }
        }
    }
    free(addrs);
    return result;
}

/* ---- URL split ------------------------------------------------------- */

/* "http://host[:port]/path" -> scheme(ignored), host, port, path.
 * host/path are NUL-terminated into caller buffers; returns 0 on success. */
int trc_split_url(const char* url, char* host, int hostCap, int* port, char* path, int pathCap) {
    if (!url) return -1;
    const char* h = strstr(url, "://");
    if (!h) return -1;
    h += 3;
    const char* slash = strchr(h, '/');
    const char* colon = strchr(h, ':');
    const char* end = slash ? slash : h + strlen(h);

    /* host part */
    const char* hostEnd = colon && colon < end ? colon : end;
    size_t hlen = (size_t)(hostEnd - h);
    if (hlen <= 0 || hlen >= (size_t)hostCap) return -1;
    memcpy(host, h, hlen);
    host[hlen] = '\0';

    *port = 80;
    if (colon && colon < end) {
        *port = atoi(colon + 1);
        if (*port <= 0) return -1;
    }

    if (slash) {
        size_t plen = strlen(slash);
        if (plen >= (size_t)pathCap) return -1;
        memcpy(path, slash, plen + 1);
    } else {
        path[0] = '\0';
    }
    return 0;
}