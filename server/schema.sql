-- Applied on every boot. Every statement must be idempotent.

CREATE TABLE IF NOT EXISTS users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text,
  email_lower    text GENERATED ALWAYS AS (lower(email)) STORED,
  username       text,
  password_hash  text NOT NULL,
  -- sha256 of the one-time recovery code shown at signup. The code itself is
  -- high entropy, so a fast hash is fine here; passwords use scrypt.
  recovery_hash  text NOT NULL,
  security_question    text,
  security_answer_hash text,
  display_name   text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Older deployments started with email-only accounts. These alterations keep
-- startup migrations idempotent while allowing a new account to use either a
-- username or an email address.
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username_lower text
  GENERATED ALWAYS AS (lower(username)) STORED;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_identifier_required'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_identifier_required
      CHECK (email IS NOT NULL OR username IS NOT NULL);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (email_lower);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_key ON users (username_lower);

CREATE TABLE IF NOT EXISTS sessions (
  token      text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS attempts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- The id the client generated locally. Lets a guest-mode merge run twice
  -- without duplicating rows.
  client_id   text NOT NULL,
  mode        text NOT NULL,
  chapters    int[] NOT NULL DEFAULT '{}',
  score       int NOT NULL,
  total       int NOT NULL,
  passed      boolean NOT NULL,
  duration_ms int NOT NULL,
  taken_at    timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS attempts_user_client_key ON attempts (user_id, client_id);
CREATE INDEX IF NOT EXISTS attempts_user_taken_idx ON attempts (user_id, taken_at DESC);

CREATE TABLE IF NOT EXISTS answers (
  id          bigserial PRIMARY KEY,
  attempt_id  uuid NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  chosen      int[] NOT NULL DEFAULT '{}',
  correct     boolean NOT NULL,
  time_ms     int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS answers_attempt_idx ON answers (attempt_id);
CREATE INDEX IF NOT EXISTS answers_question_idx ON answers (question_id);

CREATE TABLE IF NOT EXISTS srs (
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id   text NOT NULL,
  ease          real NOT NULL DEFAULT 2.5,
  interval_days real NOT NULL DEFAULT 0,
  repetitions   int  NOT NULL DEFAULT 0,
  lapses        int  NOT NULL DEFAULT 0,
  due_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS srs_due_idx ON srs (user_id, due_at);
