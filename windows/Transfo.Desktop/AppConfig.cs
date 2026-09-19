using System.IO;
using System.Text.Json;

namespace Transfo.Desktop;

/// <summary>
/// Local, persisted settings for the desktop host. Mirrors the JS app-shell
/// config shape (deviceName/serverUrl/port/downloadDir/discovery) plus a stable
/// DeviceId used for UDP discovery announcements.
/// </summary>
public sealed class AppConfig
{
    private const string FileName = "config.json";

    public string DeviceId { get; set; } = "";
    public string DeviceName { get; set; } = "MY-PC";
    public string ServerUrl { get; set; } = "http://localhost";
    public int Port { get; set; } = 4000;
    public string DownloadDir { get; set; } = "";
    public bool Discovery { get; set; } = true;

    private static string FilePath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Transfo", FileName);

    public object Snapshot => new
    {
        deviceName = DeviceName,
        serverUrl = ServerUrl,
        port = Port,
        downloadDir = DownloadDir,
        discovery = Discovery,
    };

    public void Load()
    {
        try
        {
            if (!File.Exists(FilePath)) return;
            using var doc = JsonDocument.Parse(File.ReadAllText(FilePath));
            var r = doc.RootElement;
            DeviceId = Get(r, "deviceId", DeviceId);
            DeviceName = Get(r, "deviceName", DeviceName);
            ServerUrl = Get(r, "serverUrl", ServerUrl);
            Port = Get(r, "port", Port);
            DownloadDir = Get(r, "downloadDir", DownloadDir);
            Discovery = Get(r, "discovery", Discovery);
        }
        catch
        {
            // corrupt config: fall back to defaults
        }
        if (string.IsNullOrEmpty(DeviceId)) DeviceId = Guid.NewGuid().ToString("N");
    }

    public void Merge(JsonElement args)
    {
        DeviceName = Get(args, "deviceName", DeviceName);
        ServerUrl = Get(args, "serverUrl", ServerUrl);
        Port = Get(args, "port", Port);
        DownloadDir = Get(args, "downloadDir", DownloadDir);
        Discovery = Get(args, "discovery", Discovery);
    }

    public void Save()
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(FilePath)!);
            File.WriteAllText(FilePath, JsonSerializer.Serialize(new
            {
                deviceId = DeviceId,
                deviceName = DeviceName,
                serverUrl = ServerUrl,
                port = Port,
                downloadDir = DownloadDir,
                discovery = Discovery,
            }, new JsonSerializerOptions { WriteIndented = true }));
        }
        catch
        {
            // best-effort persistence
        }
    }

    private static string Get(JsonElement e, string name, string fallback)
        => e.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() ?? fallback : fallback;

    private static int Get(JsonElement e, string name, int fallback)
        => e.TryGetProperty(name, out var p) && p.TryGetInt32(out int v) ? v : fallback;

    private static bool Get(JsonElement e, string name, bool fallback)
        => e.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.True ? true : fallback;
}