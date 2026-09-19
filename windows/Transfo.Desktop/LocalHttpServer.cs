using System.IO;
using System.Net;
using System.Text;
using System.Threading.Tasks;

namespace Transfo.Desktop;

/// <summary>
/// Minimal HTTP server for serving the WebView2 shell.
/// Uses HttpListener (Windows kernel HTTP stack) - reliable and simple.
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

            var path = req.Url.AbsolutePath;
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