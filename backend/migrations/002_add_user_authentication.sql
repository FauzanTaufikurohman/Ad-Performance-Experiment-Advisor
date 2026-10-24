BEGIN;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower
    ON users (LOWER(email));

ALTER TABLE uploads
    ADD COLUMN IF NOT EXISTS user_id BIGINT
        REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_uploads_user_id_created_at
    ON uploads (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_advisor_results (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    upload_id BIGINT NOT NULL
        REFERENCES uploads(id) ON DELETE CASCADE,
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_advisor_results_upload_created_at
    ON ai_advisor_results (upload_id, created_at DESC, id DESC);

COMMIT;
