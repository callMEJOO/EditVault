$ErrorActionPreference = 'Stop'

$root = (Get-Location).Path
$editsPath = Join-Path $root 'server\src\routes\edits.js'
$mainPath = Join-Path $root 'client\src\main.jsx'
$stylesPath = Join-Path $root 'client\src\styles.css'
$studioPath = Join-Path $root 'client\src\CreatorStudio.jsx'
$indexPath = Join-Path $root 'server\src\index.js'
$newEditsPath = Join-Path $PSScriptRoot 'server\src\routes\edits.js'

foreach ($required in @($editsPath, $mainPath, $stylesPath, $studioPath, $indexPath, $newEditsPath)) {
  if (-not (Test-Path -LiteralPath $required)) {
    throw "Required file not found: $required`nRun this script from the edit-marketplace project root and keep the package folders together."
  }
}

# Read and prepare the client edits in memory first; nothing is written until preflight succeeds.
$main = [System.IO.File]::ReadAllText($mainPath)
$styles = [System.IO.File]::ReadAllText($stylesPath)
$studio = [System.IO.File]::ReadAllText($studioPath)
$index = [System.IO.File]::ReadAllText($indexPath)

# Remove the unused mock catalog and expand filters to match Creator Studio categories.
$main = [regex]::Replace(
  $main,
  '(?s)const mockEdits = \[.*?\r?\n\];\r?\n\r?\nconst categories = \[',
  'const categories = [',
  1
)
$main = $main.Replace(
  "const categories = ['All edits', 'Anime', 'Cinematic', 'Aesthetic'];",
  "const categories = ['All edits', 'Anime', 'Cinematic', 'Aesthetic', 'Gaming', 'AMV', 'Other'];"
)

# Replace the generated category artwork with the actual uploaded preview clip.
$coverStart = '<div className={`edit-cover cover-${edit.tone}`}>'
$coverStartIndex = $main.IndexOf($coverStart, [System.StringComparison]::Ordinal)
if ($coverStartIndex -lt 0) {
  throw 'Could not find the expected edit-card cover in client/src/main.jsx. No files have been changed.'
}
$cardBodyMarker = "`n                <div className=""card-body"">"
$cardBodyIndex = $main.IndexOf($cardBodyMarker, $coverStartIndex, [System.StringComparison]::Ordinal)
if ($cardBodyIndex -lt 0) {
  throw 'Could not find the end of the edit-card cover in client/src/main.jsx. No files have been changed.'
}
$closingCover = "`n                </div>"
$coverCloseIndex = $main.LastIndexOf($closingCover, $cardBodyIndex, [System.StringComparison]::Ordinal)
if ($coverCloseIndex -lt $coverStartIndex) {
  throw 'Could not locate the closing edit-cover tag. No files have been changed.'
}
$newCover = @'
<div className="edit-cover">
                  {edit.previewUrl ? (
                    <video
                      className="edit-preview-video"
                      src={edit.previewUrl}
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      aria-label={`Video preview: ${edit.title}`}
                      onClick={() => setPreviewEdit(edit)}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={(event) => {
                        const playback = event.currentTarget.play();
                        if (playback && typeof playback.catch === 'function') playback.catch(() => {});
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.pause();
                        try { event.currentTarget.currentTime = 0; } catch {}
                      }}
                    />
                  ) : (
                    <div className="edit-no-preview">No preview available</div>
                  )}
                  <div className="cover-noise" />

                  <div className="cover-top">
                    <span>PUBLIC PREVIEW</span>
                    <button
                      aria-label="Save edit"
                      onClick={() => {
                        if (!user) {
                          setNotice('Sign in to save edits to your favorites.');
                          openAuth('login');
                        } else {
                          setNotice('Favorites are coming soon.');
                        }
                      }}
                    >
                      <Heart size={16} />
                    </button>
                  </div>

                  <div className="cover-art">
                    <span className="cover-title">{edit.title}</span>
                  </div>

                  <span className="duration">PREVIEW</span>

                  <button
                    className="preview-play"
                    aria-label={`Preview ${edit.title}`}
                    onClick={() => {
                      if (edit.previewUrl) setPreviewEdit(edit);
                      else setNotice('Preview is not available for this edit yet.');
                    }}
                  >
                    <Play size={16} fill="currentColor" />
                  </button>
                </div>
