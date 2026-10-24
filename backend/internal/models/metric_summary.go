package models

type MetricSummary struct {
	TotalImpressions     int64    `json:"total_impressions"`
	TotalClicks          int64    `json:"total_clicks"`
	TotalSpend           float64  `json:"total_spend"`
	TotalConversions     int64    `json:"total_conversions"`
	TotalConversionValue float64  `json:"total_conversion_value"`
	CTR                  *float64 `json:"ctr"`
	CPA                  *float64 `json:"cpa"`
	ROAS                 *float64 `json:"roas"`
}
