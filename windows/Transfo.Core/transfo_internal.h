/* transfo_internal.h - shared internal declarations. */
#ifndef TRANSFO_INTERNAL_H
#define TRANSFO_INTERNAL_H

#include <stdint.h>
#include <wchar.h>

/* tr_base64.c */
size_t trc_base64_encoded_len(size_t n);
void trc_base64_encode(const unsigned char* in, size_t n, char* out);
size_t trc_base64_decode(const char* in, size_t n, unsigned char* out);

/* tr_util.c */
wchar_t* trc_utf8_to_wide(const char* s);
char* trc_wide_to_utf8(const wchar_t* w);
const char* trc_path_basename(const char* path);
char* trc_local_ipv4(void);
int trc_split_url(const char* url, char* host, int hostCap, int* port, char* path, int pathCap);
void trc_error_set(const char* fmt, ...);
const char* trc_last_error(void);
void trc_free(void* p);

/* tr_http.c */
int trc_http_init(void);          /* Winsock start */
void trc_http_cleanup(void);      /* Winsock stop */
int trc_http_del(const char* url, const char* token, char** out_body, int* statusCode);

/* tr_transfer.c */
void xfer_tbl_init(void);

#endif /* TRANSFO_INTERNAL_H */