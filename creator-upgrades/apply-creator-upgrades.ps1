$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
$mainPath = Join-Path $root 'client\src\main.jsx'
$stylesPath = Join-Path $root 'client\src\styles.css'
$studioPath = Join-Path $root 'client\src\CreatorStudio.jsx'
$publicProfilePath = Join-Path $root 'client\src\PublicCreatorProfile.jsx'
$indexPath = Join-Path $root 'server\src\index.js'
$editsPath = Join-Path $root 'server\src\routes\edits.js'
$studioRouteTarget = Join-Path $root 'server\src\routes\studio.js'
$migrationTarget = Join-Path $root 'server\src\db\apply-creator-features.js'
$studioRouteSource = Join-Path $PSScriptRoot 'server\src\routes\studio.js'
$migrationSource = Join-Path $PSScriptRoot 'server\src\db\apply-creator-features.js'
$componentSource = Join-Path $PSScriptRoot 'client\src\CreatorStudio.jsx'
$publicProfileSource = Join-Path $PSScriptRoot 'client\src\PublicCreatorProfile.jsx'
$cssSource = Join-Path $PSScriptRoot 'client\creator-upgrades.css.txt'

foreach ($required in @($mainPath,$stylesPath,$indexPath,$editsPath,$studioRouteSource,$migrationSource,$componentSource,$publicProfileSource,$cssSource)) {
  if (-not (Test-Path -LiteralPath $required)) {
    throw "Required file not found: $required`nExtract the ZIP completely and run this script from the edit-marketplace project root."
  }
}
if (-not (Test-Path -LiteralPath $studioPath)) {
  Write-Host 'CreatorStudio.jsx not found. It will be added from this package.' -ForegroundColor Yellow
}

