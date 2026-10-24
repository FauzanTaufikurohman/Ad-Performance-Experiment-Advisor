package handlers

import (
	"context"
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

func GetUploadDetail(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		if pool == nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Koneksi database belum tersedia.",
			})
			return
		}

		uploadID, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil || uploadID < 1 {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "ID upload tidak valid.",
			})
			return
		}

		ctx, cancel := context.WithTimeout(
			c.Request.Context(),
			10*time.Second,
		)
		defer cancel()

		var upload struct {
			ID        int64     `json:"id"`
			Filename  string    `json:"filename"`
			Status    string    `json:"status"`
			RowCount  int       `json:"row_count"`
			CreatedAt time.Time `json:"created_at"`
		}

		err = pool.QueryRow(ctx,
			`SELECT id, filename, status, row_count, created_at
			 FROM uploads
			 WHERE id = $1 AND user_id = $2`,
			uploadID,
			middleware.UserID(c),
		).Scan(
			&upload.ID,
			&upload.Filename,
			&upload.Status,
			&upload.RowCount,
			&upload.CreatedAt,
		)

		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				c.JSON(http.StatusNotFound, gin.H{
					"success": false,
					"message": "Upload tidak ditemukan.",
				})
				return
			}

			log.Printf("ERROR: gagal mengambil upload %d: %v", uploadID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Gagal mengambil detail upload.",
			})
			return
		}

		rows, err := pool.Query(ctx,
			`SELECT record_date, campaign, impressions, clicks,
			        spend, conversions, conversion_value
			 FROM ad_records
			 WHERE upload_id = $1
			 ORDER BY record_date ASC, id ASC`,
			uploadID,
		)
		if err != nil {
			log.Printf("ERROR: gagal mengambil record upload %d: %v", uploadID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Gagal mengambil record iklan.",
			})
			return
		}

		records := make([]models.AdRecord, 0)

		for rows.Next() {
			var record models.AdRecord

			if err := rows.Scan(
				&record.Date,
				&record.Campaign,
				&record.Impressions,
				&record.Clicks,
				&record.Spend,
				&record.Conversions,
				&record.ConversionValue,
			); err != nil {
				rows.Close()
				log.Printf("ERROR: gagal membaca record upload %d: %v", uploadID, err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"message": "Gagal membaca record iklan.",
				})
				return
			}

			records = append(records, record)
		}

		err = rows.Err()
		rows.Close()

		if err != nil {
			log.Printf("ERROR: iterasi record upload %d gagal: %v", uploadID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Gagal membaca record iklan.",
			})
			return
		}

		var metrics models.MetricSummary

		err = pool.QueryRow(ctx,
			`SELECT total_impressions, total_clicks, total_spend,
			        total_conversions, total_conversion_value,
			        ctr, cpa, roas
			 FROM metric_summaries
			 WHERE upload_id = $1`,
			uploadID,
		).Scan(
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
				"message": "Ringkasan metrik upload tidak ditemukan atau gagal dibaca.",
			})
			return
		}

		findingRows, err := pool.Query(ctx,
			`SELECT code, severity, title, description
			 FROM findings
			 WHERE upload_id = $1
			 ORDER BY id ASC`,
			uploadID,
		)
		if err != nil {
			log.Printf("ERROR: gagal mengambil findings upload %d: %v", uploadID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Gagal mengambil hasil analisis.",
			})
			return
		}

		findings := make([]gin.H, 0)

		for findingRows.Next() {
			var (
				code        string
				severity    string
				title       string
				description string
			)

			if err := findingRows.Scan(
				&code,
				&severity,
				&title,
				&description,
			); err != nil {
				findingRows.Close()
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"message": "Gagal membaca hasil analisis.",
				})
				return
			}

			findings = append(findings, gin.H{
				"code":        code,
				"severity":    severity,
				"title":       title,
				"description": description,
			})
		}

		err = findingRows.Err()
		findingRows.Close()

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Gagal membaca hasil analisis.",
			})
			return
		}

		readiness := services.EvaluateExperimentReadiness(records, metrics)
		var aiAdvisor map[string]any
		err = pool.QueryRow(ctx, `
			SELECT response
			FROM ai_advisor_results
			WHERE upload_id = $1
			ORDER BY created_at DESC, id DESC
			LIMIT 1
		`, uploadID).Scan(&aiAdvisor)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			log.Printf("ERROR: gagal mengambil hasil AI upload %d: %v", uploadID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Gagal mengambil hasil AI.",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"upload":     upload,
				"metrics":    metrics,
				"findings":   findings,
				"readiness":  readiness,
				"records":    records,
				"ai_advisor": aiAdvisor,
			},
		})
	}
}
