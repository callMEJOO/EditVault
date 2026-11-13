-- Offerwall.me verified ad/offer conversions. No client-side credit endpoint.
CREATE TABLE IF NOT EXISTS offerwall_reward_events (
  transaction_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_points INTEGER NOT NULL CHECK (reward_points > 0 AND reward_points <= 5000),
  credited_to_wallet INTEGER NOT NULL DEFAULT 0 CHECK (credited_to_wallet >= 0),
  outstanding_reversal_points INTEGER NOT NULL DEFAULT 0 CHECK (outstanding_reversal_points >= 0),
  status TEXT NOT NULL CHECK (status IN ('credited','reversed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reversed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_offerwall_events_user_date ON offerwall_reward_events(user_id, created_at DESC);
