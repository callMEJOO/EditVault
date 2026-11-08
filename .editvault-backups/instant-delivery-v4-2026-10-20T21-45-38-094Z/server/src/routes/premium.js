const router = require('express').Router();
const db = require('../db/pool');
const { auth, adminOnly } = require('../middleware/auth');

// Public: list available premium products.
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT id, title, description, service_name, duration,
             price_points, image_url, created_at
      FROM premium_accounts
      WHERE status = 'available'
      ORDER BY created_at DESC
    `);
    res.json({ products: rows });
  } catch (e) {
    next(e);
  }
});

// Admin: list all products, including hidden ones.
router.get('/admin/products', auth, adminOnly, async (_req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT id, title, description, service_name, duration,
             price_points, image_url, status, created_at, updated_at
      FROM premium_accounts
      ORDER BY created_at DESC
    `);

    res.json({ products: rows });
  } catch (e) {
    next(e);
  }
});
// Admin: create a product.
router.post('/', auth, adminOnly, async (req, res, next) => {
  try {
    const { title, description = '', serviceName, duration = '', pricePoints, imageUrl = null } = req.body || {};
    const price = Number(pricePoints);

    if (!String(title || '').trim() || !String(serviceName || '').trim() ||
        !Number.isInteger(price) || price < 1 || price > 1000000) {
      return res.status(400).json({ error: 'Provide a title, service name, and valid price in points.' });
    }

    const { rows } = await db.query(`
      INSERT INTO premium_accounts
        (title, description, service_name, duration, price_points, image_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      String(title).trim().slice(0, 160),
      String(description).slice(0, 3000),
      String(serviceName).trim().slice(0, 100),
      String(duration).slice(0, 100),
      price,
      imageUrl ? String(imageUrl).slice(0, 1000) : null
    ]);

    res.status(201).json({ product: rows[0] });
  } catch (e) {
    next(e);
  }
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

// Authenticated user: buy a product using points.
router.post('/:id/order', auth, async (req, res, next) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const { rows: products } = await client.query(`
      SELECT id, title, price_points
      FROM premium_accounts
      WHERE id = $1 AND status = 'available'
      FOR UPDATE
    `, [req.params.id]);

    if (!products[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product is unavailable.' });
    }

    await client.query(`
      INSERT INTO wallets (user_id, balance)
      VALUES ($1, 0)
      ON CONFLICT (user_id) DO NOTHING
    `, [req.user.id]);

    const { rows: wallets } = await client.query(
      'SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE',
      [req.user.id]
    );

    const product = products[0];
    const balance = Number(wallets[0]?.balance ?? 0);

    if (balance < product.price_points) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Insufficient points.',
        required: product.price_points,
        balance
      });
    }

    await client.query(
      'UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2',
      [product.price_points, req.user.id]
    );

    const { rows: orders } = await client.query(`
      INSERT INTO premium_account_orders (buyer_id, account_id, price_points)
      VALUES ($1, $2, $3)
      RETURNING id, buyer_id, account_id, price_points, status, created_at
    `, [req.user.id, product.id, product.price_points]);

    await client.query(`
      INSERT INTO point_ledger (user_id, amount, reason, reference_id, idempotency_key)
      VALUES ($1, $2, 'purchase', $3, $4)
    `, [
      req.user.id,
      -product.price_points,
      orders[0].id,
      `premium-order:${orders[0].id}:purchase`
    ]);

    await client.query('COMMIT');
    res.status(201).json({
      message: 'Order created. It is awaiting admin fulfillment.',
      order: orders[0],
      balance: balance - product.price_points
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

// User: view their own orders.
router.get('/orders/mine', auth, async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT o.id, o.price_points, o.status, o.admin_note, o.created_at,
             o.updated_at, p.title, p.service_name, p.duration
      FROM premium_account_orders o
      JOIN premium_accounts p ON p.id = o.account_id
      WHERE o.buyer_id = $1
      ORDER BY o.created_at DESC
    `, [req.user.id]);

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

