package handlers

import (
	"context"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func GetDecisionInbox(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		if pool == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"success": false,
				"message": "Penyimpanan temuan belum tersedia.",
			})
			return
		}

		page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
		if err != nil || page < 1 {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Parameter page harus berupa angka minimal 1.",
			})
			return
		}

		limit, err := strconv.Atoi(c.DefaultQuery("limit", "25"))
		if err != nil || limit < 1 || limit > 100 {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Parameter limit harus berada di antara 1 dan 100.",
			})
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		organizationID := middleware.OrganizationID(c)
		var total int64
		if err := pool.QueryRow(ctx, `
			SELECT COUNT(*)
			FROM findings f
			JOIN uploads u ON u.id = f.upload_id
			WHERE u.organization_id = $1
		`, organizationID).Scan(&total); err != nil {
			log.Printf("ERROR: gagal menghitung decision inbox: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Gagal menghitung temuan untuk ditinjau.",
			})
			return
		}

		rows, err := pool.Query(ctx, `
			SELECT f.id, f.upload_id, u.filename, f.code, f.severity,
			       f.title, f.description, f.recommendation, f.created_at
			FROM findings f
			JOIN uploads u ON u.id = f.upload_id
			WHERE u.organization_id = $1
			ORDER BY
				CASE f.severity
					WHEN 'critical' THEN 0
					WHEN 'warning' THEN 1
					ELSE 2	
				END,
				f.created_at DESC,
				f.id DESC
			LIMIT $2 OFFSET $3
		`, organizationID, limit, (page-1)*limit)
		if err != nil {
			log.Printf("ERROR: gagal mengambil decision inbox: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Gagal mengambil temuan untuk ditinjau.",
			})
			return
		}
		defer rows.Close()

		items := make([]gin.H, 0)
		for rows.Next() {
			var (
				id             int64
				uploadID       int64
				filename       string
				code           string
				severity       string
				title          string
				description    string
				recommendation string
				createdAt      time.Time
			)
			if err := rows.Scan(
				&id,
				&uploadID,
				&filename,
				&code,
				&severity,
				&title,
				&description,
				&recommendation,
				&createdAt,
			); err != nil {
				log.Printf("ERROR: gagal membaca decision inbox: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"message": "Gagal membaca temuan untuk ditinjau.",
				})
				return
			}

			items = append(items, gin.H{
				"id":             id,
				"upload_id":      uploadID,
				"filename":       filename,
				"code":           code,
				"severity":       severity,
				"title":          title,
				"description":    description,
				"recommendation": recommendation,
				"created_at":     createdAt,
			})
		}
		if err := rows.Err(); err != nil {
			log.Printf("ERROR: iterasi decision inbox gagal: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Gagal membaca temuan untuk ditinjau.",
			})
			return
		}

		totalPages := (total + int64(limit) - 1) / int64(limit)
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    items,
			"pagination": gin.H{
				"page":        page,
				"limit":       limit,
				"total":       total,
				"total_pages": totalPages,
			},
		})
	}
}
