package services

import (
	"strings"
	"testing"
)

func TestParseAndValidateCSV(t *testing.T) {
	tests := []struct {
		name        string
		csv         string
		wantErr     bool
		wantRecords int
	}{
		{
			name: "valid CSV",
			csv: `date,campaign,impressions,clicks,spend,conversions,conversion_value
2026-10-01,Campaign A,1000,50,100,5,300
2026-10-02,Campaign B,2000,100,200,10,600`,
			wantErr:     false,
			wantRecords: 2,
		},
		{
			name: "missing required header",
			csv: `date,campaign,impressions,clicks,spend,conversions
2026-10-01,Campaign A,1000,50,100,5`,
			wantErr: true,
		},
		{
			name: "invalid date",
			csv: `date,campaign,impressions,clicks,spend,conversions,conversion_value
01-10-2026,Campaign A,1000,50,100,5,300`,
			wantErr: true,
		},
		{
			name: "invalid numeric value",
			csv: `date,campaign,impressions,clicks,spend,conversions,conversion_value
2026-10-01,Campaign A,one-thousand,50,100,5,300`,
			wantErr: true,
		},
		{
			name: "negative spend",
			csv: `date,campaign,impressions,clicks,spend,conversions,conversion_value
2026-10-01,Campaign A,1000,50,-100,5,300`,
			wantErr: true,
		},
		{
			name: "clicks exceed impressions",
			csv: `date,campaign,impressions,clicks,spend,conversions,conversion_value
2026-10-01,Campaign A,100,150,100,5,300`,
			wantErr: true,
		},
		{
			name: "incomplete row",
			csv: `date,campaign,impressions,clicks,spend,conversions,conversion_value
2026-10-01,Campaign A,1000,50,100`,
			wantErr: true,
		},
		{
    name: "NaN spend",
    csv: `date,campaign,impressions,clicks,spend,conversions,conversion_value
		2026-10-01,Campaign A,1000,50,NaN,5,300`,
			wantErr: true,
		},
		{
			name: "infinite spend",
			csv: `date,campaign,impressions,clicks,spend,conversions,conversion_value
		2026-10-01,Campaign A,1000,50,+Inf,5,300`,
			wantErr: true,
		},
		{
			name: "infinite conversion value",
			csv: `date,campaign,impressions,clicks,spend,conversions,conversion_value
		2026-10-01,Campaign A,1000,50,100,5,Inf`,
			wantErr: true,
		},
		{
			name: "negative conversion value",
			csv: `date,campaign,impressions,clicks,spend,conversions,conversion_value
		2026-10-01,Campaign A,1000,50,100,5,-300`,
			wantErr: true,
		},
		{
			name: "empty campaign",
			csv: `date,campaign,impressions,clicks,spend,conversions,conversion_value
		2026-10-01, ,1000,50,100,5,300`,
			wantErr: true,
		},
		{
			name: "empty data",
			csv: `date,campaign,impressions,clicks,spend,conversions,conversion_value`,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			records, err := ParseAndValidateCSV(
				strings.NewReader(tt.csv),
			)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected an error, got nil")
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if len(records) != tt.wantRecords {
				t.Errorf(
					"record count = %d, want %d",
					len(records),
					tt.wantRecords,
				)
			}
		})
	}
}
