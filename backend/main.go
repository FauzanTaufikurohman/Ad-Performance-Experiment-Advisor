package main

import (
	"context"
	"log"
	"os"

	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/database"
	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/routes"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Printf("INFO: file .env tidak dimuat: %v", err)
	}

	pool, err := database.NewPostgresPool(context.Background())
	if err != nil {
		log.Fatalf("ERROR: koneksi PostgreSQL gagal: %v", err)
	}
	defer pool.Close()

	log.Println("INFO: koneksi PostgreSQL berhasil")

	port := os.Getenv("APP_PORT")
	if port == "" {
		port = "8080"
	}

	router := routes.SetupRoutes(pool)

	log.Printf("INFO: server berjalan pada port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("ERROR: server gagal dijalankan: %v", err)
	}
}