# Preflight all known insertion points before changing the project.
$main = [IO.File]::ReadAllText($mainPath).Replace("`r`n", "`n")
$styles = [IO.File]::ReadAllText($stylesPath).Replace("`r`n", "`n")
$index = [IO.File]::ReadAllText($indexPath).Replace("`r`n", "`n")
$edits = [IO.File]::ReadAllText($editsPath).Replace("`r`n", "`n")
if ($main -notmatch 'useState' -or $main -notmatch "from 'react'") {
  throw 'Could not confirm that client/src/main.jsx is the expected React application. No project files were changed.'
}
if ($main -notmatch 'className="app-shell"' -and $main -notmatch 'className="creator-studio-shell"') {
  throw 'Could not locate the marketplace root in client/src/main.jsx. No project files were changed.'
}
if ($index -notmatch 'app\.use\(''/api/edits'',\s*editRoutes\)') {
  throw "Could not locate app.use('/api/edits', editRoutes) in server/src/index.js. No project files were changed."
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $root "backup-creator-upgrades-$stamp"
New-Item -ItemType Directory -Path $backup | Out-Null
foreach ($p in @($mainPath,$stylesPath,$indexPath,$editsPath,$studioPath,$publicProfilePath,$studioRouteTarget,$migrationTarget)) {
  if (Test-Path -LiteralPath $p) { Copy-Item -LiteralPath $p -Destination (Join-Path $backup ([IO.Path]::GetFileName($p))) }
}

# Install updated creator tools and public profile UI.
Copy-Item -LiteralPath $componentSource -Destination $studioPath -Force
Copy-Item -LiteralPath $publicProfileSource -Destination $publicProfilePath -Force
New-Item -ItemType Directory -Force -Path (Split-Path $studioRouteTarget), (Split-Path $migrationTarget) | Out-Null
Copy-Item -LiteralPath $studioRouteSource -Destination $studioRouteTarget -Force
Copy-Item -LiteralPath $migrationSource -Destination $migrationTarget -Force

# Attach the new API router without disturbing existing marketplace endpoints.
if ($index -notmatch 'require\([''"]\./routes/studio[''"]\)') {
  $index = [regex]::Replace($index, '(?m)^(const\s+creatorRoutes\s*=\s*require\([''"]\./routes/creators[''"]\);\s*)$', '$1' + "`nconst studioRoutes = require('./routes/studio');", 1)
}
if ($index -notmatch 'app\.use\(''/api/studio'',\s*studioRoutes\)') {
  $mountPattern = '(?m)^(\s*app\.use\(''/api/creators'',\s*creatorRoutes\);\s*)$' 
  if ($index -match $mountPattern) {
    $index = [regex]::Replace($index, $mountPattern, '$1' + "`napp.use('/api/studio', studioRoutes);", 1)
  } else {
    $index = [regex]::Replace($index, '(?m)^(\s*app\.use\(''/api/edits'',\s*editRoutes\);\s*)$', '$1' + "`napp.use('/api/studio', studioRoutes);", 1)
  }
}

# Add the Creator Studio overlay if this checkout does not already render it.
if ($main -notmatch 'import\s+CreatorStudio\s+from\s+[''"]\./CreatorStudio\.jsx[''"]') {
  if ($main -notmatch 'import\s+[''"]\./styles\.css[''"];') { throw 'Could not find the stylesheet import in main.jsx.' }
  $main = [regex]::Replace($main, '(?m)^(import\s+[''"]\./styles\.css[''"];\s*)$', '$1' + "`nimport CreatorStudio from './CreatorStudio.jsx';", 1)
}
if ($main -notmatch 'import\s+PublicCreatorProfile\s+from\s+[''"]\./PublicCreatorProfile\.jsx[''"]') {
  $main = [regex]::Replace($main, '(?m)^(import\s+CreatorStudio\s+from\s+[''"]\./CreatorStudio\.jsx[''"];\s*)$', '$1' + "`nimport PublicCreatorProfile from './PublicCreatorProfile.jsx';", 1)
  if ($main -notmatch 'import\s+PublicCreatorProfile\s+from\s+[''"]\./PublicCreatorProfile\.jsx[''"]') {
    $main = [regex]::Replace($main, '(?m)^(import\s+[''"]\./styles\.css[''"];\s*)$', '$1' + "`nimport PublicCreatorProfile from './PublicCreatorProfile.jsx';", 1)
  }
}
if ($main -notmatch 'setPublicCreatorId') {
  $statePattern = '(?m)^(\s*const\s+\[previewEdit,\s*setPreviewEdit\]\s*=\s*useState\(null\);\s*)$'
  if ($main -match $statePattern) {
    $main = [regex]::Replace($main, $statePattern, '$1' + "`n  const [publicCreatorId, setPublicCreatorId] = useState(null);", 1)
  } else { throw 'Could not locate the preview modal state to add public creator profiles. Backup is available.' }
}
if ($main -notmatch 'creatorStudioOpen') {
  $main = [regex]::Replace($main, '(?m)^(\s*const\s+\[publicCreatorId,\s*setPublicCreatorId\]\s*=\s*useState\(null\);\s*)$', '$1' + "`n  const [creatorStudioOpen, setCreatorStudioOpen] = useState(false);", 1)
}
if ($main -notmatch '<CreatorStudio\s') {
  if ($main -match '<div className="app-shell">') {
    $main = $main.Replace('<div className="app-shell">', '<div className="app-shell">' + "`n      <CreatorStudio open={creatorStudioOpen} onClose={() => setCreatorStudioOpen(false)} user={user} onNotice={setNotice} />")
  } elseif ($main -match 'creator-studio-shell') {
    Write-Host 'This checkout has a built-in creator page already; the upgraded CreatorStudio component will be available after you wire its button to setCreatorStudioOpen(true).' -ForegroundColor Yellow
  } else { throw 'Could not attach Creator Studio to the marketplace root.' }
}
$main = $main.Replace("setNotice('Creator tools are coming soon.')", 'setCreatorStudioOpen(true)')
if ($main -notmatch 'editvault:refresh-edits') {
  $refreshPattern = '(?s)(loadEdits\(\);\s*)return\s*\(\)\s*=>\s*\{\s*cancelled\s*=\s*true;\s*\};'
  if ($main -match $refreshPattern) {
    $refreshReplacement = '$1' + "window.addEventListener('editvault:refresh-edits', loadEdits); return () => { cancelled = true; window.removeEventListener('editvault:refresh-edits', loadEdits); };"
    $main = [regex]::Replace($main, $refreshPattern, $refreshReplacement, 1)
  }
}
$edits = $edits.Replace("res.set('Cache-Control', 'public, max-age=300');", "res.set('Cache-Control', 'no-store');")
$edits = $edits.Replace("res.set('Cache-Control', 'private, max-age=300');", "res.set('Cache-Control', 'no-store');")
$errorMarker = "  if (err?.code === 'LIMIT_FILE_SIZE')"
if ($index.Contains($errorMarker) -and $index -notmatch 'Preview generator is not installed') {
  $errorHandling = "  if (err?.message?.startsWith('Only MP4, MOV, and WebM')) return res.status(400).json({ error: err.message });`n  if (err?.message?.startsWith('Could not create the selected preview')) return res.status(422).json({ error: err.message });`n  if (err?.message?.includes('FFmpeg') || err?.message?.includes('Preview generator')) return res.status(503).json({ error: err.message });`n"
  $index = $index.Replace($errorMarker, $errorHandling + $errorMarker)
}

# Make creator names clickable and mount their public creator page.
if ($main -notmatch 'creator-profile-link') {
  $creatorNamePattern = '(?s)<span className="creator-name">\s*@\{edit\.creator\}\s*</span>'
  if ($main -notmatch $creatorNamePattern) {
    throw 'Could not locate the creator-name element in the marketplace card. Backup is available; no more frontend edits were applied.'
  }
  $replacement = '<button type="button" className="creator-name creator-profile-link" onClick={() => { if (edit.creator_id) setPublicCreatorId(edit.creator_id); else setNotice("Creator profile is not available."); }}>@{edit.creator}</button>'
  $main = [regex]::Replace($main, $creatorNamePattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $replacement }, 1)
}
if ($main -notmatch '<PublicCreatorProfile\s') {
  $noticeMarker = '      {notice && ('
  if (-not $main.Contains($noticeMarker)) { throw 'Could not locate the global notice area in main.jsx to add the public creator page.' }
  $profileComponent = '      <PublicCreatorProfile creatorId={publicCreatorId} onClose={() => setPublicCreatorId(null)} onPreview={(edit) => { setPublicCreatorId(null); setPreviewEdit(edit); }} />' + "`n`n"
  $main = $main.Replace($noticeMarker, $profileComponent + $noticeMarker)
}

