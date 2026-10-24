package services

import (
	"context"
	"fmt"

	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/models"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SaveUpload menyimpan data upload dan hasil analisis dalam satu transaksi.
func SaveUpload(
	ctx context.Context,
	pool *pgxpool.Pool,
	userID int64,
	filename string,
	records []models.AdRecord,
	metrics models.MetricSummary,
	findings []models.Finding,
) (int64, error) {
	if pool == nil {
		return 0, fmt.Errorf("koneksi database belum tersedia")
	}
	if userID < 1 {
		return 0, fmt.Errorf("ID pengguna tidak valid")
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("gagal memulai transaksi: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	var uploadID int64
	err = tx.QueryRow(ctx, `
		INSERT INTO uploads (user_id, filename, status, row_count)
		VALUES ($1, $2, 'processing', $3)
		RETURNING id
	`, userID, filename, len(records)).Scan(&uploadID)
	if err != nil {
		return 0, fmt.Errorf("gagal menyimpan upload: %w", err)
	}

	for i, record := range records {
		_, err = tx.Exec(ctx, `
			INSERT INTO ad_records (
				upload_id,
				record_date,
				campaign,
				impressions,
				clicks,
				spend,
				conversions,
				conversion_value
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`,
			uploadID,
			record.Date,
			record.Campaign,
			record.Impressions,
			record.Clicks,
			record.Spend,
			record.Conversions,
			record.ConversionValue,
		)
		if err != nil {
			return 0, fmt.Errorf(
				"gagal menyimpan record baris %d: %w",
				i+1,
				err,
			)
		}
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO metric_summaries (
			upload_id,
			total_impressions,
			total_clicks,
			total_spend,
			total_conversions,
			total_conversion_value,
			ctr,
			cpa,
			roas
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`,
		uploadID,
		metrics.TotalImpressions,
		metrics.TotalClicks,
		metrics.TotalSpend,
		metrics.TotalConversions,
		metrics.TotalConversionValue,
		metrics.CTR,
		metrics.CPA,
		metrics.ROAS,
	)
	if err != nil {
		return 0, fmt.Errorf("gagal menyimpan ringkasan metrik: %w", err)
	}

	for _, finding := range findings {
		_, err = tx.Exec(ctx, `
			INSERT INTO findings (
				upload_id,
				code,
				severity,
				title,
				description
			)
			VALUES ($1, $2, $3, $4, $5)
		`,
			uploadID,
			finding.Code,
			finding.Severity,
			finding.Title,
			finding.Description,
		)
		if err != nil {
			return 0, fmt.Errorf(
				"gagal menyimpan finding %q: %w",
				finding.Code,
				err,
			)
		}
	}

	_, err = tx.Exec(ctx, `
		UPDATE uploads
		SET status = 'completed'
		WHERE id = $1
	`, uploadID)
	if err != nil {
		return 0, fmt.Errorf("gagal memperbarui status upload: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("gagal melakukan commit transaksi: %w", err)
	}

	return uploadID, nil
}
