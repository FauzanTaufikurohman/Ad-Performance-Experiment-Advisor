package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/database"
	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/routes"
	"github.com/joho/godotenv"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	if err := godotenv.Load(); err != nil {
		log.Printf("INFO: file .env tidak dimuat: %v", err)
	}

	ctx, stop := signal.NotifyContext(
		context.Background(),
		os.Interrupt,
		syscall.SIGTERM,
	)
	defer stop()

	databaseCtx, cancelDatabase := context.WithTimeout(ctx, 10*time.Second)
	pool, err := database.NewPostgresPool(databaseCtx)
	cancelDatabase()
	if err != nil {
		return fmt.Errorf("koneksi PostgreSQL gagal: %w", err)
	}
	defer pool.Close()

	log.Println("INFO: koneksi PostgreSQL berhasil")

	port := os.Getenv("APP_PORT")
	if port == "" {
		port = "8080"
	}

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           routes.SetupRoutes(pool),
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}

	log.Printf("INFO: server berjalan pada port %s", port)
	serverErrors := make(chan error, 1)
	go func() {
		serverErrors <- server.ListenAndServe()
	}()

	select {
	case err := <-serverErrors:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return fmt.Errorf("server gagal dijalankan: %w", err)
	case <-ctx.Done():
		shutdownCtx, cancelShutdown := context.WithTimeout(
			context.Background(),
			15*time.Second,
		)
		defer cancelShutdown()

		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Printf("WARN: graceful shutdown gagal, menutup server: %v", err)
			if closeErr := server.Close(); closeErr != nil {
				return fmt.Errorf("gagal menutup server: %w", closeErr)
			}
		}

		err := <-serverErrors
		if errors.Is(err, http.ErrServerClosed) {
			log.Println("INFO: server dihentikan dengan aman")
			return nil
		}
		if err != nil {
			return fmt.Errorf("server berhenti dengan error: %w", err)
		}
		return nil
	}
}
