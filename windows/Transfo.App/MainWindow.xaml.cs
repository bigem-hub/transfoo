using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Transfo.App;

public sealed partial class MainWindow : Window
{
    public MainWindow()
    {
        this.InitializeComponent();
        this.Activate();
        ContentFrame.Navigate(typeof(Views.HomePage));
    }

    private void Nav_SelectionChanged(NavigationView sender, NavigationViewSelectionChangedEventArgs args)
    {
        if (args.SelectedItemContainer is NavigationViewItem nv)
        {
            if (nv.Tag is string tag) ContentFrame.Navigate(TypeFromTag(tag));
        }
    }

    private void Nav_ItemInvoked(NavigationView sender, NavigationViewItemInvokedEventArgs args)
    {
        if (args.InvokedItemContainer is NavigationViewItem nv && nv.Tag is string tag)
            ContentFrame.Navigate(TypeFromTag(tag));
    }

    private void Window_Closed(object sender, WindowEventArgs args)
    {
        App.SetMainWindow(null);
    }

    private static Type TypeFromTag(string? tag) => (tag ?? "home") switch
    {
        "home" => typeof(Views.HomePage),
        "transfer" => typeof(Views.TransferPage),
        "pairing" => typeof(Views.PairingPage),
        "devices" => typeof(Views.DevicesPage),
        "settings" => typeof(Views.SettingsPage),
        _ => typeof(Views.HomePage),
    };
}
