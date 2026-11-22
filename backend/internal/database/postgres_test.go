package database

import (
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestConfigurePoolUsesBoundedEnvironmentSettings(t *testing.T) {
	t.Setenv("DB_MAX_CONNS", "32")
	t.Setenv("DB_MIN_CONNS", "4")
	t.Setenv("DB_MAX_CONN_LIFETIME_SECONDS", "1800")
	t.Setenv("DB_MAX_CONN_IDLE_TIME_SECONDS", "120")

	config, err := pgxpool.ParseConfig("postgres://user:pass@localhost:5432/db")
	if err != nil {
		t.Fatalf("ParseConfig() error = %v", err)
	}
	if err := configurePool(config); err != nil {
		t.Fatalf("configurePool() error = %v", err)
	}

	if config.MaxConns != 32 || config.MinConns != 4 {
		t.Errorf("pool limits = %d/%d, want 32/4", config.MaxConns, config.MinConns)
	}
	if config.MaxConnLifetime != 30*time.Minute {
		t.Errorf("MaxConnLifetime = %s, want 30m", config.MaxConnLifetime)
	}
	if config.MaxConnIdleTime != 2*time.Minute {
		t.Errorf("MaxConnIdleTime = %s, want 2m", config.MaxConnIdleTime)
	}
}

func TestConfigurePoolRejectsInvalidLimits(t *testing.T) {
	t.Setenv("DB_MAX_CONNS", "4")
	t.Setenv("DB_MIN_CONNS", "5")
	t.Setenv("DB_MAX_CONN_LIFETIME_SECONDS", "3600")
	t.Setenv("DB_MAX_CONN_IDLE_TIME_SECONDS", "300")

	config, err := pgxpool.ParseConfig("postgres://user:pass@localhost:5432/db")
	if err != nil {
		t.Fatalf("ParseConfig() error = %v", err)
	}

	if err := configurePool(config); err == nil {
		t.Fatal("configurePool() accepted minimum connections above maximum")
	}
}
