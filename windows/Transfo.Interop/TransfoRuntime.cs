using System.Runtime.InteropServices;
using System.Text;

namespace Transfo.Interop;

/// <summary>
/// Thin, thread-safe facade over TransfoCore.dll. Roots the native callbacks,
/// so the engine may fire progress/device events from background threads while
/// this object stays resident. Consumers marshalling to a UI thread should
/// re-dispatch the events onto their own dispatcher.
/// </summary>
public sealed class TransfoRuntime : IDisposable
{
    private static readonly TransfoRuntime Singleton = new();

    public static TransfoRuntime Default => Singleton;

    private readonly Native.TrcDeviceCb _deviceCb;
    private readonly Native.TrcTransferCb _transferCb;
    private bool _started;

    public TransfoRuntime()
    {
        _deviceCb = OnDevice;
        _transferCb = OnTransfer;
    }

    /// <summary>Fired from the discovery listener thread for each new/updated peer.</summary>
    public event Action<DeviceInfo>? DeviceDiscovered;
    /// <summary>Fired from a transfer worker thread on phase/progress changes.</summary>
    public event Action<TransferUpdate>? TransferUpdate;

    /* native callback handlers (invoked on engine background threads) */
    private void OnDevice(ref TrcDevice dev, nint user) => DeviceDiscovered?.Invoke(DeviceInfo.FromNative(dev));

    private void OnTransfer(ulong handle, int phase, nint sessionId, nint fileName,
                            long transferred, long total, nint error, nint user)
        => TransferUpdate?.Invoke(new TransferUpdate(
            handle,
            (TransferPhase)phase,
            sessionId == IntPtr.Zero ? null : Marshal.PtrToStringUTF8(sessionId),
            fileName == IntPtr.Zero ? null : Marshal.PtrToStringUTF8(fileName),
            transferred, total,
            error == IntPtr.Zero ? null : Marshal.PtrToStringUTF8(error)));

    /// <summary>Call once at app startup before using any other API.</summary>
    public void Init()
    {
        if (_started) return;
        Native.trc_init();
        _started = true;
    }

    public void Dispose() => Shutdown();

    public void Shutdown()
    {
        if (!_started) return;
        Native.trc_shutdown();
        _started = false;
    }

    public string? LastError
    {
        get
        {
            nint p = Native.trc_last_error();
            return p == IntPtr.Zero ? null : Marshal.PtrToStringUTF8(p);
        }
    }

    /* ---- discovery ---- */

    public string DeviceId = string.Empty;   // populated by the app before StartDiscovery
    public string DeviceName = string.Empty;

    public int StartDiscovery(int servicePort)
    {
        if (string.IsNullOrEmpty(DeviceId))
            DeviceId = Guid.NewGuid().ToString("N");
        return Native.trc_discovery_start(DeviceId, DeviceName, servicePort, _deviceCb, IntPtr.Zero);
    }

    public int StopDiscovery() => Native.trc_discovery_stop();

    /// <summary>Current known peers; returns up to <paramref name="capacity"/> peers.</summary>
    public List<DeviceInfo> Snapshot(int capacity = 64)
    {
        var buffer = new TrcDevice[capacity];
        int n = Native.trc_discovery_snapshot(buffer, capacity);
        if (n < 0) return new List<DeviceInfo>(0);
        var list = new List<DeviceInfo>(n);
        for (int i = 0; i < n; i++) list.Add(DeviceInfo.FromNative(buffer[i]));
        return list;
    }

    /* ---- transfers ---- */

    /// <summary>
    /// Start an async upload of <paramref name="filePath"/> to a server transfer
    /// session. <paramref name="token"/> is the bearer JWT without the "Bearer "
    /// prefix. Returns the operation handle, or 0 on immediate failure.
    /// </summary>
    public ulong StartUpload(string baseUrl, string token, string filePath, bool resume)
    {
        ulong handle = 0;
        int rc = Native.trc_transfer_start(baseUrl, token, filePath, resume ? 1 : 0, out handle, _transferCb, IntPtr.Zero);
        return rc == 0 ? handle : 0;
    }

    /// <summary>Pull a finished server session's assembled file into <paramref name="destPath"/>.</summary>
    public ulong StartDownload(string baseUrl, string token, string sessionId, string name, string destPath)
    {
        ulong handle = 0;
        int rc = Native.trc_download_start(baseUrl, token, sessionId, name, destPath, out handle, _transferCb, IntPtr.Zero);
        return rc == 0 ? handle : 0;
    }

    public int Cancel(ulong handle) => Native.trc_transfer_cancel(handle);
    public int Forget(ulong handle) => Native.trc_transfer_forget(handle);

    public TransferUpdate? Status(ulong handle)
    {
        int rc = Native.trc_transfer_status(handle, out int phase, out _, out long transferred, out long total);
        return rc == 0
            ? new TransferUpdate(handle, (TransferPhase)phase, null, null, transferred, total, null)
            : null;
    }

    /* ---- base64 helpers (core encoder, used to build chunk payloads) ---- */

    public string EncodeBase64(byte[] bytes)
    {
        nuint len = Native.trc_base64_encoded_len((nuint)bytes.Length);
        nint buf = Marshal.AllocHGlobal((nint)len);
        try
        {
            Native.trc_base64_encode(bytes, (nuint)bytes.Length, buf);
            return Marshal.PtrToStringUTF8(buf) ?? string.Empty;
        }
        finally { Marshal.FreeHGlobal(buf); }
    }

    public byte[] DecodeBase64(string s)
    {
        var output = new byte[s.Length / 4 * 3 + 3];
        nuint n = Native.trc_base64_decode(s, (nuint)s.Length, output);
        if (n == nuint.MaxValue) throw new FormatException("Invalid base64");
        return output[..(int)n];
    }

    /* ---- raw HTTP helpers (JSON body; body is core-malloc'd, freed via trc_free) ---- */

    /// <summary>
    /// POST/GET/DELETE JSON against the server. Combines the engine's own HTTP
    /// stack with P/Invoke marshalling: <paramref name="body"/> is the response
    /// body (UTF-8) and <paramref name="statusCode"/> the HTTP status. Returns 0
    /// on success (the native transport performed the request and got a
    /// response), -1 on network failure.
    /// </summary>
    public int Http(string method, string url, string? token, string? json, out string? body, out int statusCode)
    {
        int Invoke(out nint nativeBody, out int status)
        {
            return method switch
            {
                "GET" => Native.trc_http_get(url, token, out nativeBody, out status),
                "POST" => Native.trc_http_post(url, token, json, out nativeBody, out status),
                "DELETE" => Native.trc_http_del(url, token, out nativeBody, out status),
                _ => throw new ArgumentOutOfRangeException(nameof(method)),
            };
        }

        int rc = Invoke(out nint p, out statusCode);
        body = rc == 0 && p != IntPtr.Zero ? Marshal.PtrToStringUTF8(p) : null;
        if (p != IntPtr.Zero) Native.trc_free(p);
        return rc;
    }
}