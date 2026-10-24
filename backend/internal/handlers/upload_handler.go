package handlers

import (
	"context"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

const maxUploadSize = 10 << 20 // 10 MB

// UploadCSV memproses CSV tanpa menyimpan hasil ke database.
// Digunakan untuk pengujian handler.
func UploadCSV(c *gin.Context) {
	uploadCSV(c, nil)
}

// UploadCSVWithDB memproses CSV dan menyimpan hasilnya ke PostgreSQL.
func UploadCSVWithDB(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		uploadCSV(c, pool)
	}
}

// uploadCSV menangani validasi, analisis, dan penyimpanan CSV.
func uploadCSV(c *gin.Context, pool *pgxpool.Pool) {
	c.Request.Body = http.MaxBytesReader(
		c.Writer,
		c.Request.Body,
		maxUploadSize,
	)

	fileHeader, err := c.FormFile("file")
	if err != nil {
		if strings.Contains(err.Error(), "request body too large") {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{
				"success": false,
				"message": "Ukuran file melebihi batas 10 MB.",
			})
			return
		}

		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "File CSV wajib diunggah menggunakan field 'file'.",
		})
		return
	}

	if !strings.EqualFold(filepath.Ext(fileHeader.Filename), ".csv") {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "File harus berekstensi .csv.",
		})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "File tidak dapat dibuka.",
		})
		return
	}
	defer file.Close()

	records, err := services.ParseAndValidateCSV(file)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	metrics := services.CalculateMetrics(records)
	findings := services.AnalyzePerformance(records, metrics)
	readiness := services.EvaluateExperimentReadiness(records, metrics)

	var uploadID int64

	if pool != nil {
		ctx, cancel := context.WithTimeout(
			c.Request.Context(),
			15*time.Second,
		)
		defer cancel()

		uploadID, err = services.SaveUpload(
			ctx,
			pool,
			filepath.Base(fileHeader.Filename),
			records,
			metrics,
			findings,
		)
		if err != nil {
			log.Printf(
				"ERROR: gagal menyimpan upload %q: %v",
				fileHeader.Filename,
				err,
			)

			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Hasil analisis gagal disimpan ke database.",
			})
			return
		}

		log.Printf(
			"INFO: upload tersimpan: id=%d filename=%q rows=%d",
			uploadID,
			filepath.Base(fileHeader.Filename),
			len(records),
		)
	} else {
		log.Printf(
			"WARN: upload %q diproses tanpa penyimpanan database",
			filepath.Base(fileHeader.Filename),
		)
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"message":   "CSV berhasil divalidasi dan dianalisis.",
		"filename":  filepath.Base(fileHeader.Filename),
		"rows":      len(records),
		"upload_id": uploadID,
		"metrics":   metrics,
		"findings":  findings,
		"readiness": readiness,
		"data":      records,
	})
}
