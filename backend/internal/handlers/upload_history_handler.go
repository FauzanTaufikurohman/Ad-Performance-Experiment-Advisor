package handlers

import (
	"context"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func GetUploadHistory(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		if pool == nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Koneksi database belum tersedia.",
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

		limit, err := strconv.Atoi(c.DefaultQuery("limit", "10"))
		if err != nil || limit < 1 || limit > 100 {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Parameter limit harus berada di antara 1 dan 100.",
			})
			return
		}

		ctx, cancel := context.WithTimeout(
			c.Request.Context(),
			5*time.Second,
		)
		defer cancel()

		var total int64

		err = pool.QueryRow(
			ctx,
			`SELECT COUNT(*) FROM uploads`,
		).Scan(&total)

		if err != nil {
			log.Printf("ERROR: gagal menghitung upload: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Gagal mengambil riwayat upload.",
			})
			return
		}

		offset := (page - 1) * limit

		rows, err := pool.Query(
			ctx,
			`SELECT id, filename, status, row_count, created_at
			 FROM uploads
			 ORDER BY id DESC
			 LIMIT $1 OFFSET $2`,
			limit,
			offset,
		)
		if err != nil {
			log.Printf("ERROR: gagal mengambil riwayat upload: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Gagal mengambil riwayat upload.",
			})
			return
		}
		defer rows.Close()

		uploads := make([]gin.H, 0)

		for rows.Next() {
			var (
				id        int64
				filename  string
				status    string
				rowCount  int
				createdAt time.Time
			)

			if err := rows.Scan(
				&id,
				&filename,
				&status,
				&rowCount,
				&createdAt,
			); err != nil {
				log.Printf("ERROR: gagal membaca riwayat upload: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"message": "Gagal membaca data riwayat upload.",
				})
				return
			}

			uploads = append(uploads, gin.H{
				"id":         id,
				"filename":   filename,
				"status":     status,
				"row_count":  rowCount,
				"created_at": createdAt,
			})
		}

		if err := rows.Err(); err != nil {
			log.Printf("ERROR: terjadi kesalahan saat membaca upload: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Gagal membaca data riwayat upload.",
			})
			return
		}

		totalPages := (total + int64(limit) - 1) / int64(limit)

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    uploads,
			"pagination": gin.H{
				"page":        page,
				"limit":       limit,
				"total":       total,
				"total_pages": totalPages,
			},
		})
	}
}
