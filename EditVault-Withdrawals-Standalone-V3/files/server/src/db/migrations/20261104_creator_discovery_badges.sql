BEGIN;
CREATE TABLE IF NOT EXISTS user_badges (
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 badge_key TEXT NOT NULL CHECK (badge_key IN ('top_creator','popular','early_supporter','vip')),
 awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY (user_id, badge_key)
);
CREATE INDEX IF NOT EXISTS user_badges_user_id_idx ON user_badges(user_id);
COMMIT;
