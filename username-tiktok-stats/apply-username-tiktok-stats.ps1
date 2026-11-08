$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
$patchRoot = $PSScriptRoot

$studioPath = Join-Path $root 'server\src\routes\studio.js'
$mainPath = Join-Path $root 'client\src\main.jsx'
$profilePath = Join-Path $root 'client\src\ProfileSettings.jsx'
$publicProfilePath = Join-Path $root 'client\src\PublicCreatorProfile.jsx'
$stylesPath = Join-Path $root 'client\src\styles.css'
$envExamplePath = Join-Path $root 'server\.env.example'
$migrationPath = Join-Path $root 'server\src\db\add-tiktok-follower-source.js'
$migrationSource = Join-Path $patchRoot 'server\src\db\add-tiktok-follower-source.js'
$migrationWasPresent = Test-Path $migrationPath

$studioSource = Join-Path $patchRoot 'server\src\routes\studio.js'
$profileSource = Join-Path $patchRoot 'client\src\ProfileSettings.jsx'
$publicProfileSource = Join-Path $patchRoot 'client\src\PublicCreatorProfile.jsx'
$cssSource = Join-Path $patchRoot 'username-stats.css.txt'

foreach ($path in @($studioPath, $mainPath, $profilePath, $publicProfilePath, $stylesPath, $envExamplePath, (Join-Path $root 'server\src\db\pool.js'))) {
  if (-not (Test-Path $path)) { throw "Required project file not found: $path. Run this from the project root." }
}
$studioCurrent = Get-Content -Raw $studioPath
$mainCurrent = Get-Content -Raw $mainPath
if (-not $studioCurrent.Contains("router.get('/profile/me'")) { throw 'Your server/src/routes/studio.js is not the expected Creator Upgrades version; no files were changed.' }
if (-not $studioCurrent.Contains("router.get('/edits/mine'")) { throw 'The expected Creator Studio edit routes were not found; no files were changed.' }
if (-not $mainCurrent.Contains("import ProfileSettings from './ProfileSettings.jsx';")) { throw 'ProfileSettings is not connected in client/src/main.jsx. Apply the earlier Profile Preview Fix package first.' }
if (-not $mainCurrent.Contains("import PublicCreatorProfile from './PublicCreatorProfile.jsx';")) { throw 'PublicCreatorProfile is not connected in client/src/main.jsx. Apply Creator Upgrades first.' }

# Validate the server route source before making a backup or copying files.
$null = & node --check $studioSource 2>&1
if ($LASTEXITCODE -ne 0) { throw 'The bundled server route failed node --check; no files were changed.' }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $root ".backup-username-tiktok-stats-$stamp"
New-Item -ItemType Directory -Path $backup | Out-Null
Copy-Item $studioPath (Join-Path $backup 'studio.js')
Copy-Item $profilePath (Join-Path $backup 'ProfileSettings.jsx')
Copy-Item $publicProfilePath (Join-Path $backup 'PublicCreatorProfile.jsx')
Copy-Item $stylesPath (Join-Path $backup 'styles.css')
Copy-Item $envExamplePath (Join-Path $backup '.env.example')
if ($migrationWasPresent) { Copy-Item $migrationPath (Join-Path $backup 'add-tiktok-follower-source.js') }

try {
  Copy-Item $migrationSource $migrationPath -Force
  Push-Location (Join-Path $root 'server')
  try {
    & node 'src/db/add-tiktok-follower-source.js'
    $migrationExitCode = $LASTEXITCODE
  } finally { Pop-Location }
  if ($migrationExitCode -ne 0) { throw 'Database migration failed. See the error above; application files have not been intentionally changed.' }

  Copy-Item $studioSource $studioPath -Force
  Copy-Item $profileSource $profilePath -Force
  Copy-Item $publicProfileSource $publicProfilePath -Force

  $css = Get-Content -Raw $stylesPath
  if (-not $css.Contains('/* AUTO TIKTOK USERNAME STATS */')) {
    Add-Content -Path $stylesPath -Value "`r`n`r`n$(Get-Content -Raw $cssSource)"
  }

  $envExample = Get-Content -Raw $envExamplePath
  if (-not $envExample.Contains('APIFY_API_TOKEN=')) {
    Add-Content -Path $envExamplePath -Value "`r`n# Used server-side to look up public TikTok profile stats by username`r`nAPIFY_API_TOKEN=your_apify_api_token_here"
  }

  $null = & node --check $studioPath 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'Installed server route failed syntax validation.' }
} catch {
  Copy-Item (Join-Path $backup 'studio.js') $studioPath -Force
  Copy-Item (Join-Path $backup 'ProfileSettings.jsx') $profilePath -Force
  Copy-Item (Join-Path $backup 'PublicCreatorProfile.jsx') $publicProfilePath -Force
  Copy-Item (Join-Path $backup 'styles.css') $stylesPath -Force
  Copy-Item (Join-Path $backup '.env.example') $envExamplePath -Force
  if ($migrationWasPresent) { Copy-Item (Join-Path $backup 'add-tiktok-follower-source.js') $migrationPath -Force } elseif (Test-Path $migrationPath) { Remove-Item $migrationPath -Force }
  throw "Patch failed; original files restored from $backup. Details: $($_.Exception.Message)"
}

Write-Host ''
Write-Host 'TikTok username stats integration applied.' -ForegroundColor Green
Write-Host "Backup: $backup" -ForegroundColor Cyan
Write-Host 'Next: add APIFY_API_TOKEN to server/.env, restart the API, then run npm run build inside client.' -ForegroundColor Yellow
