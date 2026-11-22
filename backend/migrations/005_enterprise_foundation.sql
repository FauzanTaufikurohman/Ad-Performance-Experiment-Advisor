BEGIN;

CREATE TABLE IF NOT EXISTS organizations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    created_by_user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_memberships (
    organization_id BIGINT NOT NULL
        REFERENCES organizations(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(40) NOT NULL CHECK (role IN (
        'organization_owner',
        'organization_admin',
        'cmo_executive',
        'marketing_manager',
        'campaign_specialist',
        'data_analyst',
        'financial_controller'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_memberships_user
    ON organization_memberships(user_id, created_at, organization_id);

CREATE TABLE IF NOT EXISTS workspaces (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id BIGINT NOT NULL
        REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_user_id BIGINT
        REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_organization_name
    ON workspaces(organization_id, LOWER(name));

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_one_default_per_organization
    ON workspaces(organization_id) WHERE is_default;

CREATE TABLE IF NOT EXISTS business_units (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id BIGINT NOT NULL
        REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, id),
    UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS brands (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id BIGINT NOT NULL
        REFERENCES organizations(id) ON DELETE CASCADE,
    business_unit_id BIGINT,
    name VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, id),
    UNIQUE (organization_id, name),
    FOREIGN KEY (organization_id, business_unit_id)
        REFERENCES business_units(organization_id, id)
);

CREATE TABLE IF NOT EXISTS platform_administrators (
    user_id BIGINT PRIMARY KEY
        REFERENCES users(id) ON DELETE CASCADE,
    provisioned_by_user_id BIGINT
        REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id BIGINT NOT NULL
        REFERENCES organizations(id) ON DELETE CASCADE,
    actor_user_id BIGINT
        REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100) NOT NULL DEFAULT '',
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_created
    ON audit_logs(organization_id, created_at DESC, id DESC);

ALTER TABLE uploads
    ADD COLUMN IF NOT EXISTS organization_id BIGINT
        REFERENCES organizations(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS workspace_id BIGINT
        REFERENCES workspaces(id) ON DELETE SET NULL;

WITH new_organizations AS (
    INSERT INTO organizations (name, created_by_user_id)
    SELECT
        LEFT(COALESCE(NULLIF(BTRIM(u.name), ''), u.email) || ' workspace', 150),
        u.id
    FROM users u
    WHERE NOT EXISTS (
        SELECT 1
        FROM organization_memberships m
        JOIN organizations o ON o.id = m.organization_id
        WHERE m.user_id = u.id
          AND m.role = 'organization_owner'
          AND o.created_by_user_id = u.id
    )
    RETURNING id, created_by_user_id
)
INSERT INTO organization_memberships (organization_id, user_id, role)
SELECT id, created_by_user_id, 'organization_owner'
FROM new_organizations
ON CONFLICT (organization_id, user_id) DO NOTHING;

INSERT INTO workspaces (
    organization_id,
    name,
    is_default,
    created_by_user_id
)
SELECT o.id, 'Default workspace', TRUE, o.created_by_user_id
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1
    FROM workspaces w
    WHERE w.organization_id = o.id AND w.is_default
)
ON CONFLICT DO NOTHING;

UPDATE uploads u
SET organization_id = m.organization_id
FROM organization_memberships m
WHERE u.organization_id IS NULL
  AND u.user_id = m.user_id;

UPDATE uploads u
SET workspace_id = w.id
FROM workspaces w
WHERE u.organization_id = w.organization_id
  AND w.is_default
  AND u.workspace_id IS NULL;

COMMIT;
