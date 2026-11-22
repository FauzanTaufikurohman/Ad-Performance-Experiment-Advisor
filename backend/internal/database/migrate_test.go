package database

import (
	"strings"
	"testing"
	"testing/fstest"

	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/migrations"
)

func TestLoadMigrationsReturnsSequentialChecksummedFiles(t *testing.T) {
	files, err := loadMigrations(migrations.Files)
	if err != nil {
		t.Fatalf("loadMigrations() error = %v", err)
	}
	if len(files) != 8 {
		t.Fatalf("loadMigrations() returned %d files, want 8", len(files))
	}
	if files[0].version != "001" || files[len(files)-1].version != "008" {
		t.Fatalf("migration versions = %s through %s, want 001 through 008", files[0].version, files[len(files)-1].version)
	}
	for _, file := range files {
		if len(file.checksum) != 64 {
			t.Errorf("migration %s checksum length = %d, want 64", file.name, len(file.checksum))
		}
	}
}

func TestLoadMigrationsRejectsVersionGaps(t *testing.T) {
	files := fstest.MapFS{
		"001_initial.sql": &fstest.MapFile{Data: []byte("SELECT 1;")},
		"003_later.sql":   &fstest.MapFile{Data: []byte("SELECT 1;")},
	}

	_, err := loadMigrations(files)
	if err == nil || !strings.Contains(err.Error(), "tidak berkelanjutan") {
		t.Fatalf("loadMigrations() error = %v, want a version-gap error", err)
	}
}

func TestValidateMigrationHistoryRejectsAppliedVersionAfterGap(t *testing.T) {
	migrations := []migrationFile{
		{version: "001"},
		{version: "002"},
		{version: "003"},
	}
	applied := map[string]appliedMigration{
		"001": {checksum: "checksum", state: "applied"},
		"003": {checksum: "checksum", state: "applied"},
	}

	err := validateMigrationHistory(migrations, applied)
	if err == nil || !strings.Contains(err.Error(), "tidak berurutan") {
		t.Fatalf("validateMigrationHistory() error = %v, want a non-sequential history error", err)
	}
}
