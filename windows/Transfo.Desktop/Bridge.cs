using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Windows.Threading;
using Microsoft.Web.WebView2.Core;

namespace Transfo.Desktop;

/// <summary>
/// JSON command bridge between the WebView2 app shell and the native C++ core
/// (via TransfoRuntime). Incoming invoke() calls are answered with {id, ok, data|error}.
/// Engine push events are marshalled onto the WPF dispatcher and posted as
/// {event: "discovery:update"|"transfer:update", data: ...}.
/// </summary>
public sealed class Bridge : IDisposable
{
    private static readonly HttpClient _http = new() { Timeout = TimeSpan.FromMinutes(10) };
    private readonly CoreWebView2 _core;
    private readonly Dispatcher _dispatcher;
    private readonly Transfo.Interop.TransfoRuntime _runtime;
    private readonly Dictionary<ulong, string> _dir = new();

    private readonly object _discoveryLock = new();
    private bool _devicesDirty;

    public Bridge(CoreWebView2 core, Dispatcher dispatcher)
    {
        _core = core;
        _dispatcher = dispatcher;
        _runtime = App.Runtime;
        _runtime.DeviceDiscovered += OnDevice;
        _runtime.TransferUpdate += OnTransfer;
    }

    public void Dispose()
    {
        _runtime.DeviceDiscovered -= OnDevice;
        _runtime.TransferUpdate -= OnTransfer;
    }

    public void OnNavigated()
    {
        PostEvent("host:ready", new { name = "transfo-desktop", version = "1.1.0", desktop = true });
    }

    public void HandleMessage(string? raw)
    {
        string? id = null;
        try
        {
            if (string.IsNullOrWhiteSpace(raw)) return;
            Log("R " + raw);
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            id = GetString(root, "id");
            string cmd = GetString(root, "cmd") ?? "";
            JsonElement args = default;
            if (root.TryGetProperty("args", out var a)) args = a;

            object? data = null;
            switch (cmd)
            {
                case "ping":
                    data = new { name = "transfo-desktop", version = "1.1.0", desktop = true };
                    break;
                case "config.get":
                    data = App.Config.Snapshot;
                    break;
                case "config.set":
                    App.Config.Merge(args);
                    App.Config.Save();
                    data = App.Config.Snapshot;
                    break;
                case "runtime.init":
                    _runtime.Init();
                    break;
                case "runtime.shutdown":
                    _runtime.Shutdown();
                    break;
                case "discovery.start":
                    {
                        int servicePort = GetInt(args, "servicePort", App.Config.Port);
                        _runtime.DeviceId = App.Config.DeviceId;
                        _runtime.DeviceName = App.Config.DeviceName;
                        int rc = _runtime.StartDiscovery(servicePort);
                        if (rc != 0) throw new InvalidOperationException(_runtime.LastError ?? $"discovery failed (rc={rc})");
                    }
                    break;
                case "discovery.stop":
                    _runtime.StopDiscovery();
                    break;
                case "discovery.snapshot":
                    data = _runtime.Snapshot().Select(d => new { d.Id, d.Name, d.Ip, d.Port, LastSeen = d.LastSeen }).ToArray();
                    break;
                case "http":
                    {
                        string method = GetString(args, "method") ?? "GET";
                        string url = GetString(args, "url") ?? "";
                        string? token = GetString(args, "token");
                        string? json = GetString(args, "json");
                        data = SendHttp(method, url, token, json);
                    }
                    break;
                case "transfer.upload":
                    {
                        string url = GetString(args, "baseUrl") ?? "";
                        string token = GetString(args, "token") ?? "";
                        string path = GetString(args, "filePath") ?? "";
                        bool resume = GetBool(args, "resume", true);
                        if (IsHttps(url))
                        {
                            ulong h = (ulong)DateTime.UtcNow.Ticks;
                            _dir[h] = "send";
                            StartHttpUpload(h, url, token, path);
                            data = new { handle = h };
                        }
                        else
                        {
                            ulong handle = _runtime.StartUpload(url, token, path, resume);
                            if (handle == 0) throw new InvalidOperationException(_runtime.LastError ?? "failed to start upload");
                            _dir[handle] = "send";
                            data = new { handle };
                        }
                    }
                    break;
                case "transfer.download":
                    {
                        string url = GetString(args, "baseUrl") ?? "";
                        string token = GetString(args, "token") ?? "";
                        string sessionId = GetString(args, "sessionId") ?? "";
                        string name = GetString(args, "name") ?? "";
                        string dest = GetString(args, "destPath") ?? "";
                        if (IsHttps(url))
                        {
                            ulong h = (ulong)DateTime.UtcNow.Ticks;
                            _dir[h] = "receive";
                            StartHttpDownload(h, url, token, sessionId, name, dest);
                            data = new { handle = h };
                        }
                        else
                        {
                            ulong handle = _runtime.StartDownload(url, token, sessionId, name, dest);
                            if (handle == 0) throw new InvalidOperationException(_runtime.LastError ?? "failed to start download");
                            _dir[handle] = "receive";
                            data = new { handle };
                        }
                    }
                    break;
                case "transfer.cancel":
                    _runtime.Cancel(GetUlong(args, "handle"));
                    break;
                case "transfer.forget":
                    _runtime.Forget(GetUlong(args, "handle"));
                    break;
                case "transfer.status":
                    {
                        var s = _runtime.Status(GetUlong(args, "handle"));
                        data = s is null ? null : new { s.Handle, phase = (int)s.Phase, s.Transferred, s.Total };
                    }
                    break;
                case "dialog.openFiles":
                    data = PickFiles();
                    break;
                case "dialog.openFolder":
                    data = new { path = PickFolder(GetString(args, "title") ?? "Choose a folder") };
                    break;
                default:
                    throw new InvalidOperationException($"unknown command '{cmd}'");
            }

            PostResponse(id, true, data, error: null);
        }
        catch (Exception ex)
        {
            PostResponse(id, false, data: null, ex.Message);
        }
    }