'@
$main = $main.Substring(0, $coverStartIndex) + $newCover + $main.Substring($coverCloseIndex + $closingCover.Length)
$main = $main.Replace(
  'No edits match that search. Try another creator or category.',
  'No public previews yet for this search. Try another category, or check back after creators upload preview clips.'
)
$main = [regex]::Replace(
  $main,
  '(?s)(loadEdits\(\);\s*)return\s*\(\)\s*=>\s*\{\s*cancelled\s*=\s*true;\s*\};',
  '$1window.addEventListener(''editvault:refresh-edits'', loadEdits); return () => { cancelled = true; window.removeEventListener(''editvault:refresh-edits'', loadEdits); };',
  1
)

$previewCss = @'

/* Real public video previews in marketplace cards */
.edit-preview-video {
  position: absolute;
  z-index: 0;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #08080b;
}
.edit-no-preview {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 18px;
  color: #b8b6c2;
  background: #101014;
  font-size: 11px;
  text-align: center;
}
.edit-cover .cover-noise {
  z-index: 1;
  pointer-events: none;
}
.edit-cover .cover-top {
  z-index: 3;
}
.edit-cover .cover-art {
  z-index: 2;
  pointer-events: none;
  background: linear-gradient(180deg, transparent 48%, #0009 100%);
}
.edit-cover .cover-title {
  max-width: calc(100% - 26px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.edit-cover .duration {
  z-index: 3;
}
.edit-cover .preview-play {
  z-index: 4;
}
'@
if (-not $styles.Contains('.edit-preview-video')) { $styles += $previewCss }

# Patch Creator Studio to upload the original and a separate public preview clip.
if ($studio -notmatch 'const\s+initialForm\s*=\s*\{') {
  throw 'Could not find initialForm in CreatorStudio.jsx. No files have been changed.'
}
if ($studio -notmatch 'id=["'']creator-original-video["'']') {
  throw 'Could not find the creator-original-video input in CreatorStudio.jsx. No files have been changed.'
}
if ($studio -notmatch '(?<obj>\w+)\.append\(\s*[''""]original[''""]\s*,\s*form\.original\s*\)\s*;?') {
  throw 'Could not find the FormData append for form.original in CreatorStudio.jsx. No files have been changed.'
}

if ($studio -notmatch 'preview\s*:\s*null') {
  $studio = [regex]::Replace($studio, '(original\s*:\s*null)(\s*,?)', '$1, preview: null', 1)
}
if ($studio -notmatch 'id=["'']creator-preview-video["'']') {
  $inputMarker = [regex]::Match($studio, 'id=["'']creator-original-video["'']')
  $inputIndex = $inputMarker.Index
  $labelStart = $studio.LastIndexOf('<label', $inputIndex, [System.StringComparison]::Ordinal)
  $labelEndMarker = '</label>'
  $labelEnd = $studio.IndexOf($labelEndMarker, $inputIndex, [System.StringComparison]::Ordinal)
  if ($labelStart -lt 0 -or $labelEnd -lt 0) {
    throw 'Could not locate the original-video label in CreatorStudio.jsx. No files have been changed.'
  }
  $insertAt = $labelEnd + $labelEndMarker.Length
  $previewLabel = @'

              <label>Public preview clip
                <input id="creator-preview-video" type="file" accept="video/mp4,video/quicktime,video/webm" required onChange={(e) => setForm((current) => ({ ...current, preview: e.target.files?.[0] || null }))}/>
                <small>This separate clip is visible to everyone. Do not upload the full-resolution original here.</small>
              </label>
'@
  $studio = $studio.Substring(0, $insertAt) + $previewLabel + $studio.Substring($insertAt)
}
if ($studio -notmatch 'append\(\s*[''""]preview[''""]\s*,\s*form\.preview\s*\)\s*;?') {
  $appendMatch = [regex]::Match($studio, '(?<obj>\w+)\.append\(\s*[''""]original[''""]\s*,\s*form\.original\s*\)\s*;?')
  $objectName = $appendMatch.Groups['obj'].Value
  $studio = $studio.Insert($appendMatch.Index + $appendMatch.Length, "`r`n      $objectName.append('preview', form.preview);")
}
if ($studio -notmatch 'preview\s*:\s*null' -or $studio -notmatch 'append\(\s*[''""]preview[''""]\s*,\s*form\.preview\s*\)') {
  throw 'Preview state or preview upload field did not apply cleanly. No files have been changed.'
}

# Let creators add a public preview to an already-uploaded edit (without re-uploading its original).
if ($studio -notmatch 'const\s+attachPreview\s*=') {
  $uploadMarker = 'const submitUpload ='
  $uploadIndex = $studio.IndexOf($uploadMarker, [System.StringComparison]::Ordinal)
  if ($uploadIndex -lt 0) {
    throw 'Could not find submitUpload in CreatorStudio.jsx. No files have been changed.'
  }
  $attachHandler = @'
const attachPreview = async (editId, previewFile) => {
    if (!previewFile) return;
    const body = new FormData();
    body.append('preview', previewFile);
    try {
      const response = await fetch(`${API_URL}/api/edits/${editId}/preview`, {
        method: 'POST',
        headers: headers(),
        body,
      });
      const data = await readJson(response);
      onNotice?.(data.message || 'Public preview saved.');
      window.dispatchEvent(new Event('editvault:refresh-edits'));
      await loadStudio();
    } catch (error) {
      onNotice?.(error.message || 'Could not upload the public preview.');
    }
  };

'@
  $studio = $studio.Insert($uploadIndex, $attachHandler)
}
if ($studio -notmatch 'className=["'']cs-preview-action["'']') {
  $statsIndex = $studio.IndexOf('className="cs-video-stats"', [System.StringComparison]::Ordinal)
  if ($statsIndex -lt 0) {
    throw 'Could not find the creator video list in CreatorStudio.jsx. No files have been changed.'
  }
  $rowEnd = $studio.IndexOf('</article>', $statsIndex, [System.StringComparison]::Ordinal)
  if ($rowEnd -lt 0) {
    throw 'Could not find the end of a creator video row. No files have been changed.'
  }
  $previewControl = @'
<div className="cs-preview-action">
                <label>
                  Add / replace public preview
                  <input type="file" accept="video/mp4,video/quicktime,video/webm" onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) attachPreview(video.id, file);
                    event.target.value = '';
                  }} />
                </label>
              </div>
'@
  $studio = $studio.Insert($rowEnd, $previewControl)
}
if ($studio -notmatch 'Refresh public catalog after publishing a new edit') {
  $submitIndex = $studio.IndexOf('const submitUpload =', [System.StringComparison]::Ordinal)
  if ($submitIndex -ge 0) {
    $resetIndex = $studio.IndexOf('setForm(initialForm);', $submitIndex, [System.StringComparison]::Ordinal)
    if ($resetIndex -ge 0) {
      $resetEnd = $resetIndex + 'setForm(initialForm);'.Length
      $studio = $studio.Insert($resetEnd, "`r`n      // Refresh public catalog after publishing a new edit.`r`n      window.dispatchEvent(new Event('editvault:refresh-edits'));")
    }
  }
}

