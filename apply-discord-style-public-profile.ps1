$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $root ("backups\discord-style-public-profile-" + $stamp)
$files = @('client\src\CommunityProfile.jsx', 'client\src\community-profile.css')
New-Item -ItemType Directory -Path $backup -Force | Out-Null
foreach ($rel in $files) {
  $dest = Join-Path $root $rel
  if (Test-Path $dest) {
    $backupDest = Join-Path $backup $rel
    New-Item -ItemType Directory -Path (Split-Path -Parent $backupDest) -Force | Out-Null
    Copy-Item $dest $backupDest -Force
  }
}
foreach ($rel in $files) {
  $src = Join-Path $root ("patch\" + $rel)
  if (-not (Test-Path $src)) { throw "Patch file missing: $src" }
  $dest = Join-Path $root $rel
  New-Item -ItemType Directory -Path (Split-Path -Parent $dest) -Force | Out-Null
  Copy-Item $src $dest -Force
}
Write-Host 'Discord-inspired public profile design installed.'
Write-Host ("Backup: " + $backup)
Write-Host 'Next: run npm run build in client, then refresh the app.'
