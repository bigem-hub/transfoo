using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Net.Sockets;
using System.Threading;

namespace Transfo.Desktop;

/// <summary>
/// Boots the bundled Transfo node server (server.js) as a hidden child process
/// so LAN discovery, pairing and transfers work with zero manual setup:
/// no terminal, no npm, no separate server window. The child is killed when
/// the app exits. A local server is ALWAYS ensured (it is what LAN peers
/// connect to); the user's configured server URL is only rewritten when it
/// already points at loopback, so cloud settings survive untouched.
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
    /// Ensures a LOCAL Transfo server is answering for LAN peers.
    /// The configured server URL is only rewritten when it already points at
    /// loopback; remote/cloud settings are left untouched. Never throws.
    /// </summary>
    public static NodeServer EnsureFor(AppConfig config)
    {
        var mgr = new NodeServer();
        try
        {
            bool loopback = IsLoopback(config.ServerUrl);
            int want = loopback && config.Port > 0 ? config.Port : 4000;

            // Reuse a healthy server if one already answers here.
            if (!IsPortFree(want) && IsHealthy(want))
            {
                mgr.Port = want;
                if (loopback) config.Port = want;
                return mgr;
            }
            // Start our own child when the port is free.
            if (IsPortFree(want))
            {
                if (mgr.TryStart(config, want, loopback)) return mgr;
            }
            // Otherwise take any free port.
            int free = FindFreePort();
            if (loopback) config.Port = free;
            mgr.TryStart(config, free, loopback);
            return mgr;
        }
        catch
        {
            return mgr;
        }
    }

    private bool TryStart(AppConfig config, int port, bool syncConfig)
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
            if (syncConfig)
            {
                config.ServerUrl = "http://127.0.0.1";
                config.Port = port;
            }
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
