; Transfo 1.1.0 — Inno Setup installer (LZMA2, per-user, no admin required)
#define AppVersion "1.1.1"

[Setup]
AppId={{8E4B1C2A-3F5D-4A7B-9C0D-Transfo110}}
AppName=Transfo
AppVersion={#AppVersion}
AppPublisher=Transfo
AppPublisherURL=https://transfoo.vercel.app
DefaultDirName={localappdata}\Transfo
DefaultGroupName=Transfo
OutputDir=dist
OutputBaseFilename=Transfo-Setup
Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
WizardStyle=modern
SetupIconFile=..\public\icon.ico
UninstallDisplayName=Transfo {#AppVersion}
VersionInfoVersion={#AppVersion}
DisableProgramGroupPage=yes

[Files]
; Single-file self-contained app (shell embedded, .NET runtime bundled)
Source: "..\Transfo.Desktop\bin\Release\net8.0-windows\win-x64\publish\Transfo.Desktop.exe"; DestDir: "{app}"; Flags: ignoreversion
; Native transfer core (resolved from the executable directory at runtime)
Source: "..\Transfo.Core\bin\TransfoCore.dll"; DestDir: "{app}"; Flags: ignoreversion
; Bundled node runtime + Transfo server (auto-started by the app; staged by stage.ps1)
Source: "stage\node\node.exe"; DestDir: "{app}\node"; Flags: ignoreversion
Source: "stage\server\*"; DestDir: "{app}\server"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Transfo"; Filename: "{app}\Transfo.Desktop.exe"
Name: "{autodesktop}\Transfo"; Filename: "{app}\Transfo.Desktop.exe"; Tasks: desktopicon

[Tasks]
Name: desktopicon; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"

[Run]
; Firewall exceptions so LAN discovery (UDP 4001) and the bundled API server
; (TCP 4000) work without manual setup. Best-effort: silently skipped when the
; installer runs without admin rights; Windows still prompts on first listen.
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=""Transfo Discovery (UDP 4001)"" dir=in action=allow protocol=UDP localport=4001 program=""{app}\Transfo.Desktop.exe"""; Flags: runhidden; StatusMsg: "Configuring firewall for LAN discovery..."
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=""Transfo Server (TCP 4000)"" dir=in action=allow protocol=TCP localport=4000 program=""{app}\node\node.exe"""; Flags: runhidden; StatusMsg: "Configuring firewall for LAN transfers..."
Filename: "{app}\Transfo.Desktop.exe"; Description: "Launch Transfo"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=""Transfo Discovery (UDP 4001)"""; Flags: runhidden
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=""Transfo Server (TCP 4000)"""; Flags: runhidden
