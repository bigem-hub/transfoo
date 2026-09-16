; Inno Setup — Transfo native 1.1.0
[Setup]
AppName=Transfo by Orvyn
AppVersion=1.1.0
DefaultDirName={autopf}\Transfo
OutputDir=dist
OutputBaseFilename=Transfo by Orvyn Setup 1.1.0
[Files]
Source: "Transfo.App\bin\x64\Release\net8.0-windows10.0.19041.0\win-x64\publish\*"; DestDir: "{app}"; Flags: recursesubdirs
Source: "Transfo.Core\bin\TransfoCore.dll"; DestDir: "{app}"; Flags: ignoreversion
[Icons]
Name: "{group}\Transfo"; Filename: "{app}\Transfo.exe"

