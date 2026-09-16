/*
 * transfo.h - Public C ABI for the Transfo native core (TransfoCore.dll).
 *
 * Built with MinGW gcc (static runtime), consumed from C# via P/Invoke.
 * All entry points are C-callable (cdecl/x64). Strings are UTF-8 (LPUTF8Str).
 * Memory returned with trc_malloc/trc_http_* is freed with trc_free().
 * Buffers in out-params are caller-allocated.
 */
#ifndef TRANSFO_H
#define TRANSFO_H

#include <stdint.h>

#ifdef _WIN32
#  ifdef TRC_BUILD_DLL
#    define TRC_EXPORT __declspec(dllexport)
#  else
#    define TRC_EXPORT __declspec(dllimport)
#  endif
#else
#  define TRC_EXPORT
#endif

#define TRC_ID_MAX       96
#define TRC_NAME_MAX     256
#define TRC_HOST_MAX     256
#define TRC_ERR_MAX      512
#define TRC_DISCOVERY_PORT 4001   /* fixed by server contract */
#define TRC_DEFAULT_CHUNK 262144  /* 256 KiB, matches server lib/transfer.js */

#ifdef __cplusplus
extern "C" {
#endif

/* ---- Lifecycle ------------------------------------------------------- */

/* One-time init (Winsock, internal tables). Safe to call repeatedly. */
TRC_EXPORT void trc_init(void);
/* Stop all background workers/discovery, release sockets+tables. */
TRC_EXPORT void trc_shutdown(void);
/* Thread-local last error message. Valid until the next call on this thread. */
TRC_EXPORT const char* trc_last_error(void);
/* Free memory returned by the core (trc_http_post body, etc). */
TRC_EXPORT void trc_free(void* p);

/* ---- HTTP primitives ------------------------------------------------- */

/* POST/GET JSON. url like "http://192.168.1.42:4000/api/...". token may be
 * NULL for anonymous routes. On success returns 0 and (*out_body) is malloc'd
 * (trc_free it); *statusCode holds the HTTP status. Returns -1 on network/
 * protocol failure (see trc_last_error). */
TRC_EXPORT int trc_http_post(const char* url, const char* token, const char* json,
                             char** out_body, int* statusCode);
TRC_EXPORT int trc_http_get(const char* url, const char* token,
                            char** out_body, int* statusCode);

/* Stream a GET response body into a file. progress cb (bytes, totalHint, user)
 * fires roughly every 1 MB. Returns 0 on success, -1 on failure. */
typedef void (*TrcIoProgressCb)(long long bytes, long long totalHint, void* user);
TRC_EXPORT int trc_http_download(const char* url, const char* token, const char* destPath,
                                 TrcIoProgressCb progress, void* user);

/* HTTP DELETE (used to release a finished transfer session). */
TRC_EXPORT int trc_http_del(const char* url, const char* token,
                            char** out_body, int* statusCode);

/* ---- Base64 (core's encode/decode, for chunk payloads) ----------------- */

/* Encoded length of n bytes including NUL, for trc_base64_encode's buffer. */
TRC_EXPORT size_t trc_base64_encoded_len(size_t n);
/* NUL-terminated standard base64 of in[0..n). out must hold the len above. */
TRC_EXPORT void trc_base64_encode(const unsigned char* in, size_t n, char* out);
/* Decode len chars of base64 into out. Returns bytes written, or (size_t)-1. */
TRC_EXPORT size_t trc_base64_decode(const char* in, size_t n, unsigned char* out);

/* ---- Discovery (UDP broadcast) --------------------------------------- */

typedef struct TrcDevice {
    char  id[TRC_ID_MAX];
    char  name[TRC_NAME_MAX];
    char  ip[TRC_HOST_MAX];
    int   port;              /* service port the peer announced */
    int64_t lastSeen;        /* millis since epoch of last announce */
} TrcDevice;

/* A peer announced. The pointer is valid only for the duration of the
 * callback; copy the fields you need into your own storage. */
typedef void (*TrcDeviceCb)(const TrcDevice* dev, void* user);

/* Start announcing our {deviceId, deviceName, port} on UDP :4001 every 5 s
 * and listening for peers. Returns 0 on success. id/name are copied. */
TRC_EXPORT int trc_discovery_start(const char* deviceId, const char* deviceName, int servicePort,
                                   TrcDeviceCb cb, void* user);
/* Stop announcement + listener. Idempotent. */
TRC_EXPORT int trc_discovery_stop(void);
/* Fill caller buffer with current known peers. Returns count, or -1. */
TRC_EXPORT int trc_discovery_snapshot(TrcDevice* out, int capacity);

/* ---- Transfer engine -------------------------------------------------- */

/* Async upload of one local file to a server transfer session.
 * baseUrl e.g. "http://192.168.1.42:4000". token = bearer JWT (no "Bearer ").
 * filePath: local path (UTF-8). resume: 1 to continue an interrupted matching
 * session (name+size) from the server's received cursor, else create a new one.
 * On success 0 and *outHandle identifies the operation for cancel/status.
 * cb fires from a background thread: phase 0 started, 1 progress, 2 done,
 * 3 canceled, 4 failed. sessionId/fileName/error are transient. */
typedef void (*TrcTransferCb)(uint64_t handle, int phase,
                              const char* sessionId, const char* fileName,
                              long long transferred, long long total,
                              const char* error, void* user);
TRC_EXPORT int trc_transfer_start(const char* baseUrl, const char* token,
                                  const char* filePath, int resume,
                                  uint64_t* outHandle, TrcTransferCb cb, void* user);
/* Ask a running transfer to stop gracefully at the next chunk boundary. */
TRC_EXPORT int trc_transfer_cancel(uint64_t handle);
/* Current status/counters; returns 0 if handle is known. */
TRC_EXPORT int trc_transfer_status(uint64_t handle, int* outPhase, int* outCode,
                                   long long* outTransferred, long long* outTotal);

/* Async pull of a server session's assembled file into destPath. */
TRC_EXPORT int trc_download_start(const char* baseUrl, const char* token,
                                  const char* sessionId, const char* name,
                                  const char* destPath, uint64_t* outHandle,
                                  TrcTransferCb cb, void* user);
TRC_EXPORT int trc_download_cancel(uint64_t handle);

/* Remove a finished/known operation from internal tables. Call from the
 * terminal progress callback or after you've captured its result. */
TRC_EXPORT int trc_transfer_forget(uint64_t handle);

#ifdef __cplusplus
}
#endif

#endif /* TRANSFO_H */