    /* ---- native event marshalling ---- */

    private void OnDevice(Transfo.Interop.DeviceInfo d)
    {
        lock (_discoveryLock) _devicesDirty = true;
        _dispatcher.BeginInvoke(FlushDiscovery);
    }

    private void FlushDiscovery()
    {
        lock (_discoveryLock)
        {
            if (!_devicesDirty) return;
            _devicesDirty = false;
        }
        var devices = _runtime.Snapshot().Select(d => new { d.Id, d.Name, d.Ip, d.Port, LastSeen = d.LastSeen }).ToArray();
        PostEvent("discovery:update", new { devices });
    }

    private void OnTransfer(Transfo.Interop.TransferUpdate u)
    {
        _dispatcher.BeginInvoke(() =>
        {
            _dir.TryGetValue(u.Handle, out var d);
            PostEvent("transfer:update", new
            {
                handle = u.Handle,
                phase = (int)u.Phase,
                sessionId = u.SessionId,
                fileName = u.FileName,
                transferred = u.Transferred,
                total = u.Total,
                error = u.Error,
                dir = d ?? "send",
            });
        });
    }

    /* ---- responses ---- */

    private void PostResponse(string? id, bool ok, object? data, string? error)
    {
        var payload = JsonSerializer.Serialize(ok
            ? new Dictionary<string, object?> { ["type"] = "result", ["id"] = id, ["data"] = data }
            : new Dictionary<string, object?> { ["type"] = "error", ["id"] = id, ["error"] = error ?? "host error" });
        SafePost(payload);
    }

    private void PostEvent(string name, object data)
    {
        var payload = JsonSerializer.Serialize(new Dictionary<string, object?>
        {
            ["type"] = "event",
            ["name"] = name,
            ["data"] = data,
        });
        SafePost(payload);
    }

