using System.Collections.Concurrent;
using System.IO;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace Transfo.Desktop;

/// <summary>
/// Minimal HTTP server for serving the WebView2 shell and providing built-in
/// local API endpoints (auth, pairing, chunked transfer) when running standalone.
/// </summary>
public sealed class LocalHttpServer : IDisposable
{
    private readonly HttpListener _listener;
    private readonly string _root;
    private readonly CancellationTokenSource _cts = new();
    private readonly Task _runTask;
    private readonly string _transferRoot;

    private readonly ConcurrentDictionary<string, (long created, string name)> _pairCache = new();

    private sealed class LocalSession
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "file";
        public long Size { get; set; }
        public int ChunkSize { get; set; } = 262144;
        public long Received { get; set; }
        public bool Done { get; set; }
        public string Dir { get; set; } = "";
    }
    private readonly ConcurrentDictionary<string, LocalSession> _sessions = new();

    public int Port { get; }

    public LocalHttpServer(string root)
    {
        _root = Path.GetFullPath(root);
        _transferRoot = Path.Combine(Path.GetTempPath(), "transfo-transfers");
        Directory.CreateDirectory(_transferRoot);

        // Find a free port
        var tcpListener = new System.Net.Sockets.TcpListener(System.Net.IPAddress.Loopback, 0);
        tcpListener.Start();
        int port = ((System.Net.IPEndPoint)tcpListener.LocalEndpoint).Port;
        tcpListener.Stop();

        _listener = new HttpListener();
        _listener.Prefixes.Add($"http://127.0.0.1:{port}/");
        _listener.Start();
        Port = port;
        _runTask = RunAsync();
    }

    private async Task RunAsync()
    {
        while (!_cts.IsCancellationRequested)
        {
            HttpListenerContext ctx;
            try { ctx = await _listener.GetContextAsync().ConfigureAwait(false); }
            catch { return; }
            _ = Task.Run(() => HandleAsync(ctx));
        }
    }

    private async Task HandleAsync(HttpListenerContext ctx)
    {
        try
        {
            var req = ctx.Request;
            var res = ctx.Response;

            res.Headers.Add("Access-Control-Allow-Origin", "*");
            res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            res.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

            if (req.HttpMethod == "OPTIONS")
            {
                res.StatusCode = 204;
                res.Close();
                return;
            }

            var path = req.Url?.AbsolutePath ?? "/";
            if (path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase))
            {
                await HandleApiAsync(req, res, path).ConfigureAwait(false);
                return;
            }

            if (string.IsNullOrEmpty(path) || path == "/") path = "/app.html";
            path = path.TrimStart('/');

            var fullPath = Path.GetFullPath(Path.Combine(_root, path.Replace('/', Path.DirectorySeparatorChar)));
            if (!fullPath.StartsWith(_root + Path.DirectorySeparatorChar) && fullPath != _root)
            {
                Respond(res, 403, "Forbidden");
                return;
            }

            if (!File.Exists(fullPath))
            {
                // SPA fallback
                var fallback = Path.Combine(_root, "app.html");
                if (File.Exists(fallback)) fullPath = fallback;
                else { Respond(res, 404, "Not Found"); return; }
            }

            var ext = Path.GetExtension(fullPath).ToLowerInvariant();
            var mime = ext switch
            {
                ".html" => "text/html; charset=utf-8",
                ".js" => "text/javascript; charset=utf-8",
                ".css" => "text/css; charset=utf-8",
                ".svg" => "image/svg+xml",
                ".png" => "image/png",
                ".ico" => "image/x-icon",
                ".json" => "application/json",
                ".woff2" => "font/woff2",
                _ => "application/octet-stream"
            };

            var bytes = await File.ReadAllBytesAsync(fullPath);
            res.ContentType = mime;
            res.ContentLength64 = bytes.Length;
            res.StatusCode = 200;
            await res.OutputStream.WriteAsync(bytes);
            await res.OutputStream.FlushAsync();
        }
        catch
        {
            // Ignore client disconnects
        }
        finally
        {
            ctx.Response.Close();
        }
    }

    private async Task HandleApiAsync(HttpListenerRequest req, HttpListenerResponse res, string path)
    {
        string method = req.HttpMethod;
        string body = "";
        if (req.HasEntityBody)
        {
            using var reader = new StreamReader(req.InputStream, req.ContentEncoding);
            body = await reader.ReadToEndAsync().ConfigureAwait(false);
        }

        if (path.Equals("/api/auth/login", StringComparison.OrdinalIgnoreCase) ||
            path.Equals("/api/auth/register", StringComparison.OrdinalIgnoreCase))
        {
            RespondJson(res, 200, JsonSerializer.Serialize(new { token = "token-" + Guid.NewGuid().ToString("N") }));
            return;
        }

        if (path.Equals("/api/pairing", StringComparison.OrdinalIgnoreCase))
        {
            if (method == "GET")
            {
                RespondJson(res, 200, JsonSerializer.Serialize(new { pairing = "ready", endpoint = "/api/pairing" }));
                return;
            }
            if (method == "POST")
            {
                string deviceName = "Unknown";
                try
                {
                    if (!string.IsNullOrEmpty(body))
                    {
                        using var doc = JsonDocument.Parse(body);
                        if (doc.RootElement.TryGetProperty("deviceName", out var n))
                            deviceName = n.GetString() ?? "Unknown";
                    }
                }
                catch { }
                string code = new Random().Next(100000, 999999).ToString();
                _pairCache[code] = (DateTimeOffset.UtcNow.ToUnixTimeSeconds(), deviceName);
                RespondJson(res, 200, JsonSerializer.Serialize(new { code, deviceName, expiresIn = "5m", authorize = "/api/pairing/authorize" }));
                return;
            }
        }

        if (path.Equals("/api/pairing/authorize", StringComparison.OrdinalIgnoreCase) && method == "POST")
        {
            string code = "";
            try
            {
                if (!string.IsNullOrEmpty(body))
                {
                    using var doc = JsonDocument.Parse(body);
                    if (doc.RootElement.TryGetProperty("code", out var c))
                        code = c.GetString() ?? "";
                }
            }
            catch { }
            string devName = "Device";
            if (!string.IsNullOrEmpty(code) && _pairCache.TryRemove(code, out var entry)) devName = entry.name;
            RespondJson(res, 200, JsonSerializer.Serialize(new
            {
                paired = true,
                deviceName = devName,
                token = "paired-" + Guid.NewGuid().ToString("N"),
                pairedAt = DateTime.UtcNow.ToString("o")
            }));
            return;
        }

        if (path.StartsWith("/api/pairing/", StringComparison.OrdinalIgnoreCase) && method == "DELETE")
        {
            RespondJson(res, 200, JsonSerializer.Serialize(new { revoked = true }));
            return;
        }

        if (path.Equals("/api/transfer/sessions", StringComparison.OrdinalIgnoreCase))
        {
            if (method == "POST")
            {
                string name = "file";
                long size = 0;
                int chunkSize = 262144;
                try
                {
                    if (!string.IsNullOrEmpty(body))
                    {
                        using var doc = JsonDocument.Parse(body);
                        var r = doc.RootElement;
                        if (r.TryGetProperty("name", out var np)) name = np.GetString() ?? "file";
                        if (r.TryGetProperty("size", out var sp)) size = sp.GetInt64();
                        if (r.TryGetProperty("chunkSize", out var cp)) chunkSize = cp.GetInt32();
                    }
                }
                catch { }
                string id = Guid.NewGuid().ToString("N");
                string dir = Path.Combine(_transferRoot, id);
                Directory.CreateDirectory(dir);
                int totalChunks = size > 0 ? (int)Math.Ceiling((double)size / chunkSize) : 0;
                _sessions[id] = new LocalSession { Id = id, Name = name, Size = size, ChunkSize = chunkSize, Dir = dir };
                RespondJson(res, 201, JsonSerializer.Serialize(new { id, chunkSize, totalChunks, name, size }));
                return;
            }
            if (method == "GET")
            {
                var list = _sessions.Values.Select(s => new { id = s.Id, name = s.Name, size = s.Size, received = s.Received, done = s.Done }).ToArray();
                RespondJson(res, 200, JsonSerializer.Serialize(list));
                return;
            }
        }

        if (path.StartsWith("/api/transfer/sessions/", StringComparison.OrdinalIgnoreCase) && path.EndsWith("/chunk", StringComparison.OrdinalIgnoreCase) && method == "POST")
        {
            string[] parts = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
            string id = parts.Length >= 4 ? parts[3] : "";
            if (_sessions.TryGetValue(id, out var sess))
            {
                int index = 0;
                string b64 = "";
                try
                {
                    if (!string.IsNullOrEmpty(body))
                    {
                        using var doc = JsonDocument.Parse(body);
                        var r = doc.RootElement;
                        if (r.TryGetProperty("index", out var ip)) index = ip.GetInt32();
                        if (r.TryGetProperty("data", out var dp)) b64 = dp.GetString() ?? "";
                    }
                }
                catch { }
                byte[] chunkBytes = Convert.FromBase64String(b64);
                await File.WriteAllBytesAsync(Path.Combine(sess.Dir, $"{index}.bin"), chunkBytes).ConfigureAwait(false);
                sess.Received += chunkBytes.Length;
                if (sess.Size > 0 && sess.Received >= sess.Size) sess.Done = true;
                RespondJson(res, 200, JsonSerializer.Serialize(new { id = sess.Id, received = sess.Received, size = sess.Size, done = sess.Done }));
                return;
            }
            RespondJson(res, 404, JsonSerializer.Serialize(new { error = "session not found" }));
            return;
        }

        if (path.StartsWith("/api/transfer/sessions/", StringComparison.OrdinalIgnoreCase) && path.EndsWith("/pull", StringComparison.OrdinalIgnoreCase) && method == "GET")
        {
            string[] parts = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
            string id = parts.Length >= 4 ? parts[3] : "";
            if (_sessions.TryGetValue(id, out var sess))
            {
                var files = Directory.GetFiles(sess.Dir, "*.bin")
                    .Select(f => (path: f, idx: int.TryParse(Path.GetFileNameWithoutExtension(f), out int n) ? n : -1))
                    .Where(x => x.idx >= 0)
                    .OrderBy(x => x.idx)
                    .Select(x => x.path)
                    .ToArray();
                res.ContentType = "application/octet-stream";
                res.Headers.Add("Content-Disposition", $"attachment; filename=\"{sess.Name}\"");
                res.StatusCode = 200;
                foreach (var f in files)
                {
                    byte[] b = await File.ReadAllBytesAsync(f).ConfigureAwait(false);
                    await res.OutputStream.WriteAsync(b).ConfigureAwait(false);
                }
                await res.OutputStream.FlushAsync().ConfigureAwait(false);
                return;
            }
            RespondJson(res, 404, JsonSerializer.Serialize(new { error = "session not found" }));
            return;
        }

        if (path.StartsWith("/api/transfer/sessions/", StringComparison.OrdinalIgnoreCase))
        {
            string[] parts = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
            string id = parts.Length >= 4 ? parts[3] : "";
            if (_sessions.TryGetValue(id, out var sess))
            {
                if (method == "GET")
                {
                    RespondJson(res, 200, JsonSerializer.Serialize(new
                    {
                        id = sess.Id,
                        name = sess.Name,
                        size = sess.Size,
                        received = sess.Received,
                        done = sess.Done,
                        chunkSize = sess.ChunkSize
                    }));
                    return;
                }
                if (method == "DELETE")
                {
                    _sessions.TryRemove(id, out _);
                    try { Directory.Delete(sess.Dir, true); } catch { }
                    RespondJson(res, 200, JsonSerializer.Serialize(new { removed = true }));
                    return;
                }
            }
        }

        RespondJson(res, 200, JsonSerializer.Serialize(new { ok = true, path }));
    }

    private static void RespondJson(HttpListenerResponse res, int code, string json)
    {
        var bytes = Encoding.UTF8.GetBytes(json);
        res.StatusCode = code;
        res.ContentType = "application/json; charset=utf-8";
        res.ContentLength64 = bytes.Length;
        res.OutputStream.Write(bytes);
        res.Close();
    }

    private static void Respond(HttpListenerResponse res, int code, string msg)
    {
        var bytes = Encoding.UTF8.GetBytes(msg);
        res.StatusCode = code;
        res.ContentType = "text/plain";
        res.ContentLength64 = bytes.Length;
        res.OutputStream.Write(bytes);
        res.Close();
    }

    public void Dispose()
    {
        _cts.Cancel();
        try { _listener.Stop(); } catch { }
    }
}