$previewStudioCss = @'

/* Add / replace a public preview from the creator's existing video list */
.cs-preview-action {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  border-top: 1px solid #ffffff12;
  padding-top: 10px;
  margin-top: 3px;
}
.cs-preview-action label {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  color: #c6ff4d;
  font-size: 11px;
  font-weight: 700;
}
.cs-preview-action input {
  max-width: 260px;
  color: #bdbac9;
  font-size: 10px;
}
'@
if (-not $styles.Contains('.cs-preview-action')) { $styles += $previewStudioCss }
$studio = [regex]::Replace(
  $studio,
  'if\s*\(!form\.original\)\s*\{\s*setError\([^;]*;\s*return;\s*\}',
  "if (!form.original || !form.preview) { setError('Choose both the original video and a separate preview clip first.'); return; }",
  1
)
# Keep the global upload error message accurate for both accepted fields.
$index = $index.Replace(
  'Invalid upload. Use the original field with an MP4, MOV, or WebM file.',
  'Invalid upload. Provide original and preview files in MP4, MOV, or WebM format.'
)

# Only now create a backup and write all files.
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $root ".backup-public-previews-$timestamp"
New-Item -ItemType Directory -Path $backupDir | Out-Null
foreach ($sourcePath in @($editsPath, $mainPath, $stylesPath, $studioPath, $indexPath)) {
  $relative = $sourcePath.Substring($root.Length).TrimStart([char[]]@([char]92, [char]47))
  $target = Join-Path $backupDir $relative
  New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
  Copy-Item -LiteralPath $sourcePath -Destination $target
}

Copy-Item -LiteralPath $newEditsPath -Destination $editsPath -Force
[System.IO.File]::WriteAllText($mainPath, $main, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText($stylesPath, $styles, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText($studioPath, $studio, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText($indexPath, $index, [System.Text.UTF8Encoding]::new($false))

Write-Host ''
Write-Host 'Public preview changes applied.' -ForegroundColor Green
Write-Host "Backup saved to: $backupDir"
Write-Host 'Next: restart the API, then restart/reload Vite. Only edits with an existing preview file will appear publicly.'
