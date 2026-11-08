const router = require('express').Router();
const db = require('../db/pool');
const { auth, adminOnly } = require('../middleware/auth');

// Public: list available premium products.
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT p.id, p.title, p.description, p.service_name, p.duration,
             p.price_points, p.image_url, p.created_at,
             COUNT(i.id)::int AS available_stock
      FROM premium_accounts p
      LEFT JOIN premium_account_inventory i ON i.account_id = p.id AND i.status = 'available'
      WHERE p.status = 'available'
      GROUP BY p.id
      HAVING COUNT(i.id) > 0
      ORDER BY p.created_at DESC
    `);
    res.set('Cache-Control', 'no-store');
    res.json({ products: rows });
  } catch (e) {
    next(e);
  }
});

// Admin: list all products, including hidden ones.
router.get('/admin/products', auth, adminOnly, async (_req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT p.id, p.title, p.description, p.service_name, p.duration,
             p.price_points, p.image_url, p.status, p.created_at, p.updated_at,
             COUNT(i.id) FILTER (WHERE i.status = 'available')::int AS available_stock,
             COUNT(i.id) FILTER (WHERE i.status = 'sold')::int AS sold_count
      FROM premium_accounts p
      LEFT JOIN premium_account_inventory i ON i.account_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    res.set('Cache-Control', 'no-store');

    res.json({ products: rows });
  } catch (e) {
    next(e);
  }
});
// Only admins can create account products or enter credentials for sale.
router.post('/', auth, adminOnly, async (req, res, next) => {
  const items = Array.isArray(req.body?.inventoryItems)
    ? req.body.inventoryItems.map((value) => String(value || '').trim()).filter(Boolean)
    : String(req.body?.inventoryItems || '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  const { title, description = '', serviceName, duration = '', pricePoints, imageUrl = null } = req.body || {};
  const price = Number(pricePoints);
  const allowedServices = new Set(['CapCut Pro', 'Netflix', 'Spotify Premium', 'YouTube Premium', 'Disney+', 'Amazon Prime Video', 'Apple Music', 'ChatGPT Plus', 'Crunchyroll', 'Shahid VIP', 'OSN+', 'Canva Pro', 'Adobe Creative Cloud', 'Microsoft 365', 'Google One', 'iCloud+', 'Telegram Premium', 'Discord Nitro', 'Twitch Turbo', 'LinkedIn Premium', 'Tidal', 'Deezer', 'TikTok', 'Instagram', 'Facebook', 'X Premium', 'Steam', 'Roblox', 'VPN subscription', 'PlayStation Plus', 'Xbox Game Pass', 'Other']);

  if (!String(title || '').trim() || !allowedServices.has(String(serviceName || '').trim()) ||
      !Number.isInteger(price) || price < 1 || price > 1000000) {
    return res.status(400).json({ error: 'Choose a service, enter a title, and provide a valid price in points.' });
  }
  if (items.length < 1 || items.length > 1000 || items.some((item) => item.length > 5000)) {
    return res.status(400).json({ error: 'Add 1–1,000 delivery items, one account/code per line. Each line must be 5,000 characters or fewer.' });
  }
  if (items.some((item) => item.includes('\u0000'))) return res.status(400).json({ error: 'Delivery items contain unsupported characters.' });
  if (String(description).length > 3000 || String(duration).length > 100 || String(imageUrl || '').length > 1000) {
    return res.status(400).json({ error: 'One of the product details is too long.' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      INSERT INTO premium_accounts (title, description, service_name, duration, price_points, image_url, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'available')
      RETURNING id, title, description, service_name, duration, price_points, image_url, status, created_at
    `, [String(title).trim().slice(0, 160), String(description).slice(0, 3000), String(serviceName).trim(), String(duration).slice(0, 100), price, imageUrl ? String(imageUrl).trim().slice(0, 1000) : null]);
    const product = rows[0];
    await client.query(
      `INSERT INTO premium_account_inventory (account_id, delivery_payload)
       SELECT $1, item FROM unnest($2::text[]) AS item`,
      [product.id, items]
    );
    await client.query('COMMIT');
    res.status(201).json({ product: { ...product, available_stock: items.length }, addedStock: items.length, message: 'Account product published with instant delivery.' });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally { client.release(); }
});

