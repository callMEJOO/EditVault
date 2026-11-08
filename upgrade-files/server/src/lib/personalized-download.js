'use strict';
const fs = require('fs');
const path = require('path');
const { renderPersonalizedVideo, cleanup } = require('./personalized-watermarks');

const activeRenders = new Set();
function personalizedDownload(db) {
  return async (req, res, next) => {
    const userKey = String(req.user.id);
    if (activeRenders.has(userKey) || activeRenders.size >= 2) {
      return res.status(429).json({ error: 'Another personalized export is being prepared. Try again shortly.' });
    }
    activeRenders.add(userKey);
    let temp = null;
    let sending = false;
    try {
      const { rows } = await db.query(`
        SELECT e.original_path, e.original_filename, p.watermark_name, p.watermark_style
        FROM edits e JOIN purchases p ON p.edit_id = e.id
        WHERE e.id = $1 AND p.buyer_id = $2 LIMIT 1
      `, [req.params.id, req.user.id]);
      const purchase = rows[0];
      if (!purchase) return res.status(403).json({ error: 'Purchase required to download this edit.' });
      if (!purchase.watermark_name || !purchase.watermark_style) return res.status(400).json({ error: 'No personalized watermark was selected at checkout.' });
      if (!fs.existsSync(purchase.original_path)) return res.status(410).json({ error: 'Original file is unavailable.' });

      temp = await renderPersonalizedVideo({ sourcePath: purchase.original_path, name: purchase.watermark_name, style: purchase.watermark_style });
      const basename = path.parse(path.basename(purchase.original_filename || 'edit')).name.replace(/[^a-z0-9_-]/gi, '-').slice(0, 70) || 'edit';
      sending = true;
      return res.download(temp.outputPath, `${basename}-personalized.mp4`, async (error) => {
        await cleanup(temp?.tmpDir);
        activeRenders.delete(userKey);
        if (error && !res.headersSent) next(error);
      });
    } catch (error) {
      console.error('Personalized watermark render failed:', error.message);
      return res.status(503).json({ error: error.message.includes('exceeds') ? error.message : 'Could not render your watermark. Check FFmpeg and WATERMARK_FONT_PATH.' });
    } finally {
      if (!sending) {
        activeRenders.delete(userKey);
        await cleanup(temp?.tmpDir);
      }
    }
  };
}
module.exports = { personalizedDownload };
