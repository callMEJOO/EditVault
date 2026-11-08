$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $root ("backups\community-profile-upgrade-" + $stamp)
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$files = @(
  'client\src\main.jsx',
  'client\src\ProfileSettings.jsx',
  'client\src\CommunityProfile.jsx',
  'client\src\community-profile.css',
  'server\src\index.js',
  'server\src\routes\community-profile.js',
  'server\src\db\migrations\20261022_community_profiles.sql'
)
foreach ($rel in $files) {
  $src = Join-Path $root $rel
  if (Test-Path $src) {
    $dest = Join-Path $backup $rel
    New-Item -ItemType Directory -Path (Split-Path -Parent $dest) -Force | Out-Null
    Copy-Item $src $dest -Force
  }
}
foreach ($rel in $files) {
  $src = Join-Path $root ("patch\" + $rel)
  if (-not (Test-Path $src)) { throw "Patch file missing: $src" }
  $dest = Join-Path $root $rel
  New-Item -ItemType Directory -Path (Split-Path -Parent $dest) -Force | Out-Null
  Copy-Item $src $dest -Force
}
Write-Host "Patch files installed. Backup: $backup"
Write-Host "Database migration has NOT been run. Follow README-AR.txt."