    private void SafePost(string json)
    {
        if (_core == null) return;
        Log("S " + json);
        try { _core.PostWebMessageAsJson(json); } catch { /* window gone */ }
    }

    private void Log(string line)
    {
        if (_core == null || !Environment.GetCommandLineArgs().Contains("--selftest")) return;
        try { File.AppendAllText(Path.Combine(Path.GetTempPath(), "transfo-bridge.log"), line + Environment.NewLine); } catch { }
    }

    /* ---- HTTP via managed client (HTTPS cloud + native fallback) ---- */

    private static bool IsHttps(string url)
        => url.StartsWith("https://", StringComparison.OrdinalIgnoreCase);

    private object SendHttp(string method, string url, string? token, string? json)
    {
        // Native core has no TLS: route HTTPS through managed HttpClient.
        if (!IsHttps(url))
        {
            int rc = _runtime.Http(method, url, string.IsNullOrEmpty(token) ? null : token, string.IsNullOrEmpty(json) ? null : json, out string? nativeBody, out int nativeStatus);
            if (rc == 0 && nativeStatus > 0) return new { status = nativeStatus, body = nativeBody };
        }
        try
        {
            using var req = new HttpRequestMessage(new HttpMethod(method), url);
            if (!string.IsNullOrEmpty(token))
                req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            if (!string.IsNullOrEmpty(json) && (method == "POST" || method == "PUT" || method == "PATCH"))
                req.Content = new StringContent(json, Encoding.UTF8, "application/json");
            using var resp = _http.Send(req);
            int status = (int)resp.StatusCode;
            string respBody = new StreamReader(resp.Content.ReadAsStream()).ReadToEnd();
            return new { status, body = respBody };
        }
        catch (Exception ex)
        {
            return new { status = 0, body = (string?)null, error = ex.Message };
        }
    }

