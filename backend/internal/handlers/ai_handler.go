package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/middleware"
	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/models"
	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type aiAnalyzeRequest struct {
	UploadID int64 `json:"upload_id" binding:"required,gt=0"`
}

func AnalyzeUploadWithAI(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		if pool == nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Koneksi database belum tersedia.",
			})
			return
		}

		var request aiAnalyzeRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Body harus berisi upload_id berupa bilangan positif.",
			})
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 45*time.Second)
		defer cancel()

		var uploadID int64
		err := pool.QueryRow(ctx,
			`SELECT id FROM uploads WHERE id = $1 AND user_id = $2`,
			request.UploadID,
			middleware.UserID(c),
		).Scan(&uploadID)

		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Upload tidak ditemukan.",
			})
			return
		}
		if err != nil {
			log.Printf("ERROR: gagal memeriksa upload %d: %v", request.UploadID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Gagal memeriksa upload.",
			})
			return
		}

		var metrics models.MetricSummary
		err = pool.QueryRow(ctx, `
			SELECT total_impressions, total_clicks, total_spend,
			       total_conversions, total_conversion_value, ctr, cpa, roas
			FROM metric_summaries
			WHERE upload_id = $1
		`, uploadID).Scan(
			&metrics.TotalImpressions,
			&metrics.TotalClicks,
			&metrics.TotalSpend,
			&metrics.TotalConversions,
			&metrics.TotalConversionValue,
			&metrics.CTR,
			&metrics.CPA,
			&metrics.ROAS,
		)
		if err != nil {
			log.Printf("ERROR: gagal mengambil metrik upload %d: %v", uploadID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Gagal mengambil metrik untuk analisis AI.",
			})
			return
		}

		rows, err := pool.Query(ctx, `
			SELECT code, severity, title, description
			FROM findings
			WHERE upload_id = $1
			ORDER BY id ASC
		`, uploadID)
		if err != nil {
			log.Printf("ERROR: gagal mengambil findings upload %d: %v", uploadID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Gagal mengambil findings untuk analisis AI.",
			})
			return
		}

		findings := make([]models.Finding, 0)
		for rows.Next() {
			var finding models.Finding
			if err := rows.Scan(
				&finding.Code,
				&finding.Severity,
				&finding.Title,
				&finding.Description,
			); err != nil {
				rows.Close()
				log.Printf("ERROR: gagal membaca findings upload %d: %v", uploadID, err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"message": "Gagal membaca findings untuk analisis AI.",
				})
				return
			}
			findings = append(findings, finding)
		}

		if err := rows.Err(); err != nil {
			rows.Close()
			log.Printf("ERROR: iterasi findings upload %d gagal: %v", uploadID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Gagal membaca findings untuk analisis AI.",
			})
			return
		}
		rows.Close()

		advisor, err := services.GenerateAIAdvisor(ctx, metrics, findings)
		if err != nil {
			// Jangan mencatat request atau API key. Detail error disimpan di log server.
			log.Printf("WARN: AI Advisor gagal untuk upload %d: %v", uploadID, err)
			c.JSON(http.StatusBadGateway, gin.H{
				"success":   false,
				"message":   "Analisis AI gagal. Metrik dan findings deterministik tetap tersedia.",
				"upload_id": uploadID,
				"ai_status": "unavailable",
			})
			return
		}

		advisorJSON, err := json.Marshal(advisor)
		if err != nil {
			log.Printf("ERROR: gagal menyiapkan hasil AI upload %d: %v", uploadID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Hasil AI gagal disimpan.",
			})
			return
		}
		if _, err := pool.Exec(ctx, `
			INSERT INTO ai_advisor_results (upload_id, response)
			VALUES ($1, $2)
		`, uploadID, string(advisorJSON)); err != nil {
			log.Printf("ERROR: gagal menyimpan hasil AI upload %d: %v", uploadID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Hasil AI gagal disimpan.",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success":    true,
			"upload_id":  uploadID,
			"ai_advisor": advisor,
		})
	}
}

// Memungkinkan pengujian memvalidasi parsing ID tanpa mengakses database.
func parseAIUploadID(value string) (int64, error) {
	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil || id < 1 {
		return 0, errors.New("upload_id harus berupa bilangan positif")
	}
	return id, nil
}
