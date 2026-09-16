#include <stdio.h>
#include <string.h>
#include "transfo.h"
int main(int argc, char** argv) {
    const char* url = argc > 1 ? argv[1] : "http://localhost:4005/api/auth/register";
    trc_init();
    char* body = NULL; int st = 0;
    int rc = trc_http_post(url, NULL,
        "{\"email\":\"probe-fresh@transfo.local\",\"password\":\"Test1234!\"}",
        &body, &st);
    printf("rc=%d st=%d len=%d body=[%s]\n", rc, st, body ? (int)strlen(body) : 0, body ? body : "(null)");
    trc_free(body);
    return 0;
}
