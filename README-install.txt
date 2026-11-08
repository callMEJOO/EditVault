EditVault V3 - Creator Applications, Public Scene-Pack Uploads, Admin-Only Account Inventory

INSTALL
1. Extract the entire ZIP into the EditVault project root folder (the folder containing client and server). Merge the tools folder if Windows asks.
2. Open CMD in the project root and run:
   "C:\Program Files\nodejs\node.exe" ".\tools\apply-editvault-creator-scene-pack-update-v3.js"
3. ONLY if the installer prints a success message, run:
   "C:\Program Files\nodejs\node.exe" ".\server\src\db\apply-creator-application-scene-pack-upgrade.js"
4. Restart the backend from the server folder with `npm start`. Leave Vite running and refresh the browser with Ctrl+Shift+R.

FEATURES
- Any signed-in member can upload a Scene Pack, but every pack requires a JPG/PNG/WebP cover image. The archive may be uploaded or represented by an external HTTP(S) download link. An administrator can hide/publish packs.
- Account products and all account inventory are administrator-only. The admin chooses a service from a dropdown and pastes one deliverable per line. One successful purchase consumes one line and delivers it immediately. Customers can reopen only their own past delivered details; public/admin catalog routes do not return credentials.
- Creator applications remain independent from public profile settings.
- Request visibility remains scoped to the requester, assigned creator, or administrator routes as implemented by the app.

IMPORTANT
- If the installer reports different files, stop. Do not run the database migration; send the error output first.
- Account credentials are sensitive. Only add account access/keys that you are authorized to transfer. Use one complete delivery item per line, such as `email | password | recovery info`.
- Inventory migration is additive; it does not automatically add stock to legacy premium products. An administrator can open the Accounts dashboard and use “Add inventory” on an existing product.
