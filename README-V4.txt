EditVault V4 — Scene-pack covers and instant premium-account delivery

INSTALLATION (run each step in order)

1. Extract this ZIP directly into the EditVault project root:
   C:\Users\ys757\Music\edit-marketplace-mvp\edit-marketplace
   Keep the existing project files. The upgrade-files folder contains staged replacements; do not copy them over files manually.

2. Open CMD in the project root and run:
   "C:\Program Files\nodejs\node.exe" ".\tools\apply-editvault-instant-delivery-v4.js"
   The installer verifies the exact source snapshot and database migration prerequisites before editing anything. It saves backups under .editvault-backups.
   If it stops with a mismatch, DO NOT run the database migration; send the complete output first.

3. Only after the installer reports success, run the new database migration from the project root:
   "C:\Program Files\nodejs\node.exe" ".\server\src\db\apply-v4-premium-inventory-scene-covers.js"

4. Stop the backend with Ctrl+C in its running CMD window, then run:
   cd /d "C:\Users\ys757\Music\edit-marketplace-mvp\edit-marketplace\server"
   npm start
   Leave the Vite client running and refresh the site with Ctrl+Shift+R.

WHAT CHANGES

- Any signed-in member can publish a Scene Pack. A JPG, PNG, or WebP cover image is mandatory (5 MB max). The deliverable can be an uploaded ZIP/7Z/RAR archive or an external HTTP(S) link. Uploaded packs are published immediately; administrators retain the ability to hide or republish them.
- The Premium Accounts catalog has predefined services such as CapCut Pro, Netflix, Spotify Premium, YouTube Premium, Disney+, ChatGPT Plus, Canva Pro, Adobe Creative Cloud, Microsoft 365, Telegram Premium, Discord Nitro, Crunchyroll, Shahid VIP, OSN+, Amazon Prime, and Other.
- Only admins can create account products or add inventory. Add a batch by entering one account/access-code record per line. Each non-empty line is one unit of stock. Existing products can be restocked from Manage Products.
- A purchase takes one available inventory item and deducts points in one database transaction. The order is marked completed and the buyer receives that item immediately. Only that buyer's own order-history endpoint returns their delivery data. Public catalog responses and admin order lists never include the secrets.
- Account/access-code data is encrypted at rest with AES-256-GCM. The default key is the existing stable JWT_SECRET. A separate PREMIUM_ACCOUNT_ENCRYPTION_KEY can be set in server/.env before entering stock; if set, keep it unchanged and securely backed up, or the encrypted stock cannot be decrypted later.

NOTES

- The migration does not delete existing orders or scene packs. Existing Premium product listings with no inventory will show Sold out until stock is added by the admin.
- Existing legacy pending account orders remain in the admin workflow; new orders that consume inventory are delivered automatically.
- Do not sell credentials or subscription access unless you are authorized to transfer/resell them under the service's terms.
