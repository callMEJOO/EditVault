param([string]$ProjectRoot = '')
$ErrorActionPreference = 'Stop'
$patchRoot = $PSScriptRoot
$payload = Join-Path $patchRoot 'files'
if (-not $ProjectRoot) { $ProjectRoot = Split-Path $patchRoot -Parent }
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$server = Join-Path $ProjectRoot 'server'
$required = @('client\src\main.jsx', 'client\src\CreatorStudio.jsx', 'server\src\index.js')
foreach ($name in $required) {
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot $name))) {
        throw "Project root is incorrect: $ProjectRoot. Extract the upgrade folder INSIDE edit-marketplace, or pass -ProjectRoot 'C:\path\to\edit-marketplace'."
    }
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is not installed or not on PATH.' }
if (-not (Test-Path -LiteralPath (Join-Path $server 'node_modules\pg'))) {
    throw "Server dependencies missing. Run 'cd server; npm install' in your project, then run this installer again."
}
$paths = @(
    'client\src\main.jsx',
    'client\src\CreatorStudio.jsx',
    'client\src\CommunityProfile.jsx',
    'client\src\styles.css',
    'server\src\routes\community-profile.js',
    'server\src\routes\studio.js',
    'server\src\db\migrations\20261104_creator_discovery_badges.sql',
    'server\src\db\apply-creator-discovery-badges.js'
)
$backup = Join-Path $ProjectRoot ('_editvault-backups\creator-upgrade-v2-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$created = New-Object System.Collections.Generic.List[string]
$original = New-Object System.Collections.Generic.List[string]
foreach ($name in $paths) {
    $target = Join-Path $ProjectRoot $name
    $source = Join-Path $payload $name
    if (-not (Test-Path -LiteralPath $source)) { throw "Patch file is missing: $name" }
    if (Test-Path -LiteralPath $target) {
        $backedUp = Join-Path $backup $name
        New-Item -ItemType Directory -Path (Split-Path $backedUp -Parent) -Force | Out-Null
        Copy-Item -LiteralPath $target -Destination $backedUp -Force
        $original.Add($name)
    } else {
        $created.Add($name)
    }
}
try {
    foreach ($name in $paths) {
        $target = Join-Path $ProjectRoot $name
        New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $payload $name) -Destination $target -Force
    }
    foreach ($name in @('server\src\routes\studio.js', 'server\src\routes\community-profile.js', 'server\src\db\apply-creator-discovery-badges.js')) {
        & node --check (Join-Path $ProjectRoot $name)
        if ($LASTEXITCODE -ne 0) { throw "JavaScript syntax check failed: $name" }
    }
    Push-Location $server
    try {
        & node 'src/db/apply-creator-discovery-badges.js'
        if ($LASTEXITCODE -ne 0) { throw 'Database migration failed. Please check server/.env and PostgreSQL.' }
    } finally { Pop-Location }
    Write-Host ''
    Write-Host 'EDITVAULT CREATOR UPGRADE INSTALLED!' -ForegroundColor Green
    Write-Host ('Backup folder: ' + $backup) -ForegroundColor Cyan
    if (Test-Path -LiteralPath (Join-Path $ProjectRoot 'client\node_modules\.bin\vite.cmd')) {
        Write-Host 'You can verify the frontend build by running: cd client; npm run build' -ForegroundColor Yellow
    }
    Write-Host 'Restart API and frontend to load new routes and UI.' -ForegroundColor Yellow
} catch {
    foreach ($name in $original) {
        Copy-Item -LiteralPath (Join-Path $backup $name) -Destination (Join-Path $ProjectRoot $name) -Force
    }
    foreach ($name in $created) {
        $target = Join-Path $ProjectRoot $name
        if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Force }
    }
    Write-Host 'Installation failed; source files were restored from backup.' -ForegroundColor Red
    throw
}
