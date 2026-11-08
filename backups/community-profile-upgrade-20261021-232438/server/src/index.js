require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const db = require('./db/pool');
const authRoutes = require('./routes/auth');
const editRoutes = require('./routes/edits');
const editLabRoutes = require('./routes/editlab');
const rewardsRoutes = require('./routes/rewards');
const walletRoutes = require('./routes/wallet');
const creatorRoutes = require('./routes/creators');
const studioRoutes = require('./routes/studio');
const adminCreatorsRoutes = require('./routes/admin-creators');
const creatorReviewsRoutes = require('./routes/creator-reviews');
const premiumRoutes = require('./routes/premium');
const accountSettingsRoutes = require('./routes/account-settings');
const marketplaceRoutes = require('./routes/marketplace');
const customRequestsRoutes = require('./routes/custom-requests');
const topazRoutes = require('./routes/topaz');
const app = express();
const profileMediaRoutes = require('./routes/profile-media');
const port = Number(process.env.PORT || 5000);
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be configured with at least 32 characters in server/.env');
  process.exit(1);
}
app.disable('x-powered-by');
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: true, legacyHeaders: false }));
app.get('/', (_req, res) => res.json({ name: 'Edit Marketplace API', status: 'ok' }));
app.get('/api/health', async (_req, res) => {
  try { await db.query('SELECT 1'); res.json({ status: 'ok', database: 'connected' }); }
  catch { res.status(503).json({ status: 'error', database: 'unavailable' }); }
});
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileMediaRoutes);
app.use('/api/edits', editRoutes);
app.use('/api/editlab', editLabRoutes);
app.use('/api/rewards', rewardsRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/creators', creatorRoutes);
app.use('/api/studio', studioRoutes);
app.use('/api/premium', premiumRoutes);
app.use('/api/creator-reviews', creatorReviewsRoutes);
app.use('/api/admin/creators', adminCreatorsRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/account-settings', accountSettingsRoutes);
app.use('/api/custom-requests', customRequestsRoutes);
app.use('/api/topaz', topazRoutes);
app.use((err, _req, res, _next) => {
  if (err?.message?.startsWith('Scene packs must be') || err?.message?.startsWith('Scene pack cover must be')) return res.status(400).json({ error: err.message });
  if (err?.message?.startsWith('Only MP4, MOV, and WebM')) return res.status(400).json({ error: err.message });
  if (err?.message?.startsWith('Could not create the selected preview')) return res.status(422).json({ error: err.message });
  if (err?.message?.includes('FFmpeg') || err?.message?.includes('Preview generator')) return res.status(503).json({ error: err.message });
  if (err?.code === 'LIMIT_FILE_SIZE') {
    const limitMb = err.field === 'cover' ? 5 : err.field === 'asset' ? (process.env.MAX_SCENE_PACK_MB || 500) : (process.env.MAX_UPLOAD_MB || 300);
    return res.status(413).json({ error: `File exceeds ${limitMb} MB limit` });
  }
  if (err?.name === 'MulterError' && err.field === 'asset') return res.status(400).json({ error: 'Scene-pack upload failed. Choose a ZIP, 7Z, or RAR archive.' });
  if (err?.name === 'MulterError' && err.field === 'cover') return res.status(400).json({ error: 'Cover upload failed. Choose a JPG, PNG, or WebP image no larger than 5 MB.' });
  if (err?.name === 'MulterError' || err?.message === 'Unexpected field') return res.status(400).json({ error: 'Invalid upload. Covers must be JPG, PNG, or WebP; scene packs must be ZIP, 7Z, or RAR; edit uploads must be MP4, MOV, or WebM.' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
app.listen(port, () => console.log(`Edit Marketplace API listening on http://localhost:${port}`));
