const crypto = require('crypto');
const router = require('express').Router();
const db = require('../db/pool');
const { auth, adminOnly } = require('../middleware/auth');

function parseCredentialLines(value) {
  const lines = (Array.isArray(value) ? value.join('\n') : String(value || ''))
    .split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 1) throw new Error('Add at least one account or access code, one per line.');
  if (lines.length > 2000) throw new Error('Add no more than 2,000 accounts in one batch.');
  if (lines.some((line) => line.length > 4000)) throw new Error('Each account line must be 4,000 characters or fewer.');
  return lines;
}

function getCredentialKey() {
  const dedicated = process.env.PREMIUM_ACCOUNT_ENCRYPTION_KEY;
  if (dedicated && dedicated.length < 32) throw new Error('PREMIUM_ACCOUNT_ENCRYPTION_KEY must be at least 32 characters.');
  const secret = dedicated || process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('Secure account delivery is not configured.');
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

function encryptCredential(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getCredentialKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptCredential(value) {
  if (!value) return null;
  const [ivPart, tagPart, ciphertextPart] = String(value).split(':');
  if (!ivPart || !tagPart || !ciphertextPart) throw new Error('Stored account delivery data is invalid.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getCredentialKey(), Buffer.from(ivPart, 'base64'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function productStockSql() {
  return `(SELECT COUNT(*)::int FROM premium_account_inventory i WHERE i.account_id = p.id AND i.status = 'available')`;
}

// Public catalog returns stock counts, never inventory credentials.
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT p.id, p.title, p.description, p.service_name, p.duration,
             p.price_points, p.image_url, p.status, p.created_at,
             ${productStockSql()} AS available_stock
      FROM premium_accounts p
      WHERE p.status = 'available'
      ORDER BY p.created_at DESC
    `);
    res.set('Cache-Control', 'no-store');
    res.json({ products: rows });
  } catch (e) { next(e); }
});

// Admin: full catalog metadata and stock counts only; secrets are not included here.
router.get('/admin/products', auth, adminOnly, async (_req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT p.id, p.title, p.description, p.service_name, p.duration,
             p.price_points, p.image_url, p.status, p.created_at, p.updated_at,
             ${productStockSql()} AS available_stock,
             (SELECT COUNT(*)::int FROM premium_account_inventory i WHERE i.account_id=p.id AND i.status='sold') AS sold_count
      FROM premium_accounts p
      ORDER BY p.created_at DESC
    `);
    res.set('Cache-Control', 'no-store');
    res.json({ products: rows });
  } catch (e) { next(e); }
});

