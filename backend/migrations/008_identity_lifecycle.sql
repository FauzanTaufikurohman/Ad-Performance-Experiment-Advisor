BEGIN;

ALTER TABLE users
    ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN disabled_at TIMESTAMPTZ,
    ADD COLUMN disabled_by_user_id BIGINT
        REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE organization_memberships
    DROP CONSTRAINT organization_memberships_role_check,
    ADD CONSTRAINT organization_memberships_role_check CHECK (role IN (
        'organization_owner',
        'organization_admin',
        'cmo_executive',
        'marketing_manager',
        'campaign_specialist',
        'data_analyst',
        'financial_controller',
        'auditor'
    ));

CREATE TABLE organization_invitations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id BIGINT NOT NULL
        REFERENCES organizations(id) ON DELETE CASCADE,
    invited_email VARCHAR(255) NOT NULL,
    role VARCHAR(40) NOT NULL CHECK (role IN (
        'organization_admin',
        'cmo_executive',
        'marketing_manager',
        'campaign_specialist',
        'data_analyst',
        'financial_controller',
        'auditor'
    )),
    token_hash BYTEA NOT NULL UNIQUE,
    invited_by_user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_organization_invitations_pending
    ON organization_invitations(organization_id, LOWER(invited_email))
    WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE TABLE service_identities (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id BIGINT NOT NULL
        REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    token_hash BYTEA NOT NULL UNIQUE,
    created_by_user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_service_identities_organization_active
    ON service_identities(organization_id, id)
    WHERE is_active;

ALTER TABLE audit_logs
    ALTER COLUMN organization_id DROP NOT NULL,
    ADD COLUMN scope VARCHAR(20) NOT NULL DEFAULT 'organization',
    ADD COLUMN actor_service_identity_id BIGINT
        REFERENCES service_identities(id) ON DELETE SET NULL,
    ADD CONSTRAINT audit_logs_scope_organization_check CHECK (
        (scope = 'organization' AND organization_id IS NOT NULL)
        OR (scope = 'platform' AND organization_id IS NULL)
    );

COMMIT;
