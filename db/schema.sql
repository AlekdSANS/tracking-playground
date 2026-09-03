CREATE TABLE IF NOT EXISTS users (
  user_id text PRIMARY KEY,
  login text NOT NULL,
  name text NOT NULL DEFAULT '',
  email text NOT NULL,
  pass text NOT NULL,
  email_verified_at timestamptz,
  email_verification_token_hash text,
  email_verification_expires_at timestamptz,
  verification_sent_at timestamptz,
  admin_status smallint NOT NULL DEFAULT 0 CHECK (admin_status IN (0, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_login_unique UNIQUE (login)
);

-- There can be many basic accounts, but only one administrator.
CREATE UNIQUE INDEX IF NOT EXISTS users_single_admin_idx
  ON users (admin_status)
  WHERE admin_status = 1;

-- Upgrade databases created before email verification was added. Existing
-- accounts must be backfilled before making their email column NOT NULL.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_sent_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
  ON users (lower(email));

CREATE INDEX IF NOT EXISTS users_email_verification_token_idx
  ON users (email_verification_token_hash)
  WHERE email_verification_token_hash IS NOT NULL;
