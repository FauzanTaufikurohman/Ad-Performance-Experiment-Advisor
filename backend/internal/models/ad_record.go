package models

import "time"

type AdRecord struct {
	Date            time.Time `json:"date"`
	Campaign        string    `json:"campaign"`
	Impressions     int64     `json:"impressions"`
	Clicks          int64     `json:"clicks"`
	Spend           float64   `json:"spend"`
	Conversions     int64     `json:"conversions"`
	ConversionValue float64   `json:"conversion_value"`
}