// Admin creates a product and seeds the stock in one transaction. Each non-empty line is one deliverable account/code.
router.post('/', auth, adminOnly, async (req, res, next) => {
  let lines;
  try { lines = parseCredentialLines(req.body?.credentials); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  const title = String(req.body?.title || '').trim();
  const description = String(req.body?.description || '').trim();
  const serviceName = String(req.body?.serviceName || '').trim();
  const duration = String(req.body?.duration || '').trim();
  const price = Number(req.body?.pricePoints);
  const imageUrl = String(req.body?.imageUrl || '').trim();
  if (!title || title.length > 160 || !serviceName || serviceName.length > 100 ||
      !Number.isSafeInteger(price) || price < 1 || price > 1000000) {
    return res.status(400).json({ error: 'Provide a product title, service, and valid point price.' });
  }
  if (description.length > 3000 || duration.length > 100 || imageUrl.length > 1000) {
    return res.status(400).json({ error: 'One or more product fields are too long.' });
  }
  const client = await db.connect();
  try {
    const encryptedLines = lines.map(encryptCredential);
    await client.query('BEGIN');
    const { rows } = await client.query(`
      INSERT INTO premium_accounts (title, description, service_name, duration, price_points, image_url, status)
      VALUES ($1,$2,$3,$4,$5,$6,'available')
      RETURNING id, title, description, service_name, duration, price_points, image_url, status, created_at, updated_at
    `, [title, description, serviceName, duration, price, imageUrl || null]);
    const product = rows[0];
    await client.query(`
      INSERT INTO premium_account_inventory (account_id, credential_data)
      SELECT $1, item FROM unnest($2::text[]) AS input(item)
    `, [product.id, encryptedLines]);
    await client.query('COMMIT');
    res.status(201).json({ product: { ...product, available_stock: lines.length, sold_count: 0 }, message: `Product added with ${lines.length} account(s) in stock.` });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally { client.release(); }
});

// Admin can top up stock in bulk for an existing product. This endpoint is protected server-side.
router.post('/admin/products/:id/inventory', auth, adminOnly, async (req, res, next) => {
  const productId = String(req.params.id || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId)) {
    return res.status(400).json({ error: 'Invalid product id.' });
  }
  let lines;
  try { lines = parseCredentialLines(req.body?.credentials); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  const client = await db.connect();
  try {
    const encryptedLines = lines.map(encryptCredential);
    await client.query('BEGIN');
    const { rows: products } = await client.query('SELECT id, status FROM premium_accounts WHERE id=$1 FOR UPDATE', [productId]);
    if (!products[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Product not found.' }); }
    await client.query(`
      INSERT INTO premium_account_inventory (account_id, credential_data)
      SELECT $1, item FROM unnest($2::text[]) AS input(item)
    `, [productId, encryptedLines]);
    await client.query(`UPDATE premium_accounts SET status=CASE WHEN status='sold_out' THEN 'available' ELSE status END, updated_at=NOW() WHERE id=$1`, [productId]);
    const { rows: stockRows } = await client.query(`SELECT COUNT(*)::int AS available_stock FROM premium_account_inventory WHERE account_id=$1 AND status='available'`, [productId]);
    await client.query('COMMIT');
    res.status(201).json({ added: lines.length, available_stock: Number(stockRows[0].available_stock), message: `Added ${lines.length} account(s) to inventory.` });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally { client.release(); }
});

// Admin: update product details or hide/restore it.
router.patch('/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const { title, description, serviceName, duration, pricePoints, imageUrl, status } = req.body || {};
    const price = pricePoints === undefined ? null : Number(pricePoints);
    if (pricePoints !== undefined && (!Number.isSafeInteger(price) || price < 1 || price > 1000000)) {
      return res.status(400).json({ error: 'Invalid price in points.' });
    }
    if (status !== undefined && !['available', 'hidden', 'sold_out'].includes(status)) {
      return res.status(400).json({ error: 'Invalid product status.' });
    }
    const { rows } = await db.query(`
      UPDATE premium_accounts SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        service_name = COALESCE($3, service_name),
        duration = COALESCE($4, duration),
        price_points = COALESCE($5, price_points),
        image_url = COALESCE($6, image_url),
        status = COALESCE($7, status),
        updated_at = NOW()
      WHERE id = $8
      RETURNING *
    `, [
      title === undefined ? null : String(title).trim().slice(0, 160),
      description === undefined ? null : String(description).slice(0, 3000),
      serviceName === undefined ? null : String(serviceName).trim().slice(0, 100),
      duration === undefined ? null : String(duration).slice(0, 100),
      price,
      imageUrl === undefined ? null : (imageUrl ? String(imageUrl).slice(0, 1000) : null),
      status ?? null,
      req.params.id,
    ]);
    if (!rows[0]) return res.status(404).json({ error: 'Product not found.' });
    res.json({ product: rows[0] });
  } catch (e) { next(e); }
});

// Purchase and deliver one stock item atomically. Account details are encrypted at rest and returned only to this buyer.
router.post('/:id/order', auth, async (req, res, next) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: products } = await client.query(`
      SELECT id, title, service_name, price_points FROM premium_accounts
      WHERE id=$1 AND status='available' FOR UPDATE
    `, [req.params.id]);
    const product = products[0];
    if (!product) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Product is unavailable.' }); }
    const { rows: inventoryRows } = await client.query(`
      SELECT id, credential_data FROM premium_account_inventory
      WHERE account_id=$1 AND status='available'
      ORDER BY created_at ASC, id ASC LIMIT 1 FOR UPDATE SKIP LOCKED
    `, [product.id]);
    const inventory = inventoryRows[0];
    if (!inventory) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Sold out. Please check back after the administrator adds more stock.' }); }

    await client.query(`INSERT INTO wallets (user_id, balance) VALUES ($1,0) ON CONFLICT (user_id) DO NOTHING`, [req.user.id]);
    const { rows: walletRows } = await client.query('SELECT balance FROM wallets WHERE user_id=$1 FOR UPDATE', [req.user.id]);
    const balance = Number(walletRows[0]?.balance ?? 0);
    if (balance < Number(product.price_points)) {
      await client.query('ROLLBACK');
      return res.status(402).json({ error: 'Insufficient points.', required: product.price_points, balance });
    }
    await client.query('UPDATE wallets SET balance=balance-$1, updated_at=NOW() WHERE user_id=$2', [product.price_points, req.user.id]);
    await client.query(`UPDATE premium_account_inventory SET status='sold', sold_to=$1, sold_at=NOW() WHERE id=$2 AND status='available'`, [req.user.id, inventory.id]);
    const { rows: orderRows } = await client.query(`
      INSERT INTO premium_account_orders (buyer_id, account_id, price_points, status, inventory_id)
      VALUES ($1,$2,$3,'completed',$4)
      RETURNING id, buyer_id, account_id, price_points, status, created_at, updated_at
    `, [req.user.id, product.id, product.price_points, inventory.id]);
    const order = orderRows[0];
    await client.query(`
      INSERT INTO point_ledger (user_id, amount, reason, reference_id, idempotency_key)
      VALUES ($1,$2,'purchase',$3,$4)
    `, [req.user.id, -Number(product.price_points), order.id, `premium-order:${order.id}:purchase`]);
    const deliveryData = decryptCredential(inventory.credential_data);
    await client.query('COMMIT');
    res.status(201).json({
      message: 'Payment successful. Your account details are ready in My Premium Orders.',
      order: { ...order, title: product.title, service_name: product.service_name, delivery_data: deliveryData },
      balance: balance - Number(product.price_points),
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally { client.release(); }
});

// A user can see only their own orders and only the inventory item assigned to that order.
router.get('/orders/mine', auth, async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT o.id, o.price_points, o.status, o.admin_note, o.created_at, o.updated_at,
             p.title, p.service_name, p.duration, i.credential_data AS encrypted_delivery_data
      FROM premium_account_orders o
      JOIN premium_accounts p ON p.id=o.account_id
      LEFT JOIN premium_account_inventory i ON i.id=o.inventory_id AND i.sold_to=o.buyer_id
      WHERE o.buyer_id=$1
      ORDER BY o.created_at DESC
    `, [req.user.id]);
    res.set('Cache-Control', 'no-store');
    const orders = rows.map((row) => {
      const { encrypted_delivery_data: encrypted, ...order } = row;
      return { ...order, delivery_data: encrypted ? decryptCredential(encrypted) : null };
    });
    res.json({ orders });
  } catch (e) { next(e); }
});

// Admin order list contains buyer/order metadata, but never expands stored credentials.
router.get('/orders', auth, adminOnly, async (_req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT o.id, o.price_points, o.status, o.admin_note, o.created_at, o.updated_at,
             p.title, p.service_name, u.id AS buyer_id, u.email AS buyer_email, u.display_name AS buyer_name
      FROM premium_account_orders o
      JOIN premium_accounts p ON p.id=o.account_id
      JOIN users u ON u.id=o.buyer_id
      ORDER BY o.created_at DESC LIMIT 500
    `);
    res.json({ orders: rows });
  } catch (e) { next(e); }
});

