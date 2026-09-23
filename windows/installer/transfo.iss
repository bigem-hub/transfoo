; Transfo 1.1.0 — Inno Setup installer (LZMA2, per-user, no admin required)
#define AppVersion "1.1.0"

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

[Icons]
Name: "{group}\Transfo"; Filename: "{app}\Transfo.Desktop.exe"
Name: "{autodesktop}\Transfo"; Filename: "{app}\Transfo.Desktop.exe"; Tasks: desktopicon

[Tasks]
Name: desktopicon; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"

[Run]
Filename: "{app}\Transfo.Desktop.exe"; Description: "Launch Transfo"; Flags: nowait postinstall skipifsilent
