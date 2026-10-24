
BEGIN;

CREATE TABLE IF NOT EXISTS uploads (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'completed'
        CHECK (status IN ('processing', 'completed', 'failed')),
    row_count INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_records (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    upload_id BIGINT NOT NULL
        REFERENCES uploads(id) ON DELETE CASCADE,
    record_date DATE NOT NULL,
    campaign VARCHAR(255) NOT NULL,
    impressions BIGINT NOT NULL CHECK (impressions >= 0),
    clicks BIGINT NOT NULL CHECK (clicks >= 0),
    spend NUMERIC(18, 4) NOT NULL CHECK (spend >= 0),
    conversions BIGINT NOT NULL CHECK (conversions >= 0),
    conversion_value NUMERIC(18, 4) NOT NULL
        CHECK (conversion_value >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (clicks <= impressions)
);

CREATE INDEX IF NOT EXISTS idx_ad_records_upload_id
    ON ad_records(upload_id);

CREATE INDEX IF NOT EXISTS idx_ad_records_date
    ON ad_records(record_date);

CREATE TABLE IF NOT EXISTS metric_summaries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    upload_id BIGINT NOT NULL UNIQUE
        REFERENCES uploads(id) ON DELETE CASCADE,
    total_impressions BIGINT NOT NULL DEFAULT 0,
    total_clicks BIGINT NOT NULL DEFAULT 0,
    total_spend NUMERIC(18, 4) NOT NULL DEFAULT 0,
    total_conversions BIGINT NOT NULL DEFAULT 0,
    total_conversion_value NUMERIC(18, 4) NOT NULL DEFAULT 0,
    ctr NUMERIC(18, 6),
    cpa NUMERIC(18, 6),
    roas NUMERIC(18, 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS findings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    upload_id BIGINT NOT NULL
        REFERENCES uploads(id) ON DELETE CASCADE,
    code VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info'
        CHECK (severity IN ('info', 'warning', 'critical')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_findings_upload_id
    ON findings(upload_id);

COMMIT;
