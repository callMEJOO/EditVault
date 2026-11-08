# Edit Marketplace — MVP Starter

Responsive marketplace for buying original edit videos with points earned from approved rewarded ads. Creators publish edits; verification is reviewed manually by an admin.

## Stack
- Client: React + Vite + plain CSS (responsive starter UI)
- API: Node.js + Express (CommonJS)
- Database: PostgreSQL (`pg`), schema in `server/src/db/schema.sql`
- Auth: bcrypt + JWT
- Uploads: Multer (local development storage; move to private object storage before production)

## Run locally
### 1) API
```bash
cd server
cp .env.example .env
npm install
# Create a PostgreSQL database, then apply src/db/schema.sql
npm run dev
```
API runs at `http://localhost:5000`.

### 2) Client
```bash
cd client
npm install
npm run dev
```
Open the Vite URL shown in your terminal. The UI has demo catalog data so it can be previewed before the API is connected. Set `VITE_API_URL=http://localhost:5000` in `client/.env` to use the API.

## MVP scope
- Responsive explore page and edit cards
- Signup/login API and hashed passwords
- Edit listing API and authenticated upload route
- Points wallet ledger and purchase transaction with balance checks
- Original-file download only for buyers
- Manual creator verification request/admin review endpoints
- Reward-ad crediting intentionally requires a verified provider callback; do not award points from a client-side button

## Important before public launch
- Set strong JWT/admin secrets and configure CORS to your exact frontend origin.
- Create the first admin securely; never expose admin credentials in frontend code.
- Use private object storage and short-lived signed download URLs rather than serving uploads directly.
- Add a real rewarded-ad provider's server-side verification callback before enabling ad rewards.
- Add rate limiting, email verification/password reset, moderation/DMCA reporting, malware scanning, backups, and audit logging.
- Define creator payout/redemption rules and fraud prevention before enabling cash-out.
