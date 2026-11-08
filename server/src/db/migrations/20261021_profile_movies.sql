BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_visibility TEXT NOT NULL DEFAULT 'public';

UPDATE users
SET username = LOWER(REGEXP_REPLACE(SPLIT_PART(COALESCE(NULLIF(display_name,''), SPLIT_PART(email,'@',1), 'member'),' ',1),'[^a-zA-Z0-9_]','','g'))
             || '_' || SUBSTRING(REPLACE(id::text,'-','') FROM 1 FOR 6)
WHERE username IS NULL OR BTRIM(username) = '';

ALTER TABLE users ALTER COLUMN username SET NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_profile_visibility_check') THEN
  ALTER TABLE users ADD CONSTRAINT users_profile_visibility_check CHECK (profile_visibility IN ('public','private'));
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique ON users(LOWER(username));

CREATE TABLE IF NOT EXISTS movie_collection (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 tmdb_id INTEGER NOT NULL CHECK (tmdb_id > 0),
 media_type TEXT NOT NULL CHECK (media_type IN ('movie','tv')),
 title TEXT NOT NULL,
 poster_path TEXT,
 release_year INTEGER,
 status TEXT NOT NULL DEFAULT 'plan_to_watch' CHECK (status IN ('watching','watched','plan_to_watch','dropped')),
 rating SMALLINT CHECK (rating BETWEEN 1 AND 10),
 is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
 notes TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(user_id,tmdb_id,media_type)
);
CREATE INDEX IF NOT EXISTS movie_collection_user_status_idx ON movie_collection(user_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS movie_collection_user_favorites_idx ON movie_collection(user_id,is_favorite) WHERE is_favorite=TRUE;
COMMIT;
