CREATE TABLE IF NOT EXISTS users (
  user_id text PRIMARY KEY,
  login text NOT NULL,
  name text NOT NULL DEFAULT '',
  pass text NOT NULL,
  admin_status smallint NOT NULL DEFAULT 0 CHECK (admin_status IN (0, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_login_unique UNIQUE (login)
);

-- There can be many basic accounts, but only one administrator.
CREATE UNIQUE INDEX IF NOT EXISTS users_single_admin_idx
  ON users (admin_status)
  WHERE admin_status = 1;

