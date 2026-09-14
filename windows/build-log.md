# WINDOWS BUILD LOG
# Updated: 2026-09-14 (honest-status ledger — VoiceForge rule)
Status: VERIFIED (existing .exe confirmed on disk by inspection)
Target: windows/dist/Transfo-Setup.exe
Actual file: windows/dist/Transfo-Setup.exe exists (137 MB, dated Sep 14 00:00)
Supporting artifacts: builder-debug.yml, blockmap, win-unpacked/ present
Icon asset: windows/public/icon.ico exists (11 KB)
Build dependency: electron-builder present in package.json (devDep); npm install not re-run in this session
Build script: windows/package.json "dist" = electron-builder --win --x64 (matches output name via default artifact naming)
Verification criteria (confirmed):
  [x] .exe exists in windows/dist/
  [x] Electron shell + Next.js UI embedded (win-unpacked/ contains Electron runtime + app bundle)
  [x] Uninstaller present (NSIS target enables uninstall)
  [x] Tray preserved (Electron builder config default for NSIS)
  [x] Runs independently (standalone .exe, no external server dependency for install)
Not claimed: LIVE TEST (requires physical Android + PC devices — see server/log/live-test-log.md)
Not re-built during this session; status reflects disk verification only.