    private void StartHttpUpload(ulong handle, string baseUrl, string token, string path)
    {
        Task.Run(async () =>
        {
            try
            {
                var fi = new FileInfo(path);
                if (!fi.Exists) throw new FileNotFoundException("File not found: " + path);
                long total = fi.Length;
                string fileName = fi.Name;
                const int chunkSize = 262144;
                PostTransferEvent(handle, 0, "", fileName, 0, total, null, "send");

                var createObj = new { name = fileName, size = total, chunkSize };
                using var createReq = new HttpRequestMessage(HttpMethod.Post, baseUrl.TrimEnd('/') + "/api/transfer/sessions")
                {
                    Content = new StringContent(JsonSerializer.Serialize(createObj), Encoding.UTF8, "application/json")
                };
                if (!string.IsNullOrEmpty(token)) createReq.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
                using var createResp = await _http.SendAsync(createReq).ConfigureAwait(false);
                createResp.EnsureSuccessStatusCode();
                using var sessDoc = JsonDocument.Parse(await createResp.Content.ReadAsStringAsync().ConfigureAwait(false));
                string sessionId = sessDoc.RootElement.GetProperty("id").GetString() ?? "";

                await using var fs = File.OpenRead(path);
                byte[] buf = new byte[chunkSize];
                int index = 0;
                long transferred = 0;
                while (true)
                {
                    int read = await fs.ReadAsync(buf, 0, buf.Length).ConfigureAwait(false);
                    if (read <= 0) break;
                    var chunkObj = new { index, offset = transferred, data = Convert.ToBase64String(buf, 0, read) };
                    using var chunkReq = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl.TrimEnd('/')}/api/transfer/sessions/{sessionId}/chunk")
                    {
                        Content = new StringContent(JsonSerializer.Serialize(chunkObj), Encoding.UTF8, "application/json")
                    };
                    if (!string.IsNullOrEmpty(token)) chunkReq.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
                    using var chunkResp = await _http.SendAsync(chunkReq).ConfigureAwait(false);
                    chunkResp.EnsureSuccessStatusCode();
                    transferred += read;
                    index++;
                    PostTransferEvent(handle, transferred >= total ? 2 : 1, sessionId, fileName, transferred, total, null, "send");
                }
                if (total == 0) PostTransferEvent(handle, 2, sessionId, fileName, 0, 0, null, "send");
            }
            catch (Exception ex)
            {
                PostTransferEvent(handle, 4, "", Path.GetFileName(path), 0, 0, ex.Message, "send");
            }
        });
    }

    private void StartHttpDownload(ulong handle, string baseUrl, string token, string sessionId, string name, string dest)
    {
        Task.Run(async () =>
        {
            try
            {
                string outPath = Directory.Exists(dest) ? Path.Combine(dest, name) : dest;
                PostTransferEvent(handle, 0, sessionId, name, 0, 0, null, "receive");
                using var req = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl.TrimEnd('/')}/api/transfer/sessions/{sessionId}/pull");
                if (!string.IsNullOrEmpty(token)) req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
                using var resp = await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead).ConfigureAwait(false);
                resp.EnsureSuccessStatusCode();
                long total = resp.Content.Headers.ContentLength ?? 0;
                await using var inStream = await resp.Content.ReadAsStreamAsync().ConfigureAwait(false);
                Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(outPath))!);
                await using var outStream = File.Create(outPath);
                byte[] buf = new byte[65536];
                long transferred = 0;
                int read;
                while ((read = await inStream.ReadAsync(buf, 0, buf.Length).ConfigureAwait(false)) > 0)
                {
                    await outStream.WriteAsync(buf, 0, read).ConfigureAwait(false);
                    transferred += read;
                    PostTransferEvent(handle, 1, sessionId, name, transferred, total, null, "receive");
                }
                PostTransferEvent(handle, 2, sessionId, name, transferred, total, null, "receive");
            }
            catch (Exception ex)
            {
                PostTransferEvent(handle, 4, sessionId, name, 0, 0, ex.Message, "receive");
            }
        });
    }

    private void PostTransferEvent(ulong handle, int phase, string sessionId, string fileName, long transferred, long total, string? error, string dir)
    {
        _dispatcher.BeginInvoke(() => PostEvent("transfer:update", new
        {
            handle,
            phase,
            sessionId,
            fileName,
            transferred,
            total,
            error,
            dir
        }));
    }

    /* ---- native dialogs (UI thread) ---- */

    private object? PickFiles()
    {
        var dlg = new Microsoft.Win32.OpenFileDialog { Multiselect = true, Title = "Choose files to send" };
        var owner = System.Windows.Application.Current.Windows.OfType<System.Windows.Window>().FirstOrDefault(w => w.IsActive);
        bool? ok = owner is null ? dlg.ShowDialog() : dlg.ShowDialog(owner);
        if (ok != true) return new { paths = Array.Empty<object>() };
        var paths = dlg.FileNames
            .Select(p => new { name = Path.GetFileName(p), path = p, size = new FileInfo(p).Length })
            .ToArray();
        return new { paths };
    }

    private string? PickFolder(string title)
    {
        using var dlg = new System.Windows.Forms.FolderBrowserDialog { Description = title, UseDescriptionForTitle = true };
        return dlg.ShowDialog() == System.Windows.Forms.DialogResult.OK ? dlg.SelectedPath : null;
    }

    /* ---- tiny JSON helpers ---- */

    private static string? GetString(JsonElement e, string name)
        => e.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() : null;

    private static int GetInt(JsonElement e, string name, int fallback)
        => e.TryGetProperty(name, out var p) && p.TryGetInt32(out int v) ? v : fallback;

    private static ulong GetUlong(JsonElement e, string name)
        => e.TryGetProperty(name, out var p) && p.TryGetUInt64(out ulong v) ? v : 0;

    private static bool GetBool(JsonElement e, string name, bool fallback)
    {
        if (e.TryGetProperty(name, out var p) && p.ValueKind is JsonValueKind.True or JsonValueKind.False)
            return p.ValueKind == JsonValueKind.True;
        return fallback;
    }
}