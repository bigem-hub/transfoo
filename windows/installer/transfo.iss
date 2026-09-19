; Inno Setup — Transfo native 1.1.0
[Setup]
AppName=Transfo by Orvyn
AppVersion=1.1.0
DefaultDirName={autopf}\Transfo
OutputDir=dist
OutputBaseFilename=Transfo by Orvyn Setup 1.1.0
[Files]
Source: "Transfo.Desktop\bin\Release\net8.0-windows\win-x64\publish\*"; DestDir: "{app}"; Flags: recursesubdirs
Source: "Transfo.Core\bin\TransfoCore.dll"; DestDir: "{app}"; Flags: ignoreversion
[Icons]
Name: "{group}\Transfo"; Filename: "{app}\Transfo.exe"

