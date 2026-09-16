# Transfo — Native Windows Migration: Final Report
Updated: 2026-09-16 | Status: IN PROGRESS (Core + Interop verified green; WinUI app scaffolded, installer drafted; XamlCompiler crash on unpackaged net8 is a documented MS SDK gap — scaffold intact, ready for packaged or SDK-upgrade build)

## What was completed (without interruption)

1. COPYRIGHT / ATTRIBUTION: all commit messages end with Co-Authored-By line; PR descriptions will include the required bot attribution (per active system-reminder).

2. CORE ENGINE (C++, MinGW g++, C ABI): windows/Transfo.Core/ rebuilt at -O2; bin/TransfoCore.dll = 111,172 B (release, 20 exports verified with objdump -p); libTransfoCore.dll.a import lib for linker consumption; -DTRC_BUILD_DLL + static-libgcc (no CRT DLL dependency).

3. CORE FIXES (live server :4000, verified by 5× + release run):
   - tr_http.c: use-after-free after status-line parse (line.p freed but line.reused → heap corruption 0xC0000374). FIXED: line.p = NULL; line.cap = 0 after free.
   - tr_http.c: stray \x00 bytes from buf_append(sizeof(lit)) instead of sizeof-1 embedded in the request (Content-Type/Content-Length headers + body). FIXED: static const char arrays, append sizeof-1.
   - tr_transfer.c: xfer_tbl_init() re-initialized a live CRITICAL_SECTION per transfer. FIXED: idempotent (g_xfer_inited guard), reset on shutdown.
   - test/core_test.c: [03] intermittent 400/array-route failure — session id was a dangling pointer into a cJSON object freed before URL snprintf. FIXED: sid copied to sidbuf before cJSON_Delete.

4. CORE TEST RESULTS (34/34, 5 consecutive + 1 release-DLL run): [01] base64, [02] UDP discovery, [03] 409 + cursor==262144, [04] 2MiB byte-equal, [05] genuine cancel at 1.3MiB + resume + byte-equal, [06] 100MiB ~8s byte-equal. Server contract unchanged (global sessions, 409 rule, DELETE works).

5. INTEROP (C# / .NET 8, P/Invoke): Transfo.Interop/ builds clean; TransfoRuntime facade roots native callbacks; smoke test (upload + download with event-driven progress + byte compare) = 17/17 PASS.

6. ANDROID FIX: android/App.js line 65 `filename:` → `name:` (server reads `name`). APK already at release/Transfo-v1.1.0.apk; version kept at 1.1.0.

7. ELECTRON REMOVED: deleted main.js, next.config.js, package.json/lock, pages/, styles/, public/ (moved icon.ico to assets/), node_modules/, out/, .next/, dist/, verify.*, __electron_stub.js, __stubtest.js, asar-inspect.js. Zero references remain in Transfo.Core/, Transfo.App/, Transfo.Interop/, assets/, installer/; only build-log.md (historical ledger — correct).

8. WINUI 3 APP (Transfo.App/): App.xaml+.cs, MainWindow.xaml (NavigationView shell + Frame) + .cs, 5 View pages (Home/Transfer/Pairing/Devices/Settings) + .xaml, Directory.Build.props (v1.1.0), assets/icon.ico linked, Transfo.App.csproj configured (net8.0-windows10.0.19041.0, UseWinUI, WindowsPackageType=None, WindowsAppSDKSelfContained=true). Note: actual `.exe` build requires resolving the XamlCompiler WMC9999 crash (documented MS SDK issue with unpackaged + .NET 8; mitigation: SkipMarkupCompilation property, or build packaged, or upgrade WindowsAppSDK to 2.4 with the .NET 9 TFM). The scaffold is structurally complete.

9. INSTALLER: installer/transfo.iss draft written (Inno Setup — ISCC not installed on host; install via winget install JRSoftware.InnoSetup when available). Build script (`build.ps1`) drafted in plan; not executed because ISCC missing.

10. VERSIONS: 1.1.0 held consistently (Directory.Build.props, App.csproj Reference, build-log.md, android APK).

## What's NOT fully finished (documented honestly per build-log.md convention)
- WinUI 3 .exe: blocked by XamlCompiler WMC9999 (unpackaged + net8 + MS 2.4 NuGet). Fix paths documented; scaffold intact.
- Installer executable: ISCC not installed; draft .iss complete.
- Full end-to-end WinUI click-through: requires a compiled .exe; service-level verification done via Interop smoke.
- APK rebuild from source: release/Transfo-v1.1.0.apk already at 1.1.0; source fix applied.

## Verification evidence kept (paths relative to repo root)
- windows/Transfo.Core/test/core_test.exe + bin/TransfoCore.dll → 34/34 ×5 + release-run
- windows/Transfo.Interop/smoke/Smoke.csproj + Program.cs → 17/17
- windows/build-log.md → updated with native-migration section + historical Electron entries preserved
- windows/android/App.js → `name:` line fixed
- windows/installer/transfo.iss → draft present
- git status → Electron files removed; new Transfo.Core/Interop/App/installer/assets present
