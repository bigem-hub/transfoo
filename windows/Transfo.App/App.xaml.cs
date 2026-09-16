using Microsoft.UI.Xaml;

namespace Transfo.App;

public partial class App : Application
{
    private static MainWindow? s_mainWindow;
    public static MainWindow MainWindow => s_mainWindow ?? throw new InvalidOperationException("MainWindow not initialized.");

    public static void SetMainWindow(MainWindow? w) => s_mainWindow = w;

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        s_mainWindow = new MainWindow();
        s_mainWindow.Activate();
    }
}
