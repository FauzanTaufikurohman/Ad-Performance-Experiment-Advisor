BEGIN;

CREATE TABLE IF NOT EXISTS bayesian_stats (
    user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    experiment_id VARCHAR(100) NOT NULL,
    arm_name VARCHAR(100) NOT NULL,
    metric VARCHAR(10) NOT NULL
        CHECK (metric IN ('ctr', 'cvr')),
    impressions BIGINT NOT NULL CHECK (impressions >= 0),
    clicks BIGINT NOT NULL CHECK (clicks >= 0 AND clicks <= impressions),
    conversions BIGINT NOT NULL CHECK (
        conversions >= 0 AND conversions <= clicks
    ),
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
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, experiment_id, arm_name, metric)
);

CREATE INDEX IF NOT EXISTS idx_bayesian_stats_experiment_evaluated
    ON bayesian_stats (user_id, experiment_id, evaluated_at DESC);

CREATE OR REPLACE PROCEDURE sp_update_bayesian(
    p_user_id BIGINT,
    p_experiment_id VARCHAR(100),
    p_arm_name VARCHAR(100),
    p_metric VARCHAR(10),
    p_impressions BIGINT,
    p_clicks BIGINT,
    p_conversions BIGINT,
    p_trials BIGINT,
    p_successes BIGINT,
    p_alpha DOUBLE PRECISION,
    p_beta DOUBLE PRECISION,
    p_probability_to_be_best DOUBLE PRECISION,
    p_expected_loss DOUBLE PRECISION,
    p_cold_start BOOLEAN,
    p_ad_fatigued BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO bayesian_stats (
        user_id, experiment_id, arm_name, metric,
        impressions, clicks, conversions, trials, successes,
        alpha, beta, probability_to_be_best, expected_loss,
        cold_start, ad_fatigued, evaluated_at
    ) VALUES (
        p_user_id, p_experiment_id, p_arm_name, p_metric,
        p_impressions, p_clicks, p_conversions, p_trials, p_successes,
        p_alpha, p_beta, p_probability_to_be_best, p_expected_loss,
        p_cold_start, p_ad_fatigued, NOW()
    )
    ON CONFLICT (user_id, experiment_id, arm_name, metric)
    DO UPDATE SET
        impressions = EXCLUDED.impressions,
        clicks = EXCLUDED.clicks,
        conversions = EXCLUDED.conversions,
        trials = EXCLUDED.trials,
        successes = EXCLUDED.successes,
        alpha = EXCLUDED.alpha,
        beta = EXCLUDED.beta,
        probability_to_be_best = EXCLUDED.probability_to_be_best,
        expected_loss = EXCLUDED.expected_loss,
        cold_start = EXCLUDED.cold_start,
        ad_fatigued = EXCLUDED.ad_fatigued,
        evaluated_at = EXCLUDED.evaluated_at;
END;
$$;

COMMIT;
