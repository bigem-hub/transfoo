# WINDOWS BUILD LOG
# Updated: 2026-09-16 (native-migration ledger — replacing the Electron-era entries below)
Status: IN PROGRESS — native C++ core complete & green; Interop/App in progress

Native migration (approved plan: native C++ core + WinUI 3 app, Electron removed):
  1. Transfo.Core (MinGW g++, C ABI) -> bin/TransfoCore.dll 111,172 B (release -O2), self-contained
     runtime (no CRT DLLs beyond the OS), 20 exported symbols (objdump-verified), ships with
     bin/libTransfoCore.dll.a import lib.  Source: tr_http.c, tr_transfer.c, tr_discovery.c,
     tr_base64.c, tr_util.c + vendored vendor/cJSON.c.
  2. Core fixes this session (native engine now live-tested against server on :4000):
     - tr_http.c heap corruption 0xC0000374: status-line buffer freed but `line` reused with a
       stale cap -> use-after-free.  Fixed: `line.p = NULL; line.cap = 0;` after free.
     - tr_http.c stray NUL bytes in request (buf_append with sizeof(lit) instead of
       sizeof(lit)-1) embedded \x00 into Content-Type/Content-Length -> Express JSON parser
       rejected 400.  Fixed both literals to `sizeof(lit) - 1`.
     - tr_transfer.c xfer_tbl_init() re-initialized a live CRITICAL_SECTION per transfer ->
       idempotent now, reset on trc_shutdown.
     - test/core_test.c [03] flake: `sid` pointed into a cJSON object that was cJSON_Delete()'d
       before the URL snprintf -> dangling pointer made GET /sessions/:id intermittently a
       400 or the LIST route (use-after-free).  session id is now copied to sidbuf first.
  3. Core test suite (test/core_test.exe) against live server http://localhost:4000:
     34/34 passed on 5 consecutive runs + a final release-DLL run:
     [01] base64 round-trip, [02] UDP discovery announce (loopback, self-filtered),
     [03] out-of-order chunk rejected 409 + cursor==262144, [04] 2 MiB upload->pull byte-equal,
     [05] genuine mid-transfer cancel at ~1.3 MiB + resume + byte-equal, [06] 100 MiB byte-equal
     (~8 s round trip).  Server contract re-verified: 409 rule, global sessions Map, DELETE.
  Next: 4. Transfo.Interop (C# P/Invoke) 5. Transfo.App (WinUI 3) 6. installer 7. remove Electron.

--- historical (superseded by native migration) ---
# Updated: 2026-09-15 (honest-status ledger — VoiceForge rule)
Status: VERIFIED, REBUILT (fresh .exe produced in this session)
Version: 1.1.0 (was 1.0.0)
Target: windows/dist/Transfo by Orvyn Setup 1.1.0.exe
Process (this session):
  1. npx next build  -> static export regenerated under out/ (index/auth/transfer/pairing/devices/settings + _next assets) — console.green
  2. npx electron-builder --win --x64
     - package.json build config now lists "files": ["main.js","out","public","pages","styles","components","next.config.js"] + "asarUnpack":"out"
       (fixes the earlier packaged app that shipped WITHOUT out/ or main.js in app.asar => white screen / no window)
Supporting artifacts: builder-debug.yml, blockmap, win-unpacked/ present
Icon asset: windows/public/icon.ico exists; tray tooltip + app label = "Transfo by Orvyn"
Build dependency: electron-builder + electron present in node_modules (devDeps)
Verification criteria (confirmed):
  [x] .exe exists in windows/dist/ with the 1.1.0 version
  [x] out/index.html rebuilt (mtime updated, "Transfo by Orvyn" branding present)
  [x] Electron shell + Next.js UI embedded (win-unpacked/ contains Electron runtime + app bundle)
  [x] main.js + out/ included in the packaged app (not the empty asar of 1.0.0 builds)
  [x] Uninstaller present (NSIS target enables uninstall)
Not claimed: LIVE TEST (requires physical Android + PC devices — see server/log/live-test-log.md)