// Add a batch of inventory items to an existing product. Only admins can write stock.
router.post('/:id/inventory', auth, adminOnly, async (req, res, next) => {
  const accountId = String(req.params.id || '');
  const items = Array.isArray(req.body?.inventoryItems)
    ? req.body.inventoryItems.map((value) => String(value || '').trim()).filter(Boolean)
    : String(req.body?.inventoryItems || '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  if (!/^[0-9a-f-]{36}$/i.test(accountId)) return res.status(400).json({ error: 'Invalid product id.' });
  if (items.length < 1 || items.length > 1000 || items.some((item) => item.length > 5000 || item.includes('\u0000'))) {
    return res.status(400).json({ error: 'Add 1–1,000 delivery items, one account/code per line. Each line must be 5,000 characters or fewer.' });
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: productRows } = await client.query('SELECT id FROM premium_accounts WHERE id=$1 FOR UPDATE', [accountId]);
    if (!productRows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Account product not found.' }); }
    await client.query(
      `INSERT INTO premium_account_inventory (account_id, delivery_payload)
       SELECT $1, item FROM unnest($2::text[]) AS item`,
      [accountId, items]
    );
    await client.query(`UPDATE premium_accounts SET status='available', updated_at=NOW() WHERE id=$1`, [accountId]);
    const { rows: stockRows } = await client.query(`SELECT COUNT(*)::int AS available_stock FROM premium_account_inventory WHERE account_id=$1 AND status='available'`, [accountId]);
    await client.query('COMMIT');
    res.status(201).json({ addedStock: items.length, availableStock: stockRows[0]?.available_stock || 0, message: 'Inventory added. Purchases will be delivered immediately.' });
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

    if (pricePoints !== undefined && (!Number.isInteger(price) || price < 1 || price > 1000000)) {
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
      req.params.id
    ]);

    if (!rows[0]) return res.status(404).json({ error: 'Product not found.' });
    res.json({ product: rows[0] });
  } catch (e) {
    next(e);
  }
});

// Purchase and deliver one inventory item in the same transaction.
router.post('/:id/order', auth, async (req, res, next) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: products } = await client.query(`
      SELECT id, title, price_points, status FROM premium_accounts
      WHERE id = $1 AND status = 'available' FOR UPDATE
    `, [req.params.id]);
    const product = products[0];
    if (!product) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Product is unavailable.' }); }

    const { rows: inventoryRows } = await client.query(`
      SELECT id, delivery_payload FROM premium_account_inventory
      WHERE account_id = $1 AND status = 'available'
      ORDER BY created_at ASC, id ASC
      LIMIT 1 FOR UPDATE SKIP LOCKED
    `, [product.id]);
    const inventory = inventoryRows[0];
    if (!inventory) {
      await client.query(`UPDATE premium_accounts SET status='sold_out', updated_at=NOW() WHERE id=$1`, [product.id]);
      await client.query('COMMIT');
      return res.status(409).json({ error: 'This product is sold out. Please try another service.' });
    }

    await client.query(`INSERT INTO wallets (user_id, balance) VALUES ($1, 0) ON CONFLICT (user_id) DO NOTHING`, [req.user.id]);
    const { rows: wallets } = await client.query('SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE', [req.user.id]);
    const balance = Number(wallets[0]?.balance ?? 0);
    if (balance < Number(product.price_points)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient points.', required: product.price_points, balance });
    }

    await client.query('UPDATE wallets SET balance=balance-$1, updated_at=NOW() WHERE user_id=$2', [product.price_points, req.user.id]);
    const { rows: orders } = await client.query(`
      INSERT INTO premium_account_orders (buyer_id, account_id, price_points, status, admin_note)
      VALUES ($1, $2, $3, 'completed', 'Automatically delivered from inventory.')
      RETURNING id, buyer_id, account_id, price_points, status, created_at
    `, [req.user.id, product.id, product.price_points]);
    const order = orders[0];
    await client.query(`
      UPDATE premium_account_inventory SET status='sold', buyer_id=$1, order_id=$2, sold_at=NOW()
      WHERE id=$3 AND status='available'
    `, [req.user.id, order.id, inventory.id]);
    await client.query(`
      INSERT INTO point_ledger (user_id, amount, reason, reference_id, idempotency_key)
      VALUES ($1, $2, 'purchase', $3, $4)
    `, [req.user.id, -Number(product.price_points), order.id, `premium-order:${order.id}:purchase`]);
    await client.query(`
      UPDATE premium_accounts SET status = CASE
        WHEN NOT EXISTS (SELECT 1 FROM premium_account_inventory i WHERE i.account_id=$1 AND i.status='available') THEN 'sold_out'
        ELSE 'available' END, updated_at=NOW()
      WHERE id=$1
    `, [product.id]);

    await client.query('COMMIT');
    res.set('Cache-Control', 'no-store');
    res.status(201).json({
      message: 'Purchase complete. Your account details are ready below.',
      order,
      delivery: inventory.delivery_payload,
      product: { title: product.title },
      balance: balance - Number(product.price_points),
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally { client.release(); }
});

