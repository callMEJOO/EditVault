EDITVAULT — REQUEST PRIVACY & SIMPLE REQUEST FORM PATCH

WHAT THIS PATCH CHANGES
1. Apply as creator submits directly to the admin review queue from the Profile Settings application section; users no longer need to save the TikTok URL first.
2. Rejected applications may be submitted again; active admins and already-pending/approved accounts cannot submit duplicate applications.
3. Only approved creators see the Incoming custom-edit requests tab. Regular members can see the requests they personally sent. Incoming creator applications remain in the existing admin-only dashboard/queue.
4. Custom video requests are reduced to a title, a short description, and an optional reference link.
5. The API returns incoming requests only to the requesting member or the approved creator assigned to them. Only an approved creator can create/act on incoming custom requests.
6. The custom-request form uses a compact single-column layout for mobile and desktop.

INSTALL
1. Extract this ZIP into the EditVault project root, merging the included tools folder with your existing tools folder.
   Project root example: C:\Users\ys757\Music\edit-marketplace-mvp\edit-marketplace
2. Open CMD in that project root and run:
   "C:\Program Files\nodejs\node.exe" ".\tools\apply-editvault-request-privacy.js"
3. If it reports success, restart the Backend from the server folder using npm start. Leave Vite running; press Ctrl+Shift+R in the browser.

The installer checks the source file versions before editing and refuses to overwrite unexpected changes. It creates backups under the project backups folder. This patch does not change the database schema or account roles.
