-- Required before POST /api/admin/control/points-grant-all.
-- Each campaign has one immutable UUID. Ledger stores one entry per recipient.
CREATE TABLE IF NOT EXISTS admin_bulk_grants (
  id UUID PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  points INTEGER NOT NULL CHECK(points BETWEEN 1 AND 100000),
  note TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0 CHECK(recipient_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_bulk_grants_created ON admin_bulk_grants(created_at DESC);
