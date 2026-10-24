package services

import (
	"encoding/csv"
	"fmt"
	"io"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/models"
)

var requiredColumns = []string{
	"date",
	"campaign",
	"impressions",
	"clicks",
	"spend",
	"conversions",
	"conversion_value",
}

func ParseAndValidateCSV(input io.Reader) ([]models.AdRecord, error) {
	reader := csv.NewReader(input)
	reader.FieldsPerRecord = -1

	header, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("header CSV tidak dapat dibaca")
	}

	columnIndex := make(map[string]int)

	for i, column := range header {
		name := strings.TrimSpace(strings.TrimPrefix(column, "\uFEFF"))
		name = strings.ToLower(name)

		if name == "" {
			return nil, fmt.Errorf("CSV memiliki nama kolom kosong")
		}

		if _, exists := columnIndex[name]; exists {
			return nil, fmt.Errorf("nama kolom duplikat: %s", name)
		}

		columnIndex[name] = i
	}

	for _, name := range requiredColumns {
		if _, exists := columnIndex[name]; !exists {
			return nil, fmt.Errorf("kolom wajib tidak ditemukan: %s", name)
		}
	}

	var records []models.AdRecord
	line := 1

	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		line++

		if err != nil {
			return nil, fmt.Errorf("CSV tidak valid pada baris %d", line)
		}

		if len(row) != len(header) {
			return nil, fmt.Errorf(
				"jumlah kolom tidak sesuai pada baris %d", line,
			)
		}

		get := func(name string) string {
			return strings.TrimSpace(row[columnIndex[name]])
		}

		if strings.TrimSpace(strings.Join(row, "")) == "" {
			return nil, fmt.Errorf("baris %d kosong", line)
		}

		date, err := time.Parse("2006-01-02", get("date"))
		if err != nil {
			return nil, fmt.Errorf(
				"tanggal tidak valid pada baris %d: gunakan YYYY-MM-DD", line,
			)
		}

		campaign := get("campaign")
		if campaign == "" {
			return nil, fmt.Errorf("campaign kosong pada baris %d", line)
		}

		impressions, err := strconv.ParseInt(get("impressions"), 10, 64)
		if err != nil || impressions < 0 {
			return nil, fmt.Errorf("impressions tidak valid pada baris %d", line)
		}

		clicks, err := strconv.ParseInt(get("clicks"), 10, 64)
		if err != nil || clicks < 0 {
			return nil, fmt.Errorf("clicks tidak valid pada baris %d", line)
		}

		spend, err := strconv.ParseFloat(get("spend"), 64)
		if err != nil || math.IsNaN(spend) || math.IsInf(spend, 0) || spend < 0 {
			return nil, fmt.Errorf("spend tidak valid pada baris %d", line)
		}

		conversions, err := strconv.ParseInt(get("conversions"), 10, 64)
		if err != nil || conversions < 0 {
			return nil, fmt.Errorf("conversions tidak valid pada baris %d", line)
		}

		conversionValue, err := strconv.ParseFloat(get("conversion_value"), 64)
		if err != nil || math.IsNaN(conversionValue) ||
			math.IsInf(conversionValue, 0) || conversionValue < 0 {
			return nil, fmt.Errorf(
				"conversion_value tidak valid pada baris %d", line,
			)
		}

		if clicks > impressions {
			return nil, fmt.Errorf(
				"clicks melebihi impressions pada baris %d", line,
			)
		}

		records = append(records, models.AdRecord{
			Date:            date,
			Campaign:        campaign,
			Impressions:     impressions,
			Clicks:          clicks,
			Spend:           spend,
			Conversions:     conversions,
			ConversionValue: conversionValue,
		})
	}

	if len(records) == 0 {
		return nil, fmt.Errorf("CSV belum memiliki baris data")
	}

	return records, nil
}
