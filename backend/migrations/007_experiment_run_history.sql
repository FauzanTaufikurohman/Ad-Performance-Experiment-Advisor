BEGIN;

CREATE TABLE IF NOT EXISTS bayesian_experiment_runs (
    organization_id BIGINT NOT NULL
        REFERENCES organizations(id) ON DELETE CASCADE,
    workspace_id BIGINT NOT NULL,
    experiment_id VARCHAR(100) NOT NULL,
    metric VARCHAR(10) NOT NULL CHECK (metric IN ('ctr', 'cvr')),
    result JSONB NOT NULL CHECK (jsonb_typeof(result) = 'object'),
    evaluated_by_user_id BIGINT
        REFERENCES users(id) ON DELETE SET NULL,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, workspace_id, experiment_id, metric),
    FOREIGN KEY (organization_id, workspace_id)
        REFERENCES workspaces(organization_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bayesian_runs_workspace_evaluated
    ON bayesian_experiment_runs (
        organization_id, workspace_id, evaluated_at DESC
    );

WITH run_stats AS (
    SELECT
        organization_id,
        workspace_id,
        experiment_id,
        metric,
        BOOL_OR(cold_start) AS insufficient_data,
        MIN(expected_loss) AS minimum_loss
    FROM bayesian_experiment_results
    GROUP BY organization_id, workspace_id, experiment_id, metric
),
ranked_arms AS (
    SELECT
        arm.*,
        run_stats.insufficient_data,
        run_stats.minimum_loss,
        COUNT(*) FILTER (
            WHERE arm.expected_loss - run_stats.minimum_loss <= 0.001
        ) OVER (
            PARTITION BY arm.organization_id, arm.workspace_id,
                         arm.experiment_id, arm.metric
        ) AS tied_arm_count
    FROM bayesian_experiment_results arm
    JOIN run_stats USING (
        organization_id, workspace_id, experiment_id, metric
    )
),
assembled_runs AS (
    SELECT
        organization_id,
        workspace_id,
        experiment_id,
        metric,
        insufficient_data,
        MAX(tied_arm_count) AS tied_arm_count,
        MAX(evaluated_at) AS evaluated_at,
        (ARRAY_AGG(evaluated_by_user_id ORDER BY evaluated_at DESC))[1]
            AS evaluated_by_user_id,
        (ARRAY_AGG(arm_name ORDER BY expected_loss, arm_name)
            FILTER (WHERE expected_loss = minimum_loss))[1] AS winner,
        JSONB_AGG(JSONB_BUILD_OBJECT(
            'name', arm_name,
            'impressions', impressions,
            'clicks', clicks,
            'conversions', conversions,
            'probability_to_be_best', probability_to_be_best,
            'expected_loss', expected_loss,
            'cold_start', cold_start,
            'ad_fatigued', ad_fatigued
        ) ORDER BY arm_name) AS arms,
        JSONB_OBJECT_AGG(
            arm_name,
            ROUND(100.0 / NULLIF(tied_arm_count, 0), 4)
        ) FILTER (
            WHERE NOT insufficient_data
              AND expected_loss - minimum_loss <= 0.001
        ) AS budget_allocation_pct
    FROM ranked_arms
    GROUP BY organization_id, workspace_id, experiment_id, metric,
             insufficient_data
)
INSERT INTO bayesian_experiment_runs (
    organization_id, workspace_id, experiment_id, metric, result,
    evaluated_by_user_id, evaluated_at
)
SELECT
    organization_id,
    workspace_id,
    experiment_id,
    metric,
    JSONB_STRIP_NULLS(JSONB_BUILD_OBJECT(
        'experiment_id', experiment_id,
        'metric', metric,
        'status', CASE
            WHEN insufficient_data THEN 'insufficient_data'
            ELSE 'evaluated'
        END,
        'iterations', 10000,
        'winner', CASE
            WHEN NOT insufficient_data AND tied_arm_count = 1 THEN winner
            ELSE NULL
        END,
        'tied', NOT insufficient_data AND tied_arm_count > 1,
        'budget_allocation_pct', CASE
            WHEN insufficient_data THEN '{}'::JSONB
            ELSE COALESCE(budget_allocation_pct, '{}'::JSONB)
        END,
        'arms', arms
    )),
    evaluated_by_user_id,
    evaluated_at
FROM assembled_runs
ON CONFLICT (organization_id, workspace_id, experiment_id, metric)
DO NOTHING;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_bayesian_results_run'
          AND conrelid = 'bayesian_experiment_results'::regclass
    ) THEN
        ALTER TABLE bayesian_experiment_results
            ADD CONSTRAINT fk_bayesian_results_run
            FOREIGN KEY (organization_id, workspace_id, experiment_id, metric)
            REFERENCES bayesian_experiment_runs (
                organization_id, workspace_id, experiment_id, metric
            )
            ON DELETE CASCADE;
    END IF;
END;
$$;

COMMIT;