// User: view their own orders.
router.get('/orders/mine', auth, async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT o.id, o.price_points, o.status, o.admin_note, o.created_at,
             o.updated_at, p.title, p.service_name, p.duration,
             i.delivery_payload
      FROM premium_account_orders o
      JOIN premium_accounts p ON p.id = o.account_id
      LEFT JOIN premium_account_inventory i ON i.order_id = o.id AND i.buyer_id = o.buyer_id
      WHERE o.buyer_id = $1
      ORDER BY o.created_at DESC
    `, [req.user.id]);

    res.set('Cache-Control', 'no-store');
    res.json({ orders: rows });
  } catch (e) {
    next(e);
  }
});

// Admin: view all orders and buyer details.
router.get('/orders', auth, adminOnly, async (_req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT o.id, o.price_points, o.status, o.admin_note, o.created_at,
             o.updated_at, p.title, p.service_name,
             u.id AS buyer_id, u.email AS buyer_email, u.display_name AS buyer_name
      FROM premium_account_orders o
      JOIN premium_accounts p ON p.id = o.account_id
      JOIN users u ON u.id = o.buyer_id
      ORDER BY o.created_at DESC
      LIMIT 500
    `);

    res.json({ orders: rows });
  } catch (e) {
    next(e);
  }
});

// Admin: mark a pending order completed or reject it and refund its points.
router.patch('/orders/:orderId', auth, adminOnly, async (req, res, next) => {
  const client = await db.connect();

  try {
    const { status, adminNote = '' } = req.body || {};

    if (!['completed', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be completed or rejected.' });
    }

    await client.query('BEGIN');

    const { rows } = await client.query(`
      SELECT id, buyer_id, price_points, status
      FROM premium_account_orders
      WHERE id = $1
      FOR UPDATE
    `, [req.params.orderId]);

    const order = rows[0];

    if (!order) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (order.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This order has already been processed.' });
    }

    if (status === 'rejected') {
      await client.query(`
        INSERT INTO wallets (user_id, balance)
        VALUES ($1, 0)
        ON CONFLICT (user_id) DO NOTHING
      `, [order.buyer_id]);

      await client.query(`
        UPDATE wallets SET balance = balance + $1, updated_at = NOW()
        WHERE user_id = $2
      `, [order.price_points, order.buyer_id]);

      await client.query(`
        INSERT INTO point_ledger (user_id, amount, reason, reference_id, idempotency_key)
        VALUES ($1, $2, 'refund', $3, $4)
      `, [
        order.buyer_id,
        order.price_points,
        order.id,
        `premium-order:${order.id}:refund`
      ]);
    }

    const { rows: updated } = await client.query(`
      UPDATE premium_account_orders
      SET status = $1, admin_note = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [status, String(adminNote).slice(0, 2000), order.id]);

    await client.query('COMMIT');
    res.json({ order: updated[0], refunded: status === 'rejected' });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

module.exports = router;

