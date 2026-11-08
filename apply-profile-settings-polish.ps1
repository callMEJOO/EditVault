$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$cssPath = Join-Path $root 'client\src\styles.css'
$patchPath = Join-Path $root 'profile-settings-polish.css'
if (-not (Test-Path $cssPath)) { throw "Cannot find $cssPath" }
if (-not (Test-Path $patchPath)) { throw "Cannot find $patchPath. Extract the whole ZIP into project root." }
$current = Get-Content -Raw -Path $cssPath
$marker = '/* EditVault profile settings visual polish v1 */'
if ($current.Contains($marker)) {
  Write-Host 'Profile settings polish is already present; no changes made.'
  exit 0
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $root ("backups\profile-settings-polish-" + $stamp)
New-Item -ItemType Directory -Path $backup -Force | Out-Null
Copy-Item $cssPath (Join-Path $backup 'styles.css') -Force
Add-Content -Path $cssPath -Value ("`r`n" + (Get-Content -Raw -Path $patchPath))
Write-Host 'Profile settings visual polish installed.'
Write-Host ("Backup: " + $backup)
Write-Host 'Next: run npm run build from client.'
