using System.IO;
using System.Windows;
using Transfo.Interop;

namespace Transfo.Desktop;

public partial class App : System.Windows.Application
{
    public static TransfoRuntime Runtime { get; } = new();

    public static AppConfig Config { get; } = new();

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        try { File.AppendAllText(Path.Combine(Path.GetTempPath(), $"transfo-app-{Environment.ProcessId}.log"), "APP UP\n"); } catch { }
        if (!e.Args.Contains("--no-runtime")) Runtime.Init();
        Config.Load();
        new MainWindow().Show();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        try { Runtime.Shutdown(); } catch { /* best-effort */ }
        base.OnExit(e);
    }
}