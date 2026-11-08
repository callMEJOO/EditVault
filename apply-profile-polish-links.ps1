$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $root ("backups\profile-polish-links-" + $stamp)
$files = @(
  'client\src\ProfileSettings.jsx',
  'client\src\CommunityProfile.jsx',
  'client\src\community-profile.css',
  'client\src\PublicCreatorProfile.jsx',
  'server\src\routes\profile-media.js'
)
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
Write-Host "Profile visual polish and shareable-link update installed."
Write-Host ("Backup: " + $backup)
Write-Host "Next: run npm run build from client, then restart server."
