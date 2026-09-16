import socket

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(("0.0.0.0", 4005))
s.listen(1)
print("capture listening on :4005", flush=True)
conn, _ = s.accept()
conn.settimeout(1.0)
data = b""
try:
    while True:
        chunk = conn.recv(65536)
        if not chunk:
            break
        data += chunk
except socket.timeout:
    pass
print("=== REQUEST (%d bytes) ===" % len(data), flush=True)
print(repr(data), flush=True)
resp = (b"HTTP/1.1 200 OK\r\n"
        b"Content-Type: application/json\r\n"
        b"Content-Length: 2\r\n"
        b"Connection: close\r\n"
        b"\r\n{}")
conn.sendall(resp)
conn.close()
s.close()
print("=== sent canned response ===", flush=True)