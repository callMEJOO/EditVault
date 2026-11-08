BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_data_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_visibility TEXT NOT NULL DEFAULT 'public';

-- Normalize existing usernames and make them unique without changing existing account IDs.
WITH source AS (
  SELECT id,
         COALESCE(NULLIF(trim(both '_' from regexp_replace(lower(COALESCE(display_name,'')), '[^a-z0-9]+', '_', 'g')), ''),
                  'member') AS base_name,
         row_number() OVER (
           PARTITION BY COALESCE(NULLIF(trim(both '_' from regexp_replace(lower(COALESCE(display_name,'')), '[^a-z0-9]+', '_', 'g')), ''), 'member')
           ORDER BY created_at NULLS LAST, id
         ) AS rn
  FROM users
  WHERE username IS NULL OR btrim(username) = ''
)
UPDATE users u
SET username = CASE WHEN length(source.base_name) < 3 THEN 'member_' || right(replace(source.id::text, '-', ''), 8)
                    WHEN source.rn = 1 THEN left(source.base_name, 20)
                    ELSE left(source.base_name, 15) || '_' || right(replace(source.id::text, '-', ''), 8)
               END
FROM source
WHERE u.id = source.id;

-- Resolve any collisions with pre-existing username values safely.
WITH duplicates AS (
  SELECT id, username,
         row_number() OVER (PARTITION BY lower(username) ORDER BY created_at NULLS LAST, id) AS rn
  FROM users
)
UPDATE users u
SET username = left(regexp_replace(lower(d.username), '[^a-z0-9_]', '_', 'g'), 15)
               || '_' || right(replace(d.id::text, '-', ''), 8)
FROM duplicates d
WHERE u.id = d.id AND d.rn > 1;

ALTER TABLE users ALTER COLUMN username SET NOT NULL;
ALTER TABLE users ALTER COLUMN profile_visibility SET DEFAULT 'public';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_profile_visibility_check;
ALTER TABLE users ADD CONSTRAINT users_profile_visibility_check
  CHECK (profile_visibility IN ('public', 'private'));
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique ON users (lower(username));
CREATE INDEX IF NOT EXISTS users_public_profile_lookup ON users (username) WHERE profile_visibility = 'public';

COMMIT;
