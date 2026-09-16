/* tr_base64.c - self-contained Base64 encode/decode (RFC 4648). */
#include <stddef.h>
#include <stdint.h>
#include "transfo.h"

static const char B64_ENC[] =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static int b64_dec_val(char c) {
    if (c >= 'A' && c <= 'Z') return c - 'A';
    if (c >= 'a' && c <= 'z') return c - 'a' + 26;
    if (c >= '0' && c <= '9') return c - '0' + 52;
    if (c == '+') return 62;
    if (c == '/') return 63;
    return -1;
}

size_t trc_base64_encoded_len(size_t n) {
    return ((n + 2) / 3) * 4 + 1; /* +nul */
}

/* Encodes in[] (n bytes) into out[] (must hold encoded_len(n)); NUL-terminates. */
void trc_base64_encode(const unsigned char* in, size_t n, char* out) {
    size_t i = 0, o = 0;
    while (i + 3 <= n) {
        uint32_t v = ((uint32_t)in[i] << 16) | ((uint32_t)in[i + 1] << 8) | in[i + 2];
        out[o++] = B64_ENC[(v >> 18) & 63];
        out[o++] = B64_ENC[(v >> 12) & 63];
        out[o++] = B64_ENC[(v >> 6) & 63];
        out[o++] = B64_ENC[v & 63];
        i += 3;
    }
    if (i < n) {
        uint32_t v = (uint32_t)in[i] << 16;
        int rem = (int)(n - i);
        if (rem == 2) v |= (uint32_t)in[i + 1] << 8;
        out[o++] = B64_ENC[(v >> 18) & 63];
        out[o++] = B64_ENC[(v >> 12) & 63];
        out[o++] = (rem == 2) ? B64_ENC[(v >> 6) & 63] : '=';
        out[o++] = '=';
    }
    out[o] = '\0';
}

/* Decodes in[] (len n, may contain trailing =) into out[] (must hold
 * floor(n/4)*3 bytes). Returns decoded byte count, or (size_t)-1 on bad input. */
size_t trc_base64_decode(const char* in, size_t n, unsigned char* out) {
    size_t i = 0, o = 0;
    while (i + 4 <= n) {
        int a = b64_dec_val(in[i]);
        int b = b64_dec_val(in[i + 1]);
        int c = in[i + 2] == '=' ? 0 : b64_dec_val(in[i + 2]);
        int d = in[i + 3] == '=' ? 0 : b64_dec_val(in[i + 3]);
        if (a < 0 || b < 0 || (in[i + 2] != '=' && c < 0) || (in[i + 3] != '=' && d < 0))
            return (size_t)-1;
        uint32_t v = ((uint32_t)a << 18) | ((uint32_t)b << 12) | ((uint32_t)c << 6) | (uint32_t)d;
        out[o++] = (unsigned char)(v >> 16);
        if (in[i + 2] != '=') out[o++] = (unsigned char)(v >> 8);
        if (in[i + 3] != '=') out[o++] = (unsigned char)v;
        i += 4;
    }
    return o;
}