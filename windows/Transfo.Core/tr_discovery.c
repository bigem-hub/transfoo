/* tr_discovery.c - UDP discovery: announce our presence on :4001 every 5 s
 * and listen for peer announces. Mirrors the server's lib/lan.js contract. */
#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <iphlpapi.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <time.h>
#include "transfo_internal.h"
#include "transfo.h"
#include "vendor/cJSON.h"

#define TRC_DISC_MAX  64
#define TRC_DISC_STALE_MS (20 * 1000)
#define TRC_DISC_ANNOUNCE_MS (5 * 1000)
#define TRC_DISC_RCVTIMEO_MS 500

typedef struct DevRow {
    char id[TRC_ID_MAX];
    char name[TRC_NAME_MAX];
    char ip[TRC_HOST_MAX];
    int  port;
    int64_t lastSeen;
    int used;
} DevRow;

static CRITICAL_SECTION g_lock;
static DevRow g_rows[TRC_DISC_MAX];
static int g_started = 0;
static char g_selfId[TRC_ID_MAX];
static char g_selfName[TRC_NAME_MAX];
static char g_selfIp[TRC_HOST_MAX];
static int g_servicePort;
static volatile LONG g_stop = 0;
static HANDLE g_listener = NULL;
static HANDLE g_announcer = NULL;
static SOCKET g_listenSock = INVALID_SOCKET;
static SOCKET g_annSock = INVALID_SOCKET;
static TrcDeviceCb g_cb = NULL;
static void* g_cbUser = NULL;

static int64_t now_ms(void) {
    FILETIME ft;
    GetSystemTimeAsFileTime(&ft);
    ULARGE_INTEGER ui;
    ui.LowPart = ft.dwLowDateTime;
    ui.HighPart = ft.dwHighDateTime;
    /* 116444736000000000 = ms between 1601 and 1970 */
    return (int64_t)((ui.QuadPart / 10000) - 11644473600000LL);
}

static void lock(void) { EnterCriticalSection(&g_lock); }
static void unlock(void) { LeaveCriticalSection(&g_lock); }

static void dev_from_row(const DevRow* r, TrcDevice* d) {
    strncpy(d->id, r->id, sizeof d->id - 1);  d->id[sizeof d->id - 1] = '\0';
    strncpy(d->name, r->name, sizeof d->name - 1); d->name[sizeof d->name - 1] = '\0';
    strncpy(d->ip, r->ip, sizeof d->ip - 1); d->ip[sizeof d->ip - 1] = '\0';
    d->port = r->port;
    d->lastSeen = r->lastSeen;
}

/* Handle an announce datagram. srcIpN = dotted source address. */
static void handle_announce(const char* data, int len, const char* srcIp) {
    cJSON* j = cJSON_ParseWithLength(data, (size_t)len);
    if (!j) return;
    const cJSON* id = cJSON_GetObjectItemCaseSensitive(j, "deviceId");
    const cJSON* nm = cJSON_GetObjectItemCaseSensitive(j, "deviceName");
    const cJSON* ip = cJSON_GetObjectItemCaseSensitive(j, "ip");
    const cJSON* po = cJSON_GetObjectItemCaseSensitive(j, "port");
    if (!id || !cJSON_IsString(id) || !id->valuestring || !id->valuestring[0]) {
        cJSON_Delete(j);
        return;
    }
    if (strcmp(id->valuestring, g_selfId) == 0) { cJSON_Delete(j); return; } /* self */

    const char* announcedIp = (ip && cJSON_IsString(ip) && ip->valuestring)
                                  ? ip->valuestring : srcIp;
    int port = (po && cJSON_IsNumber(po)) ? po->valueint : 0;
    const char* name = (nm && cJSON_IsString(nm) && nm->valuestring) ? nm->valuestring : "";

    DevRow temp;
    memset(&temp, 0, sizeof temp);
    strncpy(temp.id, id->valuestring, sizeof temp.id - 1);
    strncpy(temp.name, name, sizeof temp.name - 1);
    strncpy(temp.ip, announcedIp, sizeof temp.ip - 1);
    temp.port = port;
    temp.lastSeen = now_ms();
    temp.used = 1;

    /* update row */
    int fired = 0;
    lock();
    int idx = -1;
    for (int i = 0; i < TRC_DISC_MAX; ++i) {
        if (g_rows[i].used && strcmp(g_rows[i].id, temp.id) == 0) { idx = i; break; }
    }
    if (idx < 0) {
        for (int i = 0; i < TRC_DISC_MAX; ++i) {
            if (!g_rows[i].used) { idx = i; break; }
        }
    }
    if (idx >= 0) {
        memcpy(&g_rows[idx], &temp, sizeof temp);
        TrcDevice d;
        dev_from_row(&g_rows[idx], &d);
        if (g_cb) { g_cb(&d, g_cbUser); fired = 1; }
    }
    unlock();
    (void)fired;
    cJSON_Delete(j);
}

