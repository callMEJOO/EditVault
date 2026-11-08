$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$patchRoot = Join-Path $root 'patch\client\src'
$targets = @(
  @{ Relative = 'client\src\ProfileSettings.jsx'; Patch = 'ProfileSettings.jsx' },
  @{ Relative = 'client\src\compact-profile-settings.css'; Patch = 'compact-profile-settings.css' }
)

foreach ($target in $targets) {
  $source = Join-Path $patchRoot $target.Patch
  if (-not (Test-Path $source)) { throw "Missing patch file: $source" }
}
$mainFile = Join-Path $root 'client\src\ProfileSettings.jsx'
if (-not (Test-Path $mainFile)) {
  throw "ProfileSettings.jsx was not found. Run this installer from the EditVault project root."
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $root ("backups\compact-profile-settings-" + $stamp)
New-Item -ItemType Directory -Path $backup -Force | Out-Null

foreach ($target in $targets) {
  $destination = Join-Path $root $target.Relative
  if (Test-Path $destination) {
    $backupDestination = Join-Path $backup $target.Relative
    New-Item -ItemType Directory -Path (Split-Path -Parent $backupDestination) -Force | Out-Null
    Copy-Item $destination $backupDestination -Force
  }
}
foreach ($target in $targets) {
  $source = Join-Path $patchRoot $target.Patch
  $destination = Join-Path $root $target.Relative
  Copy-Item $source $destination -Force
}
Write-Host "Compact Edit Profile update installed."
Write-Host ("Backup: " + $backup)
Write-Host "No database files or user records were changed."
Write-Host "Next: cd client; npm run build"
