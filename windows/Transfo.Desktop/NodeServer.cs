using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Net.Sockets;
using System.Threading;

namespace Transfo.Desktop;

/// <summary>
/// Boots the bundled Transfo node server (server.js) as a hidden child process
/// so the desktop app works with zero manual setup: no terminal, no npm, no
/// separate server window. The child is killed when the app exits.
/// Only manages loopback servers; remote/cloud URLs are left alone.
/// </summary>
public sealed class NodeServer : IDisposable
{
    private Process? _child;
    private bool _disposed;

    public int Port { get; private set; }
    public bool OwnsServer { get; private set; }
    public string? NodeExe { get; private set; }
    public string? ServerDir { get; private set; }

    private NodeServer() { }

    /// <summary>
    /// Ensures a Transfo server answers at the configured loopback address.
    /// Updates <paramref name="config"/> in memory to the port actually used.
    /// Never throws: on any failure the app continues and shows offline.
    /// </summary>
    public static NodeServer EnsureFor(AppConfig config)
    {
        var mgr = new NodeServer();
        try
        {
            if (!IsLoopback(config.ServerUrl)) return mgr;

            int want = config.Port > 0 ? config.Port : 4000;
            if (IsPortFree(want) || IsHealthy(want))
            {
                // Free: we will start node here. Healthy: someone (maybe us,
                // maybe the user) already serves Transfo here; reuse it.
                if (IsPortFree(want))
                {
                    if (mgr.TryStart(config, want)) return mgr;
                    // Start failed: fall through to a free port.
                }
                else
                {
                    mgr.Port = want;
                    config.Port = want;
                    return mgr;
                }
            }

            int free = FindFreePort();
            config.Port = free;
            mgr.TryStart(config, free);
            return mgr;
        }
        catch
        {
            return mgr;
        }
    }

    private bool TryStart(AppConfig config, int port)
    {
        try
        {
            string? node = FindNodeExe();
            string? dir = FindServerDir();
            if (node is null || dir is null) return false;

            NodeExe = node;
            ServerDir = dir;

            var psi = new ProcessStartInfo
            {
                FileName = node,
                Arguments = "server.js",
                WorkingDirectory = dir,
                CreateNoWindow = true,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            };
            psi.Environment["PORT"] = port.ToString();

            string logPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Transfo", "server.log");
            try { Directory.CreateDirectory(Path.GetDirectoryName(logPath)!); } catch { }

            var proc = new Process { StartInfo = psi, EnableRaisingEvents = true };
            try
            {
                proc.OutputDataReceived += (_, e) => { if (e.Data is not null) AppendLog(logPath, e.Data); };
                proc.ErrorDataReceived += (_, e) => { if (e.Data is not null) AppendLog(logPath, "ERR " + e.Data); };
            }
            catch { }
            if (!proc.Start()) return false;
            try { proc.BeginOutputReadLine(); } catch { }
            try { proc.BeginErrorReadLine(); } catch { }

            if (!WaitHealthy(port, TimeSpan.FromSeconds(15)))
            {
                try { proc.Kill(entireProcessTree: true); } catch { }
                proc.Dispose();
                return false;
            }

            _child = proc;
            Port = port;
            OwnsServer = true;
            config.ServerUrl = "http://127.0.0.1";
            config.Port = port;
            AppendLog(logPath, $"Transfo desktop started bundled server on 127.0.0.1:{port}");
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static void AppendLog(string path, string line)
    {
        try { File.AppendAllText(path, DateTime.Now.ToString("o") + " " + line + Environment.NewLine); } catch { }
    }

    public static bool IsLoopback(string url)
    {
        try
        {
            var uri = new Uri(url.StartsWith("http", StringComparison.OrdinalIgnoreCase) ? url : "http://" + url);
            string h = uri.Host.ToLowerInvariant();
            return h is "localhost" or "127.0.0.1" or "::1";
        }
        catch
        {
            return false;
        }
    }

    public static string? FindNodeExe()
    {
        try
        {
            string bundled = Path.Combine(AppContext.BaseDirectory, "node", "node.exe");
            if (File.Exists(bundled)) return bundled;
        }
        catch { }
        foreach (var dir in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator))
        {
            try
            {
                string c = Path.Combine(dir.Trim(), "node.exe");
                if (File.Exists(c)) return c;
            }
            catch { }
        }
        try
        {
            string pf = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe");
            if (File.Exists(pf)) return pf;
        }
        catch { }
        return null;
    }

    public static string? FindServerDir()
    {
        try
        {
            string bundled = Path.Combine(AppContext.BaseDirectory, "server", "server.js");
            if (File.Exists(bundled)) return Path.GetDirectoryName(bundled);
        }
        catch { }
        try
        {
            string dev = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, @"..\..\..\..\..\server\server.js"));
            if (File.Exists(dev)) return Path.GetDirectoryName(dev);
        }
        catch { }
        return null;
    }

    public static int FindFreePort()
    {
        var l = new TcpListener(System.Net.IPAddress.Loopback, 0);
        l.Start();
        int port = ((System.Net.IPEndPoint)l.LocalEndpoint).Port;
        l.Stop();
        return port;
    }

    public static bool IsPortFree(int port)
    {
        try
        {
            var l = new TcpListener(System.Net.IPAddress.Loopback, port);
            l.Start();
            l.Stop();
            return true;
        }
        catch
        {
            return false;
        }
    }

    public static bool IsHealthy(int port)
    {
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
            using var resp = http.GetAsync($"http://127.0.0.1:{port}/api/pairing").GetAwaiter().GetResult();
            return resp.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private static bool WaitHealthy(int port, TimeSpan timeout)
    {
        var sw = Stopwatch.StartNew();
        while (sw.Elapsed < timeout)
        {
            if (IsHealthy(port)) return true;
            Thread.Sleep(400);
        }
        return IsHealthy(port);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        try
        {
            if (_child is { HasExited: false })
            {
                try { _child.Kill(entireProcessTree: true); } catch { }
            }
            _child?.Dispose();
        }
        catch { }
    }
}
