using System.Collections.Concurrent;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
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

    public int Port { get; }

    public LocalHttpServer(string root)
    {
        _root = Path.GetFullPath(root);
        _listener = new HttpListener();
        _listener.Prefixes.Add("http://0.0.0.0:0/");
        _listener.Start();
        // Extract port from the prefix we registered
        Port = int.Parse(_listener.Prefixes.First().Split(':').Last().TrimEnd('/'));
        _ = RunAsync();
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
            using (var stream = ctx.Response.OutputStream)
            {
                byte[] buf = new byte[8192];
                int read = ReadHead(ctx.Request.InputStream, buf);
                if (read <= 0) return;

                string head = Encoding.ASCII.GetString(buf, 0, read);
                var parts = head.Split("\r\n")[0].Split(' ');
                string method = parts.Length > 0 ? parts[0] : "";
                string path = parts.Length > 1 ? parts[1] : "/";
                if (method != "GET" && method != "HEAD")
                {
                    WriteResponse(ctx.Response, 405, "text/plain", Encoding.UTF8.GetBytes("method not allowed"), false);
                    return;
                }

                bool ok = TryResolve(path, out string? full, out string? mime, out string? error);
                if (!ok)
                {
                    WriteResponse(ctx.Response, mime?.StartsWith("text/") == true ? 200 : 404, mime ?? "text/plain", Encoding.UTF8.GetBytes(error ?? "not found"), false);
                    return;
                }

                byte[] body = await File.ReadAllBytesAsync(full!).ConfigureAwait(false);
                ctx.Response.ContentType = mime;
                ctx.Response.ContentLength64 = body.Length;
                ctx.Response.StatusCode = 200;
                await ctx.Response.OutputStream.WriteAsync(body).ConfigureAwait(false);
                await ctx.Response.OutputStream.FlushAsync().ConfigureAwait(false);
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("LocalHttpServer error: " + ex.Message);
        }
    }

    private bool TryResolve(string path, out string? full, out string? mime, out string? error)
    {
        full = null; mime = null; error = null;
        string rel = path.Split('?')[0].Split('#')[0].TrimStart('/');
        if (string.IsNullOrEmpty(rel) || rel.EndsWith("/")) rel += "app.html";
        rel = Uri.UnescapeDataString(rel);

        string candidate = Path.GetFullPath(Path.Combine(_root, rel.Replace('/', Path.DirectorySeparatorChar)));
        if (!candidate.StartsWith(_root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) && candidate != _root)
        {
            error = "forbidden";
            return false;
        }
        if (File.Exists(candidate))
        {
            full = candidate;
            mime = MimeFor(candidate);
            return true;
        }
        // SPA-ish fallback to the shell for unknown paths (keeps deep links working)
        string fallback = Path.Combine(_root, "app.html");
        if (File.Exists(fallback))
        {
            full = fallback;
            mime = "text/html; charset=utf-8";
            return true;
        }
        error = "not found";
        return false;
    }

    private static string MimeFor(string file) => Path.GetExtension(file).ToLowerInvariant() switch
    {
        ".html" or ".htm" => "text/html; charset=utf-8",
        ".js" or ".mjs" => "text/javascript; charset=utf-8",
        ".css" => "text/css; charset=utf-8",
        ".svg" => "image/svg+xml",
        ".png" => "image/png",
        ".ico" => "image/x-icon",
        ".json" => "application/json; charset=utf-8",
        ".txt" => "text/plain; charset=utf-8",
        ".xml" => "application/xml",
        ".webmanifest" => "application/manifest+json",
        ".woff2" => "font/woff2",
        ".wasm" => "application/wasm",
        _ => "application/octet-stream",
    };

    private static int ReadHead(Stream stream, byte[] buf)
    {
        int total = 0;
        while (total < buf.Length)
        {
            int n = stream.Read(buf, total, buf.Length - total);
            if (n <= 0) return total;
            total += n;
            if (total >= 4)
            {
                for (int i = Math.Max(0, total - 128); i < total - 1; i++)
                {
                    if (buf[i] == '\n' && buf[i + 1] == '\r' && i + 3 < total && buf[i + 2] == '\n' && buf[i + 3] == '\r') return total;
                    if (buf[i] == '\n' && i + 1 < total && buf[i + 1] == '\n') return total;
                }
            }
        }
        return total;
    }

    private static void WriteResponse(HttpListenerResponse res, int status, string contentType, byte[] body, bool headOnly)
    {
        string reason = status switch { 200 => "OK", 404 => "Not Found", 405 => "Method Not Allowed", _ => "OK" };
        var header = Encoding.ASCII.GetBytes(
            $"HTTP/1.1 {status} {reason}\r\n" +
            $"Content-Type: {contentType}\r\n" +
            $"Content-Length: {body.Length}\r\n" +
            $"Cache-Control: no-store\r\n" +
            "Connection: close\r\n\r\n");
        var outStream = res.OutputStream;
        outStream.Write(header, 0, header.Length);
        if (!headOnly) outStream.Write(body, 0, body.Length);
        outStream.Flush();
    }

    public void Dispose()
    {
        try { _listener.Stop(); } catch { }
    }
}