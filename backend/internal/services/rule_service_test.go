package services

import (
	"testing"
	"time"

	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/models"
)

func TestAnalyzePerformance(t *testing.T) {
	tests := []struct {
		name      string
		records   []models.AdRecord
		metrics   models.MetricSummary
		wantCodes []string
	}{
		{
			name:      "no records",
			records:   []models.AdRecord{},
			metrics:   models.MetricSummary{},
			wantCodes: []string{"NO_DATA"},
		},
		{
			name:      "zero impressions",
			records:   []models.AdRecord{{}},
			metrics:   models.MetricSummary{},
			wantCodes: []string{"ZERO_IMPRESSIONS"},
		},
		{
			name:    "impressions without clicks",
			records: []models.AdRecord{{Impressions: 100}},
			metrics: models.MetricSummary{
				TotalImpressions: 100,
			},
			wantCodes: []string{"ZERO_CLICKS"},
		},
		{
			name: "spend without conversions",
			records: []models.AdRecord{{
				Impressions: 1000,
				Clicks:      50,
				Spend:       100,
			}},
			metrics: models.MetricSummary{
				TotalImpressions: 1000,
				TotalClicks:      50,
				TotalSpend:       100,
				CTR:              testFloatPtr(5),
			},
			wantCodes: []string{
				"SPEND_WITHOUT_CONVERSIONS",
				"CTR_AVAILABLE",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			findings := AnalyzePerformance(tt.records, tt.metrics)

			for _, code := range tt.wantCodes {
				if !containsFindingCode(findings, code) {
					t.Errorf("expected finding code %q, got %+v", code, findings)
				}
			}
		})
	}
}

func containsFindingCode(findings []models.Finding, code string) bool {
	for _, finding := range findings {
		if finding.Code == code {
			return true
		}
	}
	return false
}

func testFloatPtr(value float64) *float64 {
	return &value
}

func TestAnalyzePerformanceZeroSpend(t *testing.T) {
	records := []models.AdRecord{
		{
			Date:        time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC),
			Impressions: 100,
			Clicks:      10,
		},
	}

	metrics := models.MetricSummary{
		TotalImpressions: 100,
		TotalClicks:      10,
		CTR:              testFloatPtr(10),
	}

	findings := AnalyzePerformance(records, metrics)

	if !containsFindingCode(findings, "ZERO_SPEND") {
		t.Errorf("expected ZERO_SPEND finding, got %+v", findings)
	}

	if !containsFindingCode(findings, "CTR_AVAILABLE") {
		t.Errorf("expected CTR_AVAILABLE finding, got %+v", findings)
	}
}