// Legacy pending orders can still be completed/refunded; new stock orders are delivered immediately.
router.patch('/orders/:orderId', auth, adminOnly, async (req, res, next) => {
  const client = await db.connect();
  try {
    const { status, adminNote = '' } = req.body || {};
    if (!['completed', 'rejected'].includes(status)) return res.status(400).json({ error: 'Status must be completed or rejected.' });
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT id, buyer_id, price_points, status FROM premium_account_orders WHERE id=$1 FOR UPDATE`, [req.params.orderId]);
    const order = rows[0];
    if (!order) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Order not found.' }); }
    if (order.status !== 'pending') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This order has already been processed.' }); }
    if (status === 'rejected') {
      await client.query(`INSERT INTO wallets (user_id,balance) VALUES ($1,0) ON CONFLICT (user_id) DO NOTHING`, [order.buyer_id]);
      await client.query('UPDATE wallets SET balance=balance+$1, updated_at=NOW() WHERE user_id=$2', [order.price_points, order.buyer_id]);
      await client.query(`INSERT INTO point_ledger (user_id,amount,reason,reference_id,idempotency_key) VALUES ($1,$2,'refund',$3,$4)`, [order.buyer_id, order.price_points, order.id, `premium-order:${order.id}:refund`]);
    }
    const { rows: updated } = await client.query(`UPDATE premium_account_orders SET status=$1, admin_note=$2, updated_at=NOW() WHERE id=$3 RETURNING *`, [status, String(adminNote).slice(0,2000), order.id]);
    await client.query('COMMIT');
    res.json({ order: updated[0], refunded: status === 'rejected' });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally { client.release(); }
});

module.exports = router;
