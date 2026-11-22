package database

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func NewPostgresPool(ctx context.Context) (*pgxpool.Pool, error) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL belum dikonfigurasi")
	}

	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("konfigurasi database tidak valid: %w", err)
	}

	if err := configurePool(config); err != nil {
		return nil, err
	}

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("gagal membuat koneksi database: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("gagal terhubung ke PostgreSQL: %w", err)
	}

	return pool, nil
}

func configurePool(config *pgxpool.Config) error {
	maxConns, err := poolIntSetting("DB_MAX_CONNS", 10, 1, 1000)
	if err != nil {
		return err
	}
	minConns, err := poolIntSetting("DB_MIN_CONNS", 1, 0, 1000)
	if err != nil {
		return err
	}
	if minConns > maxConns {
		return fmt.Errorf("DB_MIN_CONNS no boleh melebihi DB_MAX_CONNS")
	}

	maxLifetimeSeconds, err := poolIntSetting(
		"DB_MAX_CONN_LIFETIME_SECONDS",
		3600,
		1,
		86400,
	)
	if err != nil {
		return err
	}
	maxIdleSeconds, err := poolIntSetting(
		"DB_MAX_CONN_IDLE_TIME_SECONDS",
		300,
		1,
		86400,
	)
	if err != nil {
		return err
	}

	config.MaxConns = int32(maxConns)
	config.MinConns = int32(minConns)
	config.MaxConnLifetime = time.Duration(maxLifetimeSeconds) * time.Second
	config.MaxConnIdleTime = time.Duration(maxIdleSeconds) * time.Second
	return nil
}

func poolIntSetting(name string, fallback, minimum, maximum int64) (int64, error) {
	value := os.Getenv(name)
	if value == "" {
		return fallback, nil
	}

	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil || parsed < minimum || parsed > maximum {
		return 0, fmt.Errorf(
			"%s harus berupa bilangan antara %d dan %d",
			name,
			minimum,
			maximum,
		)
	}

	return parsed, nil
}
