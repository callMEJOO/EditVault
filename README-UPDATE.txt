EDITVAULT — Creator applications + Scene Pack upload update (v2)

INSTALLATION
1. Extract this ZIP into the EditVault project root:
   C:\Users\ys757\Music\edit-marketplace-mvp\edit-marketplace
   Merge folders. This bundle uses a new, versioned payload folder so it will not conflict with the earlier failed bundle.
2. Open CMD in that project root and run:
   "C:\Program Files\nodejs\node.exe" ".\tools\apply-editvault-creator-scene-pack-update-v2.js"
3. Continue only if it prints “installed successfully”. If it stops because a file differs, do not run the database migration; send the complete message.
4. If installation succeeded, run this once from project root:
   "C:\Program Files\nodejs\node.exe" ".\server\src\db\apply-creator-application-scene-pack-upgrade.js"
5. Restart the backend from the server folder using `npm start`. Keep Vite running and refresh the browser with Ctrl+Shift+R.

WHAT THIS UPDATE DOES
- Keeps Apply as a Creator independent from public profile settings. Applications have their own table and admin-only queue. Approval sets creator access without changing profile TikTok URL or profile verification state.
- Moves legacy pending applications to the new application table during the migration and clears the old overloaded pending profile-verification state for those transferred requests.
- Makes custom creator requests incoming to verified-by-role creator accounts only; ordinary members see their own sent requests only. The backend enforces access.
- Simplifies Clip Assembly request entry to project name + short brief, with optional reference links and budget.
- Adds scene-pack quality and lets an administrator upload ZIP/7Z/RAR files to private server storage or publish an external download link. Original file download requires an authenticated purchase; private uploaded files are not included in the public catalogue response.
- Creates a timestamped backup before replacing any existing source files.

The upload limit defaults to MAX_SCENE_PACK_MB=500 MB. Set MAX_SCENE_PACK_MB in server/.env to change it. For deployed use behind a proxy, configure API_PUBLIC_URL to your backend's public base URL so signed download links use the correct host.
