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
    private const int CurrentConfigVersion = 2;

    public string DeviceId { get; set; } = "";
    public string DeviceName { get; set; } = "MY-PC";
    public string ServerUrl { get; set; } = "https://transfoo.vercel.app";
    public int Port { get; set; } = 443;
    public string DownloadDir { get; set; } = "";
    public bool Discovery { get; set; } = true;
    public int ConfigVersion { get; set; } = 1;

    private static string FilePath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Transfo", FileName);

    public object Snapshot => new
    {
        deviceName = DeviceName,
        serverUrl = ServerUrl,
        port = Port,
        downloadDir = DownloadDir,
        discovery = Discovery,
        configVersion = CurrentConfigVersion,
    };

    public void Load()
    {
        try
        {
            if (!File.Exists(FilePath)) return;
            using var doc = JsonDocument.Parse(File.ReadAllText(FilePath));
            var r = doc.RootElement;
            
            int savedVersion = Get(r, "configVersion", 1);
            
            DeviceId = Get(r, "deviceId", DeviceId);
            DeviceName = Get(r, "deviceName", DeviceName);
            ServerUrl = Get(r, "serverUrl", ServerUrl);
            Port = Get(r, "port", Port);
            DownloadDir = Get(r, "downloadDir", DownloadDir);
            Discovery = Get(r, "discovery", Discovery);
            
            // Migration from v1 (local-first) to v2 (cloud-first)
            if (savedVersion < 2)
            {
                // Detect old local-first configs and migrate to cloud defaults
                var isLocalUrl = ServerUrl.StartsWith("http://localhost", StringComparison.OrdinalIgnoreCase) ||
                                ServerUrl.StartsWith("http://127.0.0.1", StringComparison.OrdinalIgnoreCase) ||
                                ServerUrl.StartsWith("http://192.168.", StringComparison.OrdinalIgnoreCase) ||
                                ServerUrl.StartsWith("http://10.", StringComparison.OrdinalIgnoreCase) ||
                                ServerUrl.StartsWith("http://172.16.", StringComparison.OrdinalIgnoreCase) ||
                                ServerUrl.StartsWith("http://172.17.", StringComparison.OrdinalIgnoreCase) ||
                                ServerUrl.StartsWith("http://172.17.", StringComparison.OrdinalIgnoreCase) ||
                                ServerUrl.StartsWith("http://172.18.", StringComparison.OrdinalIgnoreCase) ||
                                ServerUrl.StartsWith("http://172.19.", StringComparison.OrdinalIgnoreCase) ||
                                ServerUrl.StartsWith("http://172.20.", StringComparison.OrdinalIgnoreCase) ||
                                ServerUrl.StartsWith("http://172.21.", StringComparison.OrdinalIgnoreCase) ||
                                ServerUrl.StartsWith("http://172.22.", StringComparison.OrdinalIgnoreCase) ||
                                ServerUrl.StartsWith("http://172.22.", StringComparison.OrdinalIgnoreCase) ||
                                ServerUrl.StartsWith("http://172.23.", StringComparison.OrdinalIgnoreCase) ||
                                ServerUrl.StartsWith("http://172.24.", StringComparison.OrdinalIgnoreCase) ||
                                ServerUrl.StartsWith("http://172.25.", StringComparison.OrdinalIgnoreCase) ||
                                ServerUrl.StartsWith("http://172.26.", StringComparison.OrdinalIgnoreCase) ||
                                ServerUrl.StartsWith("http://172.27.", StringComparison.OrdinalIgnoreCase) ||
                                ServerUrl.StartsWith("http://172.28.", StringComparison.OrdinalIgnoreCase) ||
                                ServerUrl.StartsWith("http://172.29.", StringComparison.OrdinalIgnoreCase) ||
                                ServerUrl.StartsWith("http://172.30.", StringComparison.OrdinalIgnoreCase) ||
                                ServerUrl.StartsWith("http://172.31.", StringComparison.OrdinalIgnoreCase);
                
                if (isLocalUrl || Port <= 4000)
                {
                    ServerUrl = "https://transfoo.vercel.app";
                    Port = 443;
                }
                ConfigVersion = CurrentConfigVersion;
            }
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
                configVersion = CurrentConfigVersion,
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