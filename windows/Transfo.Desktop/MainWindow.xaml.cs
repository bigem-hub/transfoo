using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using Microsoft.Web.WebView2.Core;

namespace Transfo.Desktop;

public partial class MainWindow : Window
{
    private Bridge? _bridge;
    private LocalHttpServer? _server;

    public MainWindow()
    {
        InitializeComponent();
        SourceInitialized += OnSourceInitialized;
        Loaded += async (_, _) => await InitWebViewAsync();
    }

    private void OnSourceInitialized(object? sender, EventArgs e)
    {
        var hwnd = new WindowInteropHelper(this).Handle;
        if (hwnd == IntPtr.Zero) return;
        var dpi = DwmGetWindowAttribute(hwnd, DwmWindowAttribute.DwmwaUseImmersiveDarkMode, out int value, Marshal.SizeOf<int>());
        if (dpi != 0) value = 1;
        value = 1;
        DwmSetWindowAttribute(hwnd, DwmWindowAttribute.DwmwaUseImmersiveDarkMode, ref value, Marshal.SizeOf<int>());
    }

    private async Task InitWebViewAsync()
    {
        try
        {
            var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(AppDataPath(), "WebView2"), null);
            await Web.EnsureCoreWebView2Async(env);

            // Web shell is embedded in the exe; no loose dist folder needed.
            _server = new LocalHttpServer(Path.Combine(AppContext.BaseDirectory, "dist"));

            _bridge = new Bridge(Web.CoreWebView2, Web.Dispatcher);
            Web.CoreWebView2.WebMessageReceived += Bridge_WebMessageReceived;
            Web.CoreWebView2.NavigationCompleted += Bridge_NavigationCompleted;

            Web.CoreWebView2.Navigate($"http://127.0.0.1:{_server.Port}/app.html");
        }
        catch (Exception ex)
        {
            Log("INIT FAILED " + ex);
        }
    }

    private void Log(string line)
    {
        if (!Environment.GetCommandLineArgs().Contains("--selftest")) return;
        try { File.AppendAllText(Path.Combine(Path.GetTempPath(), $"transfo-bridge-{Environment.ProcessId}.log"), line + Environment.NewLine); } catch { }
    }

    private void Bridge_NavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        if (e.IsSuccess)
        {
            _bridge?.OnNavigated();
            if (Environment.GetCommandLineArgs().Contains("--selftest")) _ = RunSelfTestAsync();
        }
    }

    private async Task RunSelfTestAsync()
    {
        try
        {
            await Task.Delay(15000);
            // Round-trip probe: page -> host -> page for every button-grade
            // command. Each entry must resolve, not time out.
            await Web.CoreWebView2.ExecuteScriptAsync(
                "(function(){ window.__rt = {}; var seq = 987000;" +
                " var cmds = ['ping', 'config.get', 'discovery.start', 'discovery.snapshot', 'discovery.stop'];" +
                " function h(e){ var m = (typeof e.data === 'string') ? JSON.parse(e.data) : e.data;" +
                " if (m && (m.type === 'result' || m.type === 'error') && m.id >= 987000 && m.id < 987100)" +
                " { window.__rt[m.id] = m.type + ':' + JSON.stringify(m.data !== undefined ? m.data : m.error).slice(0, 120); } }" +
                " window.chrome.webview.addEventListener('message', h);" +
                " cmds.forEach(function(c, i){ window.chrome.webview.postMessage({ id: 987000 + i, cmd: c, args: {} }); }); })()");
            await Task.Delay(4000);
            string rt = await Web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__rt || 'no-channel')");
            Log("ROUNDTRIP " + rt);
            // Discovery probe: start the native UDP listener, wait past one
            // 5 s announce tick, then snapshot. Any live peer (or our own
            // reflected traffic) proves the native receive path.
            await Web.CoreWebView2.ExecuteScriptAsync(
                "(function(){ window.__disc = 'pending'; var base = 988000;" +
                " function h(e){ var m = (typeof e.data === 'string') ? JSON.parse(e.data) : e.data;" +
                " if (m && m.id === base + 2 && (m.type === 'result' || m.type === 'error'))" +
                " { window.__disc = m.type + ':' + JSON.stringify(m.data !== undefined ? m.data : m.error).slice(0, 400); } }" +
                " window.chrome.webview.addEventListener('message', h);" +
                " window.chrome.webview.postMessage({ id: base, cmd: 'discovery.start', args: {} });" +
                " setTimeout(function(){ window.chrome.webview.postMessage({ id: base + 2, cmd: 'discovery.snapshot', args: {} }); }, 7000);" +
                " setTimeout(function(){ window.chrome.webview.postMessage({ id: base + 3, cmd: 'discovery.stop', args: {} }); }, 9000);" +
                " })()");
            await Task.Delay(11000);
            string disc = await Web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__disc || 'no-channel')");
            Log("DISCOVERY " + disc);
            string json = await Web.CoreWebView2.ExecuteScriptAsync(
                "JSON.stringify({title: document.title, preview: !(window.chrome && window.chrome.webview), " +
                "roundtrip: window.__rt || 'no-channel', " +
                "discovery: window.__disc || 'no-channel', " +
                "text: document.body ? document.body.innerText.slice(0, 4000) : ''})");
            var dir = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            var png = Path.Combine(dir, "transfo-selftest.png");
            using var fs = File.Create(png);
            await Web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, fs);
            File.WriteAllText(Path.Combine(dir, "transfo-selftest.json"), json);
            Console.WriteLine("SELFTEST " + json);
            System.Windows.Application.Current.Shutdown();
        }
        catch (Exception ex)
        {
            Console.WriteLine("SELFTEST FAILED " + ex);
        }
    }

    private void Bridge_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        // The shell posts objects ({id, cmd, args}), not strings, so read the
        // JSON form. TryGetWebMessageAsString throws for non-string payloads,
        // which silently dropped every page->host message.
        string json;
        try { json = e.WebMessageAsJson; }
        catch { return; }
        _bridge?.HandleMessage(json);
    }

    protected override void OnClosed(EventArgs e)
    {
        _server?.Dispose();
        _bridge?.Dispose();
        base.OnClosed(e);
    }

    private static string AppDataPath()
    {
        var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Transfo");
        Directory.CreateDirectory(dir);
        return dir;
    }

    [DllImport("dwmapi.dll", PreserveSig = true)]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, DwmWindowAttribute attribute, ref int value, int size);

    [DllImport("dwmapi.dll", PreserveSig = true)]
    private static extern int DwmGetWindowAttribute(IntPtr hwnd, DwmWindowAttribute attribute, out int value, int size);

    private enum DwmWindowAttribute
    {
        DwmwaUseImmersiveDarkMode = 20,
    }
}