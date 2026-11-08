EditVault - Server startup fix

1) Keep the folder structure when copying these files into your existing project root:
   server/src/index.js
   server/start-server.cmd

2) Back up your current server/src/index.js first.

3) This replacement keeps all existing API routes, including:
   /api/auth, /api/profile, /api/edits, /api/wallet,
   /api/creators, /api/studio, /api/premium.
   It also loads server/.env by absolute path and adds clearer startup errors.

4) To start the backend without the current PATH problem, double-click:
   server/start-server.cmd

5) Keep the terminal window open. The expected startup line is:
   Edit Marketplace API listening on http://localhost:5000

Important:
- The earlier `node is not recognized` error comes from Windows PATH, not index.js itself.
  The included CMD launcher adds C:\Program Files\nodejs to PATH for this process only.
- Ensure server/.env contains a valid JWT_SECRET (at least 32 characters), database settings,
  and APIFY_API_TOKEN. Do not share these secrets.
- Database migration was executed separately according to the user's report. If /api/profile/me
  still returns an error, check the API terminal for the exact new database error.