static DWORD WINAPI listener_thread(LPVOID arg) {
    (void)arg;
    struct sockaddr_in addr;
    int alen = sizeof addr;
    char buf[4096];
    while (!InterlockedCompareExchange(&g_stop, 0, 0)) {
        int n = recvfrom(g_listenSock, buf, sizeof buf, 0,
                         (struct sockaddr*)&addr, &alen);
        if (n == SOCKET_ERROR) {
            if (InterlockedCompareExchange(&g_stop, 0, 0)) break; /* stopping */
            continue; /* timeout */
        }
        char src[64];
        src[0] = '\0';
        if (addr.sin_family == AF_INET) {
            unsigned long a = ntohl(addr.sin_addr.s_addr);
            snprintf(src, sizeof src, "%u.%u.%u.%u",
                     (unsigned)((a >> 24) & 0xff), (unsigned)((a >> 16) & 0xff),
                     (unsigned)((a >> 8) & 0xff), (unsigned)(a & 0xff));
        }
        buf[n] = '\0';
        handle_announce(buf, n, src);
    }
    return 0;
}

/* Collect subnet broadcast addresses for every up, non-loopback IPv4
 * interface (plus the global 255.255.255.255). Sending on each interface
 * keeps discovery working when VPNs/virtual NICs hijack the default route.
 * Returns count written to out[] (capacity maxOut). */
static int collect_broadcasts(unsigned long* out, int maxOut) {
    int n = 0;
    ULONG buflen = 15 * 1024;
    IP_ADAPTER_ADDRESSES* addrs = (IP_ADAPTER_ADDRESSES*)malloc(buflen);
    if (!addrs) return 0;
    ULONG rc = GetAdaptersAddresses(AF_INET, 0, NULL, addrs, &buflen);
    if (rc == ERROR_BUFFER_OVERFLOW) {
        free(addrs);
        addrs = (IP_ADAPTER_ADDRESSES*)malloc(buflen);
        if (!addrs) return 0;
        rc = GetAdaptersAddresses(AF_INET, 0, NULL, addrs, &buflen);
    }
    if (rc == NO_ERROR) {
        for (IP_ADAPTER_ADDRESSES* a = addrs; a && n < maxOut; a = a->Next) {
            if (a->OperStatus != IfOperStatusUp) continue;
            if (a->IfType == IF_TYPE_SOFTWARE_LOOPBACK) continue;
            for (IP_ADAPTER_UNICAST_ADDRESS* u = a->FirstUnicastAddress;
                 u && n < maxOut; u = u->Next) {
                if (u->Address.lpSockaddr->sa_family != AF_INET) continue;
                struct sockaddr_in* si = (struct sockaddr_in*)u->Address.lpSockaddr;
                unsigned long ip = ntohl(si->sin_addr.s_addr);
                unsigned char b1 = (ip >> 24) & 0xff;
                if (b1 == 127 || ip == 0) continue;
                unsigned long mask;
                if (u->OnLinkPrefixLength >= 32) mask = 0xFFFFFFFFUL;
                else if (u->OnLinkPrefixLength <= 0) mask = 0xFFFFFF00UL; /* /24 guess */
                else mask = 0xFFFFFFFFUL << (32 - u->OnLinkPrefixLength);
                unsigned long bcast = (ip & mask) | (~mask & 0xFFFFFFFFUL);
                if (bcast == 0 || bcast == 0xFFFFFFFFUL) continue;
                int dup = 0;
                for (int i = 0; i < n; i++) if (out[i] == bcast) { dup = 1; break; }
                if (!dup) out[n++] = bcast;
            }
        }
    }
    free(addrs);
    return n;
}

static void announce_once(void) {
    if (g_annSock == INVALID_SOCKET) return;
    cJSON* j = cJSON_CreateObject();
    cJSON_AddStringToObject(j, "deviceId", g_selfId);
    cJSON_AddStringToObject(j, "deviceName", g_selfName);
    if (g_selfIp[0]) cJSON_AddStringToObject(j, "ip", g_selfIp);
    cJSON_AddNumberToObject(j, "port", g_servicePort);
    cJSON_AddNumberToObject(j, "ts", (double)now_ms());
    char* text = cJSON_PrintUnformatted(j);
    cJSON_Delete(j);
    if (!text) return;

    unsigned long targets[16];
    int n = collect_broadcasts(targets, 16);
    for (int i = 0; i < n; i++) {
        struct sockaddr_in dst;
        memset(&dst, 0, sizeof dst);
        dst.sin_family = AF_INET;
        dst.sin_port = htons((unsigned short)TRC_DISCOVERY_PORT);
        dst.sin_addr.s_addr = htonl(targets[i]);
        sendto(g_annSock, text, (int)strlen(text), 0,
               (struct sockaddr*)&dst, sizeof dst);
    }
    /* global broadcast as a final fallback */
    {
        struct sockaddr_in dst;
        memset(&dst, 0, sizeof dst);
        dst.sin_family = AF_INET;
        dst.sin_port = htons((unsigned short)TRC_DISCOVERY_PORT);
        dst.sin_addr.s_addr = htonl(INADDR_BROADCAST);
        sendto(g_annSock, text, (int)strlen(text), 0,
               (struct sockaddr*)&dst, sizeof dst);
    }
    free(text);
}

