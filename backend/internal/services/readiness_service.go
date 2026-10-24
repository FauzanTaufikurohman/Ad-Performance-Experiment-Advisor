package services

import (
	"sort"

	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/models"
)

func EvaluateExperimentReadiness(
	records []models.AdRecord,
	metrics models.MetricSummary,
) models.ExperimentReadiness {
	result := models.ExperimentReadiness{
		Status:            "insufficient_data",
		Summary:           "Data belum memadai untuk evaluasi dasar.",
		RowCount:          len(records),
		EligibleForReview: false,
		Checks:            []models.ReadinessCheck{},
		Limitations: []string{
			"Pemeriksaan ini tidak membuktikan signifikansi statistik.",
			"Perbandingan varian iklan memerlukan identitas varian dan desain eksperimen yang sesuai.",
			"Validitas hasil juga bergantung pada tracking konversi dan atribusi.",
		},
	}

	if len(records) == 0 {
		result.Checks = append(result.Checks, models.ReadinessCheck{
			Code:    "NO_RECORDS",
			Status:  "fail",
			Message: "Tidak ada baris data untuk dievaluasi",
		})
		return result
	}

	dates := make([]string, 0, len(records))

	for _, record := range records {
		dates = append(dates, record.Date.Format("2006-01-02"))
	}

	sort.Strings(dates)
	result.StartDate = dates[0]
	result.EndDate = dates[len(dates)-1]

	if metrics.TotalImpressions <= 0 {
		result.Checks = append(result.Checks, models.ReadinessCheck{
			Code:    "NO_IMPRESSIONS",
			Status:  "fail",
			Message: "Total impresi harus lebih dari nol untuk evaluasi performa dasar.",
		})
		return result
	}

	result.Checks = append(result.Checks, models.ReadinessCheck{
		Code:    "IMPRESSIONS_AVAILABLE",
		Status:  "pass",
		Message: "Data memiliki impresi lebih dari nol",
	})

	if metrics.TotalClicks <= 0 {
		result.Checks = append(result.Checks, models.ReadinessCheck{
			Code:    "NO_CLICKS",
			Status:  "review",
			Message: "Belum ada klik. CTR dapat dihitung, tetapi nilainya nol dan perlu ditinjau sesuai konteks.",
		})
	}

	if metrics.TotalConversions > 0 {
		result.Checks = append(result.Checks, models.ReadinessCheck{
			Code:    "NO_CONVERSIONS",
			Status:  "review",
			Message: "Belum ada konversi. CPA tidak dapat dihitung.",
		})
	}

	if metrics.TotalClicks > 0 {
		result.Checks = append(result.Checks, models.ReadinessCheck{
			Code:    "CLICKS_AVAILABLE",
			Status:  "pass",
			Message: "Data memiliki klik lebih dari nol.",
		})
	}

	if metrics.TotalConversions > 0 {
		result.Checks = append(result.Checks, models.ReadinessCheck{
			Code:    "CONVERSIONS_AVAILABLE",
			Status:  "pass",
			Message: "Data memiliki Konversi lebih dari nol.",
		})
	}

	hasReview := metrics.TotalClicks <= 0 || metrics.TotalConversions <= 0
	result.EligibleForReview = true

	if hasReview {
		result.Status = "needs_review"
		result.Summary = "Data tersedia, tetapi terdapat keterbatasan yang perlu ditinjau."
	} else {
		result.Status = "basic_checks_passed"
		result.Summary = "Pemeriksaan data dasar lolos. Kecukupan statistik belum dievaluasi."
	}

	return result
}
