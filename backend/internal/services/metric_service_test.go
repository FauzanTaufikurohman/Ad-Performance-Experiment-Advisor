package services

import (
	"math"
	"testing"
	"time"

	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/models"
)

func TestCalculateMetrics(t *testing.T) {
	records := []models.AdRecord{
		{
			Date:            time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC),
			Campaign:        "Campaign A",
			Impressions:     1000,
			Clicks:          50,
			Spend:           100,
			Conversions:     5,
			ConversionValue: 300,
		},
		{
			Date:            time.Date(2026, 10, 2, 0, 0, 0, 0, time.UTC),
			Campaign:        "Campaign B",
			Impressions:     2000,
			Clicks:          100,
			Spend:           200,
			Conversions:     10,
			ConversionValue: 600,
		},
	}

	got := CalculateMetrics(records)

	if got.TotalImpressions != 3000 {
		t.Errorf("TotalImpressions = %d, want 3000", got.TotalImpressions)
	}

	if got.TotalClicks != 150 {
		t.Errorf("TotalClicks = %d, want 150", got.TotalClicks)
	}

	if got.TotalSpend != 300 {
		t.Errorf("TotalSpend = %v, want 300", got.TotalSpend)
	}

	if got.TotalConversions != 15 {
		t.Errorf("TotalConversions = %d, want 15", got.TotalConversions)
	}

	if got.TotalConversionValue != 900 {
		t.Errorf("TotalConversionValue = %v, want 900", got.TotalConversionValue)
	}

	assertFloat(t, "CTR", got.CTR, 5.0)
	assertFloat(t, "CPA", got.CPA, 20.0)
	assertFloat(t, "ROAS", got.ROAS, 3.0)
}

func TestCalculateMetricsWithZeroValues(t *testing.T) {
	records := []models.AdRecord{
		{
			Impressions: 0,
			Clicks:      0,
			Spend:       0,
			Conversions: 0,
		},
	}

	got := CalculateMetrics(records)

	if got.CTR != nil {
		t.Errorf("CTR = %v, want nil", *got.CTR)
	}

	if got.CPA != nil {
		t.Errorf("CPA = %v, want nil", *got.CPA)
	}

	if got.ROAS != nil {
		t.Errorf("ROAS = %v, want nil", *got.ROAS)
	}
}

func assertFloat(t *testing.T, name string, got *float64, want float64) {
	t.Helper()

	if got == nil {
		t.Fatalf("%s = nil, want %v", name, want)
	}

	if math.Abs(*got-want) > 0.000001 {
		t.Errorf("%s = %v, want %v", name, *got, want)
	}
}