static DWORD WINAPI announcer_thread(LPVOID arg) {
    (void)arg;
    if (g_annSock == INVALID_SOCKET) {
        g_annSock = socket(AF_INET, SOCK_DGRAM, 0);
        if (g_annSock != INVALID_SOCKET) {
            BOOL b = TRUE;
            setsockopt(g_annSock, SOL_SOCKET, SO_BROADCAST, (const char*)&b, sizeof b);
        }
    }
    announce_once();
    while (!InterlockedCompareExchange(&g_stop, 0, 0)) {
        Sleep(TRC_DISC_ANNOUNCE_MS);
        if (InterlockedCompareExchange(&g_stop, 0, 0)) break;
        announce_once();
    }
    return 0;
}

int trc_discovery_start(const char* deviceId, const char* deviceName, int servicePort,
                        TrcDeviceCb cb, void* user) {
    trc_discovery_stop();
    InitializeCriticalSection(&g_lock);
    memset(g_rows, 0, sizeof g_rows);
    InterlockedExchange(&g_stop, 0);
    g_cb = cb;
    g_cbUser = user;
    g_servicePort = (servicePort > 0) ? servicePort : 4000;

    strncpy(g_selfId, deviceId ? deviceId : "transfo-windows", sizeof g_selfId - 1);
    strncpy(g_selfName, deviceName ? deviceName : "Windows",
            sizeof g_selfName - 1);
    char* ip = trc_local_ipv4();
    g_selfIp[0] = '\0';
    if (ip) {
        strncpy(g_selfIp, ip, sizeof g_selfIp - 1);
        free(ip);
    }

    /* listener */
    g_listenSock = socket(AF_INET, SOCK_DGRAM, 0);
    if (g_listenSock == INVALID_SOCKET) { trc_error_set("discovery socket setup failed"); return -1; }
    int reuse = 1;
    setsockopt(g_listenSock, SOL_SOCKET, SO_REUSEADDR, (const char*)&reuse, sizeof reuse);
    DWORD tmo = TRC_DISC_RCVTIMEO_MS;
    setsockopt(g_listenSock, SOL_SOCKET, SO_RCVTIMEO, (const char*)&tmo, sizeof tmo);
    struct sockaddr_in local;
    memset(&local, 0, sizeof local);
    local.sin_family = AF_INET;
    local.sin_port = htons(TRC_DISCOVERY_PORT);
    local.sin_addr.s_addr = htonl(INADDR_ANY);
    if (bind(g_listenSock, (struct sockaddr*)&local, sizeof local) != 0) {
        closesocket(g_listenSock);
        g_listenSock = INVALID_SOCKET;
        trc_error_set("discovery socket setup failed");
        return -1;
    }
    g_listener = CreateThread(NULL, 0, listener_thread, NULL, 0, NULL);
    g_announcer = CreateThread(NULL, 0, announcer_thread, NULL, 0, NULL);
    g_started = 1;
    return 0;
}

int trc_discovery_stop(void) {
    if (!g_started) return 0;
    InterlockedExchange(&g_stop, 1);
    if (g_listenSock != INVALID_SOCKET) {
        closesocket(g_listenSock);
        g_listenSock = INVALID_SOCKET;
    }
    if (g_listener) {
        WaitForSingleObject(g_listener, 3000);
        CloseHandle(g_listener);
        g_listener = NULL;
    }
    if (g_announcer) {
        WaitForSingleObject(g_announcer, 3000);
        CloseHandle(g_announcer);
        g_announcer = NULL;
    }
    if (g_annSock != INVALID_SOCKET) {
        closesocket(g_annSock);
        g_annSock = INVALID_SOCKET;
    }
    g_started = 0;
    DeleteCriticalSection(&g_lock);
    return 0;
}

int trc_discovery_snapshot(TrcDevice* out, int capacity) {
    if (!out || capacity <= 0) return -1;
    int64_t now = now_ms();
    int n = 0;
    lock();
    for (int i = 0; i < TRC_DISC_MAX && n < capacity; ++i) {
        if (g_rows[i].used && (now - g_rows[i].lastSeen) < TRC_DISC_STALE_MS) {
            dev_from_row(&g_rows[i], &out[n]);
            n++;
        }
    }
    unlock();
    return n;
}