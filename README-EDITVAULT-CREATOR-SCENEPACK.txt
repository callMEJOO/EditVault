EditVault Creator Application + Scene Pack Update
=================================================

What this update changes
------------------------
- Apply as a Creator is an application flow separate from public Profile settings.
- The application URL/note are stored in creator_applications, not written to users.tiktok_url.
- Only administrators can view/review the application queue; approving an application activates creator access.
- Custom-edit incoming requests are returned only to currently verified creators and sent requests remain private to their requester.
- Scene Pack admin publishing supports either a private ZIP / 7Z / RAR upload or a download URL.
- Scene Pack quality (720p, 1080p, 1440p, 4K, Mixed, Original) appears on the public card.
- Clip Assembly requests use a shorter form: project title, short description, and optional source links.

Install
-------
1. Extract this ZIP into the EditVault project root:
   C:\Users\ys757\Music\edit-marketplace-mvp\edit-marketplace
   Merge the tools and upgrade-files folders with any existing folders; do not delete other project files.

2. Open CMD in the project root and run:
   "C:\Program Files\nodejs\node.exe" ".\tools\apply-editvault-creator-scene-pack-update.js"

   The installer verifies that the existing active source files match the snapshot used to prepare the patch. It stops before changing files if they differ. It makes a timestamped backup before installing updates.

3. Apply the database migration from the project root:
   "C:\Program Files\nodejs\node.exe" ".\server\src\db\apply-editvault-workflow-upgrade.js"

   The migration uses server\.env. Do not upload or share that file. It creates the separate creator_applications table and adds the scene-pack upload/quality columns.

4. Restart the backend. In the old backend CMD window press Ctrl+C. Then run:
   cd /d "C:\Users\ys757\Music\edit-marketplace-mvp\edit-marketplace\server"
   npm start

   Leave Vite/client running, then refresh the website with Ctrl+Shift+R.

Scene Pack uploads
------------------
Scene Pack archives are kept in server\private\scene-packs and are not exposed as public static files. After purchase, the server grants a short-lived signed download ticket. Upload size defaults to 500 MB; set SCENE_PACK_UPLOAD_MB in server\.env to another positive limit if needed, then restart the backend.

If the installer says the source files are a different version, do not run the migration yet. Send the full error output so the patch can be rebased safely.
