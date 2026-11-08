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
        throw "Cannot find EditVault project at: $ProjectRoot. Extract this folder INSIDE edit-marketplace."
    }
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js not found. Install Node.js or add it to PATH.'
}
if (-not (Test-Path -LiteralPath (Join-Path $server 'node_modules\pg'))) {
    throw "Server dependencies missing. Open CMD and run: cd /d `"$server`" && npm install"
}
$paths = @(
    'client\src\main.jsx',
    'client\src\CreatorStudio.jsx',
    'client\src\CreatorWithdrawals.jsx',
    'client\src\creator-withdrawals.css',
    'client\src\CommunityProfile.jsx',
    'client\src\styles.css',
    'server\src\routes\community-profile.js',
    'server\src\routes\studio.js',
    'server\src\db\migrations\20261104_creator_discovery_badges.sql',
    'server\src\db\apply-creator-discovery-badges.js'
)
$backup = Join-Path $ProjectRoot ('_editvault-backups\creator-withdrawals-v3-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$created = New-Object System.Collections.Generic.List[string]
$original = New-Object System.Collections.Generic.List[string]
foreach ($name in $paths) {
    $target = Join-Path $ProjectRoot $name
    $source = Join-Path $payload $name
    if (-not (Test-Path -LiteralPath $source)) { throw "Missing patch file: $name" }
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
        if ($LASTEXITCODE -ne 0) { throw 'Badge database migration failed. Check server/.env and PostgreSQL.' }
    } finally { Pop-Location }
    Write-Host ''
    Write-Host 'EDITVAULT WITHDRAWALS V3 INSTALLED SUCCESSFULLY!' -ForegroundColor Green
    Write-Host ('Backup: ' + $backup) -ForegroundColor Cyan
    Write-Host 'Route: /withdrawals (creator/admin only)' -ForegroundColor Cyan
    Write-Host 'No cash withdrawal is enabled. POST /api/studio/withdrawals still responds HTTP 403.' -ForegroundColor Yellow
    Write-Host 'Restart the frontend and backend. Then open /withdrawals as a creator.' -ForegroundColor Yellow
    Write-Host 'Optional: cd client; npm run build' -ForegroundColor Yellow
} catch {
    foreach ($name in $original) {
        Copy-Item -LiteralPath (Join-Path $backup $name) -Destination (Join-Path $ProjectRoot $name) -Force
    }
    foreach ($name in $created) {
        $target = Join-Path $ProjectRoot $name
        if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Force }
    }
    Write-Host 'Installation failed: source files rolled back from backup.' -ForegroundColor Red
    Write-Host 'Note: any successful database migration is not rolled back automatically.' -ForegroundColor Yellow
    throw
}
