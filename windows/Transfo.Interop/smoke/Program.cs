using System.Text;
using Transfo.Interop;

/* Interop smoke test: exercises the exact P/Invoke path the WinUI app will use
 * against the live server on :4000. Verifies marshalling of LPUTF8Str, native
 * structs, out-nint bodies (freed via trc_free), the base64 helpers, discovery
 * start/stop/snapshot, and a real upload driven by the transfer engine with a
 * rooted callback raised as a .NET event. */

const string Base = "http://localhost:4000";
int pass = 0, fail = 0;
void Check(bool ok, string name)
{
    if (ok) { pass++; Console.WriteLine("  PASS  " + name); }
    else { fail++; Console.WriteLine("  FAIL  " + name); }
}

var rt = TransfoRuntime.Default;
rt.Init();
Console.WriteLine("[01] trc_init");

/* --- base64 round trip --- */
byte[] zeros = new byte[262144];
string b64 = rt.EncodeBase64(zeros);
Check(b64.Length == (262144 + 2) / 3 * 4, "base64 length of 256KiB zeros");
byte[] back = rt.DecodeBase64(b64);
Check(back.Length == zeros.Length && back.AsSpan().SequenceEqual(zeros), "base64 round-trip byte-equal");

/* --- auth via core HTTP stack, JSON body out+trc_free --- */
string email = "interop-smoke-" + Guid.NewGuid().ToString("N")[..8] + "@transfo.local";
int rc = rt.Http("POST", Base + "/api/auth/register", null,
    "{\"email\":\"" + email + "\",\"password\":\"Test1234!\"}", out string? body, out int status);
Check(rc == 0 && status == 200 && body != null && body.Contains("\"token\""), "register via core HTTP (" + rc + ", HTTP " + status + ")");
string token = "";
if (body != null) token = Extract(body, "\"token\":\"", "\"");
Check(token.Length > 20, "token extracted");

/* --- discovery: start, snapshot empty (no peers), stop --- */
rt.DeviceId = "interop-smoke-device";
rt.DeviceName = "Interop Smoke PC";
Check(rt.StartDiscovery(4100) == 0, "discovery start");
Thread.Sleep(1200);
int n = rt.Snapshot(16).Count;
Console.WriteLine("      (peers visible: " + n + ")");
Check(rt.StopDiscovery() == 0, "discovery stop");

/* --- small upload through the engine, event-driven completion --- */
string src = Path.Combine(Path.GetTempPath(), "interop-smoke.bin");
byte[] payload = new byte[3 * 262144];
new Random(42).NextBytes(payload);
File.WriteAllBytes(src, payload);

using var done = new ManualResetEventSlim();
TransferUpdate? final = null;
var updates = new List<TransferUpdate>();
rt.TransferUpdate += u =>
{
    lock (updates) { updates.Add(u); }
    if (u.Phase == TransferPhase.Done || u.Phase == TransferPhase.Failed || u.Phase == TransferPhase.Canceled)
    {
        final = u;
        done.Set();
    }
};

ulong handle = rt.StartUpload(Base, token, src, resume: false);
Check(handle != 0, "upload started (handle " + handle + ")");
Check(done.Wait(TimeSpan.FromSeconds(60)), "upload completed within 60s");
Check(final?.Phase == TransferPhase.Done, "final phase is Done (" + final?.Phase + ")");
Check(final?.Total == payload.Length && final?.Transferred == payload.Length,
    "bytes exact (" + final?.Transferred + "/" + final?.Total + ")");
Check(final?.SessionId?.Length > 0, "session id reported (" + final?.SessionId + ")");
int dvc = 0; foreach (var u in updates) if (u.Phase == TransferPhase.Progress) dvc++;
Check(dvc >= 1, "progress updates fired (" + dvc + ")");
rt.Forget(handle);

/* --- pull the assembled file back and byte-compare --- */
string dst = Path.Combine(Path.GetTempPath(), "interop-smoke.out.bin");
ulong dhandle = rt.StartDownload(Base, token, final!.SessionId!, Path.GetFileName(src), dst);
Check(dhandle != 0, "download started");
done.Reset(); final = null;
Check(done.Wait(TimeSpan.FromSeconds(60)), "download completed within 60s");
Check(final?.Phase == TransferPhase.Done, "download final phase Done");
Check(File.Exists(dst) && new FileInfo(dst).Length == payload.Length, "downloaded size match");
Check(File.Exists(dst) && File.ReadAllBytes(dst).AsSpan().SequenceEqual(payload), "downloaded bytes equal");
rt.Forget(dhandle);

rt.Shutdown();
Console.WriteLine();
Console.WriteLine($"==== {pass} passed, {fail} failed ====");
Environment.Exit(fail == 0 ? 0 : 1);

static string Extract(string s, string start, string end)
{
    int i = s.IndexOf(start, StringComparison.Ordinal);
    if (i < 0) return "";
    i += start.Length;
    int j = s.IndexOf(end, i, StringComparison.Ordinal);
    return j < 0 ? s[i..] : s[i..j];
}