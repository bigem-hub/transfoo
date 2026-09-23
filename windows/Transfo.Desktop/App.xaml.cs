using System.IO;
using System.Windows;
using Transfo.Interop;

namespace Transfo.Desktop;

public partial class App : System.Windows.Application
{
    public static TransfoRuntime Runtime { get; } = new();

    public static AppConfig Config { get; } = new();

    public static NodeServer? Server { get; private set; }

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        try { File.AppendAllText(Path.Combine(Path.GetTempPath(), $"transfo-app-{Environment.ProcessId}.log"), "APP UP\n"); } catch { }
        if (!e.Args.Contains("--no-runtime")) Runtime.Init();
        Config.Load();
        // Zero-setup: boot the bundled node server for loopback configs.
        // Remote/cloud URLs are left alone. Use --no-server to skip (dev).
        if (!e.Args.Contains("--no-server")) Server = NodeServer.EnsureFor(Config);
        new MainWindow().Show();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        try { Server?.Dispose(); } catch { /* best-effort */ }
        try { Runtime.Shutdown(); } catch { /* best-effort */ }
        base.OnExit(e);
    }
}