require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const db = require('./db/pool');
const authRoutes = require('./routes/auth');
const editRoutes = require('./routes/edits');
const walletRoutes = require('./routes/wallet');
const creatorRoutes = require('./routes/creators');
const premiumRoutes = require('./routes/premium');
const app = express();
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
app.use('/api/edits', editRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/creators', creatorRoutes);
app.use('/api/premium', premiumRoutes);
app.use((err, _req, res, _next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `File exceeds ${process.env.MAX_UPLOAD_MB || 300} MB limit` });
  if (err?.name === 'MulterError' || err?.message === 'Unexpected field') return res.status(400).json({ error: 'Invalid upload. Provide original and preview files in MP4, MOV, or WebM format.' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
app.listen(port, () => console.log(`Edit Marketplace API listening on http://localhost:${port}`));