if ($styles -notmatch 'CREATOR UPGRADES: selectable clips') {
  $styles = $styles.TrimEnd() + "`n`n" + [IO.File]::ReadAllText($cssSource).Replace("`r`n", "`n") + "`n"
}

$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($mainPath, $main.Replace("`n", "`r`n"), $utf8)
[IO.File]::WriteAllText($stylesPath, $styles.Replace("`n", "`r`n"), $utf8)
[IO.File]::WriteAllText($indexPath, $index.Replace("`n", "`r`n"), $utf8)
[IO.File]::WriteAllText($editsPath, $edits.Replace("`n", "`r`n"), $utf8)

Write-Host "Creator tools and public profile UI applied." -ForegroundColor Green
Write-Host "Backup saved to: $backup" -ForegroundColor Cyan

# Install the FFmpeg binary package needed to cut selected preview ranges.
$serverPath = Join-Path $root 'server'
Push-Location $serverPath
try {
  & npm install ffmpeg-static --save
  if ($LASTEXITCODE -ne 0) {
    Write-Warning 'Could not install ffmpeg-static automatically. Run: cd server; npm install ffmpeg-static'
  }
} catch {
  Write-Warning 'Could not install ffmpeg-static automatically. Run: cd server; npm install ffmpeg-static'
} finally { Pop-Location }

# Apply additive database migrations when server/.env is configured and the database is reachable.
Push-Location $serverPath
try {
  & node 'src/db/apply-creator-features.js'
  if ($LASTEXITCODE -ne 0) {
    Write-Warning 'Database migration did not run. After checking server/.env and database access, run: node src/db/apply-creator-features.js'
  }
} catch {
  Write-Warning 'Database migration did not run. After checking server/.env and database access, run: node src/db/apply-creator-features.js'
} finally { Pop-Location }

Write-Host ''
Write-Host 'Next: restart the API, then run npm run build from the client folder.' -ForegroundColor Cyan
