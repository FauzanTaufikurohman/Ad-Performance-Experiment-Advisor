package services

import (
	"math"

	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/models"
)

func CalculateMetrics(records []models.AdRecord) models.MetricSummary {
	var summary models.MetricSummary

	for _, record := range records {
		summary.TotalImpressions += record.Impressions
		summary.TotalClicks += record.Clicks
		summary.TotalSpend += record.Spend
		summary.TotalConversions += record.Conversions
		summary.TotalConversionValue += record.ConversionValue
	}

	//CTR = total clicks/ total impressions * 100
	if summary.TotalImpressions > 0 {
		value := float64(summary.TotalClicks) /
			float64(summary.TotalImpressions) * 100
		summary.CTR = floatPtr(value)
	}

	// CPA = total spend / total conversions
	if summary.TotalConversions > 0 {
		value := summary.TotalSpend /
			float64(summary.TotalConversions)
		summary.CPA = floatPtr(value)
	}

	// ROAS = total conversion value / total spend
	if summary.TotalSpend > 0 {
		value := summary.TotalConversionValue / summary.TotalSpend
		summary.ROAS = floatPtr(value)
	}

	if summary.CTR != nil && (math.IsNaN(*summary.CTR) || math.IsInf(*summary.CTR, 0)) {
		summary.CTR = nil
	}
	if summary.CPA != nil && (math.IsNaN(*summary.CPA) || math.IsInf(*summary.CPA, 0)) {
		summary.CPA = nil
	}
	if summary.ROAS != nil && (math.IsNaN(*summary.ROAS) || math.IsInf(*summary.ROAS, 0)) {
		summary.ROAS = nil
	}

	return summary
}

func floatPtr(value float64) *float64 {
	return &value
}
