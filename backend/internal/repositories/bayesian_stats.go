package repositories

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BayesianStatsRepository struct {
	Pool *pgxpool.Pool
}

func (repository BayesianStatsRepository) SaveBayesianStats(
	ctx context.Context,
	userID int64,
	organizationID int64,
	result models.BayesianExperimentResult,
) error {
	if repository.Pool == nil {
		return errors.New("koneksi database belum tersedia")
	}
	if userID < 1 || organizationID < 1 || len(result.Arms) == 0 {
		return errors.New("pengguna, organisasi, atau hasil eksperimen tidak valid")
	}
	resultJSON, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("gagal menyiapkan hasil eksperimen: %w", err)
	}

	transaction, err := repository.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("gagal memulai transaksi statistik Bayesian: %w", err)
	}
	defer transaction.Rollback(ctx)

	var workspaceID int64
	err = transaction.QueryRow(ctx, `
		SELECT id
		FROM workspaces
		WHERE organization_id = $1 AND is_default
	`, organizationID).Scan(&workspaceID)
	if err != nil {
		return fmt.Errorf("gagal menentukan workspace eksperimen: %w", err)
	}

	_, err = transaction.Exec(ctx, `
		INSERT INTO bayesian_experiment_runs (
			organization_id, workspace_id, experiment_id, metric, result,
			evaluated_by_user_id, evaluated_at
		)
		VALUES ($1, $2, $3, $4, $5::JSONB, $6, NOW())
		ON CONFLICT (organization_id, workspace_id, experiment_id, metric)
		DO UPDATE SET
			result = EXCLUDED.result,
			evaluated_by_user_id = EXCLUDED.evaluated_by_user_id,
			evaluated_at = EXCLUDED.evaluated_at
	`, organizationID, workspaceID, result.ExperimentID, result.Metric, string(resultJSON), userID)
	if err != nil {
		return fmt.Errorf("gagal menyimpan ringkasan eksperimen: %w", err)
	}

	_, err = transaction.Exec(ctx, `
		DELETE FROM bayesian_experiment_results
		WHERE organization_id = $1 AND workspace_id = $2
		  AND experiment_id = $3 AND metric = $4
	`, organizationID, workspaceID, result.ExperimentID, result.Metric)
	if err != nil {
		return fmt.Errorf("gagal mengganti arms eksperimen: %w", err)
	}

	var batch pgx.Batch
	for _, arm := range result.Arms {
		trials := arm.Impressions
		successes := arm.Clicks
		posterior := arm.PosteriorCTR
		if result.Metric == models.BayesianMetricCVR {
			trials = arm.Clicks
			successes = arm.Conversions
			posterior = arm.PosteriorCVR
		}

		batch.Queue(`
			INSERT INTO bayesian_experiment_results (
				organization_id, workspace_id, experiment_id, arm_name, metric,
				impressions, clicks, conversions, trials, successes,
				alpha, beta, probability_to_be_best, expected_loss,
				cold_start, ad_fatigued, evaluated_by_user_id, evaluated_at
			)
			VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8, $9,
				$10, $11, $12, $13, $14, $15, $16, $17, NOW()
			)
			ON CONFLICT (
				organization_id, workspace_id, experiment_id, arm_name, metric
			)
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
				evaluated_by_user_id = EXCLUDED.evaluated_by_user_id,
				evaluated_at = EXCLUDED.evaluated_at
		`,
			organizationID,
			workspaceID,
			result.ExperimentID,
			arm.Name,
			result.Metric,
			arm.Impressions,
			arm.Clicks,
			arm.Conversions,
			trials,
			successes,
			posterior.Alpha,
			posterior.Beta,
			arm.ProbabilityToBeBest,
			arm.ExpectedLoss,
			arm.ColdStart,
			arm.AdFatigued,
			userID,
		)
	}

	batchResults := transaction.SendBatch(ctx, &batch)
	for range result.Arms {
		if _, err := batchResults.Exec(); err != nil {
			_ = batchResults.Close()
			return fmt.Errorf("gagal menyimpan statistik Bayesian: %w", err)
		}
	}
	if err := batchResults.Close(); err != nil {
		return fmt.Errorf("gagal menutup batch statistik Bayesian: %w", err)
	}

	if err := transaction.Commit(ctx); err != nil {
		return fmt.Errorf("gagal menyimpan transaksi statistik Bayesian: %w", err)
	}

	return nil
}

func (repository BayesianStatsRepository) ListBayesianExperimentRuns(
	ctx context.Context,
	organizationID int64,
	page int,
	limit int,
) ([]models.BayesianExperimentRun, int64, error) {
	if repository.Pool == nil {
		return nil, 0, errors.New("koneksi database belum tersedia")
	}
	if organizationID < 1 || page < 1 || limit < 1 || limit > 100 {
		return nil, 0, errors.New("organisasi atau pagination tidak valid")
	}

	var workspaceID int64
	err := repository.Pool.QueryRow(ctx, `
		SELECT id
		FROM workspaces
		WHERE organization_id = $1 AND is_default
	`, organizationID).Scan(&workspaceID)
	if err != nil {
		return nil, 0, fmt.Errorf("gagal menentukan workspace riwayat eksperimen: %w", err)
	}

	var total int64
	if err := repository.Pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM bayesian_experiment_runs
		WHERE organization_id = $1 AND workspace_id = $2
	`, organizationID, workspaceID).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("gagal menghitung riwayat eksperimen: %w", err)
	}

	rows, err := repository.Pool.Query(ctx, `
		SELECT r.result, COALESCE(u.name, ''), r.evaluated_at
		FROM bayesian_experiment_runs r
		LEFT JOIN users u ON u.id = r.evaluated_by_user_id
		WHERE r.organization_id = $1 AND r.workspace_id = $2
		ORDER BY r.evaluated_at DESC, r.experiment_id, r.metric
		LIMIT $3 OFFSET $4
	`, organizationID, workspaceID, limit, (page-1)*limit)
	if err != nil {
		return nil, 0, fmt.Errorf("gagal mengambil riwayat eksperimen: %w", err)
	}
	defer rows.Close()

	runs := make([]models.BayesianExperimentRun, 0)
	for rows.Next() {
		var (
			run        models.BayesianExperimentRun
			resultJSON []byte
		)
		if err := rows.Scan(&resultJSON, &run.EvaluatedBy, &run.EvaluatedAt); err != nil {
			return nil, 0, fmt.Errorf("gagal membaca riwayat eksperimen: %w", err)
		}
		if err := json.Unmarshal(resultJSON, &run.Result); err != nil {
			return nil, 0, fmt.Errorf("format riwayat eksperimen tidak valid: %w", err)
		}
		runs = append(runs, run)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterasi riwayat eksperimen gagal: %w", err)
	}

	return runs, total, nil
}
