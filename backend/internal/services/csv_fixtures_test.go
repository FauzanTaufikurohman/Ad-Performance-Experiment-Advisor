package services

import (
	"os"
	"path/filepath"
	"testing"
)

func TestMetaAdsCSVFixturesAreUploadable(t *testing.T) {
	paths, err := filepath.Glob("../../testdata/meta_ads/*.csv")
	if err != nil {
		t.Fatalf("find Meta Ads CSV fixtures: %v", err)
	}
	if len(paths) != 10 {
		t.Fatalf("fixture count = %d, want 10", len(paths))
	}

	for _, path := range paths {
		t.Run(filepath.Base(path), func(t *testing.T) {
			file, err := os.Open(path)
			if err != nil {
				t.Fatalf("open fixture: %v", err)
			}

			records, parseErr := ParseAndValidateCSV(file)
			if closeErr := file.Close(); closeErr != nil {
				t.Fatalf("close fixture: %v", closeErr)
			}
			if parseErr != nil {
				t.Fatalf("parse fixture: %v", parseErr)
			}
			if len(records) < 100 {
				t.Errorf("record count = %d, want at least 100", len(records))
			}
		})
	}
}
