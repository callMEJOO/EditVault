$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$cssPath = Join-Path $root 'profile-settings-compact-modern.css'
$target = Join-Path $root 'client\src\styles.css'
if (!(Test-Path $cssPath)) { throw "Missing patch CSS: $cssPath" }
if (!(Test-Path $target)) { throw "Could not find client\src\styles.css. Run from the EditVault project root." }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $root ("backups\profile-compact-modern-" + $stamp)
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item $target (Join-Path $backupDir 'styles.css') -Force
$marker = '/* EDITVAULT_PROFILE_COMPACT_MODERN_V1 */'
$current = Get-Content -Raw -Encoding UTF8 $target
if ($current.Contains($marker)) { Write-Host 'Compact profile style already exists; no duplicate was added.'; exit 0 }
Add-Content -Path $target -Value ("`r`n" + $marker + "`r`n" + (Get-Content -Raw -Encoding UTF8 $cssPath)) -Encoding UTF8
Write-Host 'Compact profile settings + modern cover preview styles installed.'
Write-Host ("Backup: " + $backupDir)
