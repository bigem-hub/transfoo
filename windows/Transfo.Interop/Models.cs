using System.Runtime.InteropServices;

namespace Transfo.Interop;

/// <summary>
/// A peer device as announced over UDP discovery (mirrors TrcDevice in transfo.h).
/// </summary>
[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
public struct TrcDevice
{
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 96)]  public string Id;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string Name;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string Ip;
    public int Port;
    public long LastSeen;   // milliseconds since Unix epoch
}

public enum TransferPhase
{
    Started = 0,
    Progress = 1,
    Done = 2,
    Canceled = 3,
    Failed = 4,
}

/// <summary>Immutable snapshot of a discovered device.</summary>
public sealed record DeviceInfo(string Id, string Name, string Ip, int Port, long LastSeen)
{
    public static DeviceInfo FromNative(in TrcDevice d) => new(d.Id, d.Name, d.Ip, d.Port, d.LastSeen);
}

/// <summary>Progress/terminal update from the transfer engine (C#-safe copy of the callback).</summary>
public sealed record TransferUpdate(
    ulong Handle,
    TransferPhase Phase,
    string? SessionId,
    string? FileName,
    long Transferred,
    long Total,
    string? Error)
{
    public double Fraction => Total > 0 ? (double)Transferred / Total : 0.0;
}