using System.Runtime.InteropServices;

namespace Transfo.Interop;

/// <summary>
/// Raw P/Invoke bindings into TransfoCore.dll (MinGW gcc, C ABI, cdecl on x64).
/// All entry points are synchronous from the caller's view except the two
/// callback-driven engines (discovery, transfer) which fire from background
/// threads and must marshal to the UI thread by the consumer.
/// </summary>
internal static class Native
{
    private const string Dll = "TransfoCore";

    /* ---- Lifecycle ---- */
    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)]
    internal static extern void trc_init();
    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)]
    internal static extern void trc_shutdown();
    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)]
    internal static extern nint trc_last_error();
    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)]
    internal static extern void trc_free(nint p);

    /* ---- HTTP (control plane is C# HttpClient; these serve transfer/pull) ---- */
    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)]
    internal static extern int trc_http_post(
        [MarshalAs(UnmanagedType.LPUTF8Str)] string url,
        [MarshalAs(UnmanagedType.LPUTF8Str)] string? token,
        [MarshalAs(UnmanagedType.LPUTF8Str)] string? json,
        out nint outBody, out int statusCode);
    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)]
    internal static extern int trc_http_get(
        [MarshalAs(UnmanagedType.LPUTF8Str)] string url,
        [MarshalAs(UnmanagedType.LPUTF8Str)] string? token,
        out nint outBody, out int statusCode);
    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)]
    internal static extern int trc_http_del(
        [MarshalAs(UnmanagedType.LPUTF8Str)] string url,
        [MarshalAs(UnmanagedType.LPUTF8Str)] string? token,
        out nint outBody, out int statusCode);

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate void TrcIoProgressCb(long bytes, long totalHint, nint user);

    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)]
    internal static extern int trc_http_download(
        [MarshalAs(UnmanagedType.LPUTF8Str)] string url,
        [MarshalAs(UnmanagedType.LPUTF8Str)] string? token,
        [MarshalAs(UnmanagedType.LPUTF8Str)] string destPath,
        TrcIoProgressCb? progress, nint user);

    /* ---- Base64 ---- */
    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)]
    internal static extern nuint trc_base64_encoded_len(nuint n);
    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)]
    internal static extern void trc_base64_encode([In] byte[] input, nuint n, nint output);
    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)]
    internal static extern nuint trc_base64_decode(
        [MarshalAs(UnmanagedType.LPUTF8Str)] string input, nuint n, [Out] byte[] output);

    /* ---- Discovery (UDP broadcast) ---- */
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate void TrcDeviceCb(ref TrcDevice dev, nint user);

    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)]
    internal static extern int trc_discovery_start(
        [MarshalAs(UnmanagedType.LPUTF8Str)] string deviceId,
        [MarshalAs(UnmanagedType.LPUTF8Str)] string deviceName,
        int servicePort, TrcDeviceCb cb, nint user);
    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)]
    internal static extern int trc_discovery_stop();
    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)]
    internal static extern int trc_discovery_snapshot([Out] TrcDevice[] outBuffer, int capacity);

    /* ---- Transfer engine ---- */
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate void TrcTransferCb(ulong handle, int phase,
        nint sessionId, nint fileName, long transferred, long total, nint error, nint user);

    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)]
    internal static extern int trc_transfer_start(
        [MarshalAs(UnmanagedType.LPUTF8Str)] string baseUrl,
        [MarshalAs(UnmanagedType.LPUTF8Str)] string? token,
        [MarshalAs(UnmanagedType.LPUTF8Str)] string filePath,
        int resume, out ulong outHandle, TrcTransferCb cb, nint user);
    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)]
    internal static extern int trc_transfer_cancel(ulong handle);
    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)]
    internal static extern int trc_transfer_status(ulong handle,
        out int outPhase, out int outCode, out long outTransferred, out long outTotal);
    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)]
    internal static extern int trc_download_start(
        [MarshalAs(UnmanagedType.LPUTF8Str)] string baseUrl,
        [MarshalAs(UnmanagedType.LPUTF8Str)] string? token,
        [MarshalAs(UnmanagedType.LPUTF8Str)] string sessionId,
        [MarshalAs(UnmanagedType.LPUTF8Str)] string name,
        [MarshalAs(UnmanagedType.LPUTF8Str)] string destPath,
        out ulong outHandle, TrcTransferCb cb, nint user);
    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)]
    internal static extern int trc_download_cancel(ulong handle);
    [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)]
    internal static extern int trc_transfer_forget(ulong handle);
}