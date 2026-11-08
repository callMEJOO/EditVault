EditVault Creator Upgrade V2

Install from your Windows computer:
1. Back up your PostgreSQL database before upgrading a live site.
2. Extract this ZIP directly inside your main edit-marketplace project folder.
   Expected: edit-marketplace\EditVault-Creator-Upgrade-v2\INSTALL.bat
3. Double-click INSTALL.bat. It uses PowerShell, even if you normally use CMD.
   It backs up overwritten files in edit-marketplace\_editvault-backups\ .
   It applies the badge migration automatically using server\.env DATABASE_URL.
4. Restart backend and frontend. Run `npm run build` from client to test build.

Functionality:
- Creator Studio displays points earned and payout methods; no cash redemption is enabled.
- POST /api/studio/withdrawals rejects requests with HTTP 403 server-side.
- Public users/creators appear in global search by username (including _), @username or display name.
- Creator + verification + awarded badges appear in results and profiles.
- Private profiles stay out of public search.
- Extra badges: top_creator, popular, early_supporter, vip.
- Badge grants are administrator SQL only; this update does not add a badge admin UI.

Sample badge grant (run as admin in your PostgreSQL DB):
INSERT INTO user_badges (user_id, badge_key)
VALUES ('YOUR-USER-UUID', 'early_supporter')
ON CONFLICT DO NOTHING;

If migration fails, source files roll back automatically. It does NOT restore the database.
Do not publish before checking features in your test environment.
