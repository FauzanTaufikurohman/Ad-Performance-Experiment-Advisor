package services

import (
	"testing"
	"time"

	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/models"
)

func TestEvaluateExperimentReadiness(t *testing.T) {
	tests := []struct {
		name         string
		records      []models.AdRecord
		metrics      models.MetricSummary
		wantStatus   string
		wantEligible bool
	}{
		{
			name:         "empty dataset",
			records:      nil,
			metrics:      models.MetricSummary{},
			wantStatus:   "insufficient_data",
			wantEligible: false,
		},
		{
			name: "zero impressions",
			records: []models.AdRecord{
				{Date: time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)},
			},
			metrics:      models.MetricSummary{},
			wantStatus:   "insufficient_data",
			wantEligible: false,
		},
		{
			name: "impressions but no clicks or conversions",
			records: []models.AdRecord{
				{Date: time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC), Impressions: 100},
			},
			metrics: models.MetricSummary{
				TotalImpressions: 100,
			},
			wantStatus:   "needs_review",
			wantEligible: true,
		},
		{
			name: "basic checks passed",
			records: []models.AdRecord{
				{Date: time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC), Impressions: 1000, Clicks: 50, Conversions: 5},
			},
			metrics: models.MetricSummary{
				TotalImpressions: 1000,
				TotalClicks:      50,
				TotalConversions: 5,
			},
			wantStatus:   "basic_checks_passed",
			wantEligible: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := EvaluateExperimentReadiness(tt.records, tt.metrics)

			if got.Status != tt.wantStatus {
				t.Errorf("Status = %q, want %q", got.Status, tt.wantStatus)
			}

			if got.EligibleForReview != tt.wantEligible {
				t.Errorf(
					"EligibleForReview = %v, want %v",
					got.EligibleForReview,
					tt.wantEligible,
				)
			}

			if len(tt.records) > 0 && got.RowCount != len(tt.records) {
				t.Errorf("RowCount = %d, want %d", got.RowCount, len(tt.records))
			}
		})
	}
}
