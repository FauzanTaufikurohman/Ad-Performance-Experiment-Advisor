package database

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/fs"
	"regexp"
	"sort"
	"strconv"
	"time"

	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/migrations"
	"github.com/jackc/pgx/v5/pgxpool"
)

const migrationAdvisoryLock int64 = 748219631

var migrationFilename = regexp.MustCompile(`^(\d{3})_[a-z0-9_]+\.sql$`)

type migrationFile struct {
	version  string
	name     string
	checksum string
	contents []byte
}

func Migrate(ctx context.Context, pool *pgxpool.Pool) (returnErr error) {
	if pool == nil {
		return fmt.Errorf("koneksi database belum tersedia")
	}

	connection, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("gagal mengambil koneksi untuk migrasi: %w", err)
	}
	defer connection.Release()

	if _, err := connection.Exec(ctx, `SELECT pg_advisory_lock($1)`, migrationAdvisoryLock); err != nil {
		return fmt.Errorf("gagal mengunci proses migrasi: %w", err)
	}
	defer func() {
		unlockCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()

		if _, err := connection.Exec(unlockCtx, `SELECT pg_advisory_unlock($1)`, migrationAdvisoryLock); err != nil && returnErr == nil {
			returnErr = fmt.Errorf("gagal melepas kunci migrasi: %w", err)
		}
	}()

	migrationsToApply, err := loadMigrations(migrations.Files)
	if err != nil {
		return err
	}

	var trackingTableExists bool
	if err := connection.QueryRow(ctx, `
		SELECT to_regclass('public.advisora_schema_migrations') IS NOT NULL
	`).Scan(&trackingTableExists); err != nil {
		return fmt.Errorf("gagal memeriksa migration ledger: %w", err)
	}
	if !trackingTableExists {
		var hasExistingObjects bool
		if err := connection.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT 1
				FROM pg_class c
				JOIN pg_namespace n ON n.oid = c.relnamespace
				WHERE n.nspname = 'public'
				  AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
			)
		`).Scan(&hasExistingObjects); err != nil {
			return fmt.Errorf("gagal memeriksa schema PostgreSQL: %w", err)
		}
		if hasExistingObjects {
			return fmt.Errorf("database berisi tabel tanpa migration ledger; lakukan schema comparison dan siapkan prosedur adoption yang ditinjau sebelum menjalankan migrasi")
		}

		if _, err := connection.Exec(ctx, `
			CREATE TABLE public.advisora_schema_migrations (
				version VARCHAR(3) PRIMARY KEY,
				checksum CHAR(64) NOT NULL,
				state VARCHAR(16) NOT NULL CHECK (state IN ('applying', 'applied')),
				started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				applied_at TIMESTAMPTZ
			)
		`); err != nil {
			return fmt.Errorf("gagal membuat migration ledger: %w", err)
		}
	}

	var emptyLedgerHasExistingObjects bool
	if err := connection.QueryRow(ctx, `
		SELECT NOT EXISTS (
			SELECT 1 FROM public.advisora_schema_migrations
		) AND EXISTS (
			SELECT 1
			FROM pg_class c
			JOIN pg_namespace n ON n.oid = c.relnamespace
			WHERE n.nspname = 'public'
			  AND c.relname <> 'advisora_schema_migrations'
			  AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
		)
	`).Scan(&emptyLedgerHasExistingObjects); err != nil {
		return fmt.Errorf("gagal memverifikasi migration ledger: %w", err)
	}
	if emptyLedgerHasExistingObjects {
		return fmt.Errorf("migration ledger kosong tetapi schema berisi objek; lakukan schema comparison sebelum menjalankan migrasi")
	}

	applied, err := readAppliedMigrations(ctx, connection)
	if err != nil {
		return err
	}

	knownVersions := make(map[string]struct{}, len(migrationsToApply))
	for _, migration := range migrationsToApply {
		knownVersions[migration.version] = struct{}{}
	}
	for version := range applied {
		if _, exists := knownVersions[version]; !exists {
			return fmt.Errorf("migration ledger memuat versi yang tidak tersedia: %s", version)
		}
	}
	if err := validateMigrationHistory(migrationsToApply, applied); err != nil {
		return err
	}

	for _, migration := range migrationsToApply {
		record, exists := applied[migration.version]
		if exists {
			if record.checksum != migration.checksum {
				return fmt.Errorf("checksum migrasi %s berubah setelah diterapkan", migration.name)
			}
			if record.state != "applied" {
				return fmt.Errorf("migrasi %s berstatus %q; verifikasi database sebelum melanjutkan", migration.name, record.state)
			}
			continue
		}

		if _, err := connection.Exec(ctx, `
			INSERT INTO public.advisora_schema_migrations (version, checksum, state)
			VALUES ($1, $2, 'applying')
		`, migration.version, migration.checksum); err != nil {
			return fmt.Errorf("gagal mencatat awal migrasi %s: %w", migration.name, err)
		}

		if _, err := connection.Conn().PgConn().Exec(ctx, string(migration.contents)).ReadAll(); err != nil {
			return fmt.Errorf("migrasi %s gagal; ledger dibiarkan berstatus applying untuk mencegah replay: %w", migration.name, err)
		}
		commandTag, err := connection.Exec(ctx, `
			UPDATE public.advisora_schema_migrations
			SET state = 'applied', applied_at = NOW()
			WHERE version = $1 AND checksum = $2 AND state = 'applying'
		`, migration.version, migration.checksum)
		if err != nil {
			return fmt.Errorf("migrasi %s berjalan tetapi ledger gagal diperbarui: %w", migration.name, err)
		}
		if commandTag.RowsAffected() != 1 {
			return fmt.Errorf("migrasi %s berjalan tetapi catatan ledger tidak berubah", migration.name)
		}

		applied[migration.version] = appliedMigration{
			checksum: migration.checksum,
			state:    "applied",
		}
	}

	return nil
}

type appliedMigration struct {
	checksum string
	state    string
}

func validateMigrationHistory(
	migrationFiles []migrationFile,
	applied map[string]appliedMigration,
) error {
	foundGap := false
	for _, migration := range migrationFiles {
		_, exists := applied[migration.version]
		if !exists {
			foundGap = true
			continue
		}
		if foundGap {
			return fmt.Errorf("migration ledger tidak berurutan pada versi %s", migration.version)
		}
	}
	return nil
}

func readAppliedMigrations(
	ctx context.Context,
	connection *pgxpool.Conn,
) (map[string]appliedMigration, error) {
	rows, err := connection.Query(ctx, `
		SELECT version, checksum, state
		FROM public.advisora_schema_migrations
	`)
	if err != nil {
		return nil, fmt.Errorf("gagal membaca migration ledger: %w", err)
	}
	defer rows.Close()

	applied := make(map[string]appliedMigration)
	for rows.Next() {
		var version, checksum, state string
		if err := rows.Scan(&version, &checksum, &state); err != nil {
			return nil, fmt.Errorf("gagal membaca versi migrasi: %w", err)
		}
		applied[version] = appliedMigration{checksum: checksum, state: state}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterasi migration ledger gagal: %w", err)
	}
	return applied, nil
}

func loadMigrations(files fs.FS) ([]migrationFile, error) {
	entries, err := fs.ReadDir(files, ".")
	if err != nil {
		return nil, fmt.Errorf("gagal membaca daftar migrasi: %w", err)
	}

	migrationNames := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if migrationFilename.MatchString(entry.Name()) {
			migrationNames = append(migrationNames, entry.Name())
		}
	}
	sort.Strings(migrationNames)
	if len(migrationNames) == 0 {
		return nil, fmt.Errorf("tidak ada file migrasi yang valid")
	}

	result := make([]migrationFile, 0, len(migrationNames))
	for index, name := range migrationNames {
		match := migrationFilename.FindStringSubmatch(name)
		versionNumber, err := strconv.Atoi(match[1])
		if err != nil {
			return nil, fmt.Errorf("versi migrasi %q tidak valid: %w", name, err)
		}
		if versionNumber != index+1 {
			return nil, fmt.Errorf("urutan migrasi tidak berkelanjutan pada %q", name)
		}

		contents, err := fs.ReadFile(files, name)
		if err != nil {
			return nil, fmt.Errorf("gagal membaca migrasi %s: %w", name, err)
		}
		checksum := sha256.Sum256(contents)
		result = append(result, migrationFile{
			version:  match[1],
			name:     name,
			checksum: hex.EncodeToString(checksum[:]),
			contents: contents,
		})
	}

	return result, nil
}
