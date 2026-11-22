BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_organization_id_id
    ON workspaces(organization_id, id);

CREATE TABLE IF NOT EXISTS bayesian_experiment_results (
    organization_id BIGINT NOT NULL
        REFERENCES organizations(id) ON DELETE CASCADE,
    workspace_id BIGINT NOT NULL,
    experiment_id VARCHAR(100) NOT NULL,
    arm_name VARCHAR(100) NOT NULL,
    metric VARCHAR(10) NOT NULL CHECK (metric IN ('ctr', 'cvr')),
    impressions BIGINT NOT NULL CHECK (impressions >= 0),
    clicks BIGINT NOT NULL CHECK (clicks >= 0 AND clicks <= impressions),
    conversions BIGINT NOT NULL
        CHECK (conversions >= 0 AND conversions <= clicks),
    trials BIGINT NOT NULL CHECK (trials >= 0),
    successes BIGINT NOT NULL CHECK (successes >= 0 AND successes <= trials),
    alpha DOUBLE PRECISION NOT NULL CHECK (alpha > 0),
    beta DOUBLE PRECISION NOT NULL CHECK (beta > 0),
    probability_to_be_best DOUBLE PRECISION NOT NULL
        CHECK (probability_to_be_best >= 0 AND probability_to_be_best <= 1),
    expected_loss DOUBLE PRECISION NOT NULL
        CHECK (expected_loss >= 0 AND expected_loss <= 1),
    cold_start BOOLEAN NOT NULL DEFAULT FALSE,
    ad_fatigued BOOLEAN NOT NULL DEFAULT FALSE,
    evaluated_by_user_id BIGINT
        REFERENCES users(id) ON DELETE SET NULL,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, workspace_id, experiment_id, arm_name, metric),
    FOREIGN KEY (organization_id, workspace_id)
        REFERENCES workspaces(organization_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bayesian_results_workspace_evaluated
    ON bayesian_experiment_results (
        organization_id, workspace_id, evaluated_at DESC
    );

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM bayesian_stats b
        WHERE NOT EXISTS (
            SELECT 1
            FROM organizations o
            JOIN workspaces w
                ON w.organization_id = o.id AND w.is_default
            WHERE o.created_by_user_id = b.user_id
        )
    ) THEN
        RAISE EXCEPTION
            'Bayesian stats contain users without a default workspace';
    END IF;
END;
$$;

WITH owner_workspaces AS (
    SELECT DISTINCT ON (o.created_by_user_id)
        o.created_by_user_id AS user_id,
        o.id AS organization_id,
        w.id AS workspace_id
    FROM organizations o
    JOIN workspaces w
        ON w.organization_id = o.id AND w.is_default
    ORDER BY o.created_by_user_id, o.created_at, o.id
)
INSERT INTO bayesian_experiment_results (
    organization_id, workspace_id, experiment_id, arm_name, metric,
    impressions, clicks, conversions, trials, successes,
    alpha, beta, probability_to_be_best, expected_loss,
    cold_start, ad_fatigued, evaluated_by_user_id, evaluated_at
)
SELECT
    owner_workspaces.organization_id,
    owner_workspaces.workspace_id,
    b.experiment_id,
    b.arm_name,
    b.metric,
    b.impressions,
    b.clicks,
    b.conversions,
    b.trials,
    b.successes,
    b.alpha,
    b.beta,
    b.probability_to_be_best,
    b.expected_loss,
    b.cold_start,
    b.ad_fatigued,
    b.user_id,
    b.evaluated_at
FROM bayesian_stats b
JOIN owner_workspaces ON owner_workspaces.user_id = b.user_id
ON CONFLICT (
    organization_id, workspace_id, experiment_id, arm_name, metric
) DO NOTHING;

COMMIT;
