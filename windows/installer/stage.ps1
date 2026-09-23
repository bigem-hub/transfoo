# Stages the production installer payload, then builds Transfo-Setup.exe.
# Run from the windows/ folder. Requires dotnet + node already installed.
# Layout produced under windows/installer/stage/ (gitignored):
#   stage/node/node.exe          (portable node runtime)
#   stage/server/...             (server.js + api/ + lib/ + node_modules)
$ErrorActionPreference = 'Stop'
# Resolve paths relative to this script: windows/installer/stage.ps1
$windowsDir = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $windowsDir
$serverSrc = Join-Path $repoRoot 'server'
$stage = Join-Path $PSScriptRoot 'stage'

Write-Host "Staging installer payload..."

# 1. Publish the desktop app (single file, embedded shell).
dotnet publish (Join-Path $windowsDir 'Transfo.Desktop\Transfo.Desktop.csproj') `
  -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -v q
if ($LASTEXITCODE -ne 0) { throw 'dotnet publish failed' }

# 2. Stage node runtime.
$nodeDst = Join-Path $stage 'node'
New-Item -ItemType Directory -Path $nodeDst -Force | Out-Null
$nodeExe = Join-Path $nodeDst 'node.exe'
if (-not (Test-Path $nodeExe)) {
  $sysNode = Join-Path ${env:ProgramFiles} 'nodejs\node.exe'
  if (-not (Test-Path $sysNode)) { throw "node.exe not found at $sysNode" }
  Copy-Item $sysNode $nodeExe -Force
  Write-Host "Staged node.exe"
}

# 3. Stage server files (skip logs, keep node_modules for offline install).
$serverDst = Join-Path $stage 'server'
New-Item -ItemType Directory -Path $serverDst -Force | Out-Null
foreach ($name in @('server.js', 'package.json', 'api', 'lib', 'node_modules')) {
  $src = Join-Path $serverSrc $name
  if (Test-Path $src) { Copy-Item $src (Join-Path $serverDst $name) -Recurse -Force }
}
Write-Host "Staged server files"

# 4. Build the installer (ISCC must be installed).
$iscc = 'C:\InnoSetup6\ISCC.exe'
if (-not (Test-Path $iscc)) { $iscc = 'C:\Program Files (x86)\Inno Setup 6\ISCC.exe' }
if (-not (Test-Path $iscc)) { throw 'ISCC.exe not found. Install Inno Setup 6 first.' }
& $iscc (Join-Path $PSScriptRoot 'transfo.iss')
Write-Host 'Installer built: windows/installer/dist/Transfo-Setup.exe'
