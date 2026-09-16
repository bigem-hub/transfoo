/* probe.c - minimal HTTP probe to isolate the crash stage. */
#include <stdio.h>
#include <string.h>
#include "transfo.h"

int main(void) {
    printf("step: trc_init\n"); fflush(stdout);
    trc_init();
    char* body = NULL; int st = 0;
    printf("step: http POST register\n"); fflush(stdout);
    int rc = trc_http_post("http://localhost:4000/api/auth/register", NULL,
                           "{\"email\":\"probe-fresh@transfo.local\",\"password\":\"Test1234!\"}",
                           &body, &st);
    printf("rc=%d st=%d len=%d\n", rc, st, body ? (int)strlen(body) : 0);
    if (body) printf("body=%.120s\n", body);
    trc_free(body);
    fflush(stdout);
    printf("done\n"); fflush(stdout);
    return 0;
}