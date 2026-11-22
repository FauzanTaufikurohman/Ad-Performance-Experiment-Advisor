package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/middleware"
	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/models"
	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/services"
	"github.com/gin-gonic/gin"
)

const maxExperimentRequestSize = 64 << 10

type BayesianStatsStore interface {
	SaveBayesianStats(
		context.Context,
		int64,
		int64,
		models.BayesianExperimentResult,
	) error
	ListBayesianExperimentRuns(
		context.Context,
		int64,
		int,
		int,
	) ([]models.BayesianExperimentRun, int64, error)
}

func EvaluateExperiment(store BayesianStatsStore) gin.HandlerFunc {
	return evaluateExperiment(store, false)
}

func RunMonteCarloExperiment(store BayesianStatsStore) gin.HandlerFunc {
	return evaluateExperiment(store, true)
}

func GetExperimentHistory(store BayesianStatsStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		if store == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"success": false,
				"message": "Riwayat eksperimen belum tersedia.",
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

		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		runs, total, err := store.ListBayesianExperimentRuns(
			ctx,
			middleware.OrganizationID(c),
			page,
			limit,
		)
		if err != nil {
			log.Printf("ERROR: gagal mengambil riwayat eksperimen: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Gagal mengambil riwayat eksperimen.",
			})
			return
		}

		totalPages := (total + int64(limit) - 1) / int64(limit)
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    runs,
			"pagination": gin.H{
				"page":        page,
				"limit":       limit,
				"total":       total,
				"total_pages": totalPages,
			},
		})
	}
}

func evaluateExperiment(store BayesianStatsStore, monteCarlo bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		if store == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"success": false,
				"message": "Penyimpanan statistik eksperimen belum tersedia.",
			})
			return
		}

		request, err := decodeExperimentRequest(c)
		if err != nil {
			status := http.StatusBadRequest
			message := "Body permintaan eksperimen tidak valid."
			var maxBytesError *http.MaxBytesError
			if errors.As(err, &maxBytesError) {
				status = http.StatusRequestEntityTooLarge
				message = "Ukuran permintaan eksperimen melebihi 64 KB."
			}
			c.JSON(status, gin.H{"success": false, "message": message})
			return
		}

		if monteCarlo && len(request.Arms) < services.MinimumMonteCarloArms {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Endpoint Monte Carlo memerlukan minimal 6 arms.",
			})
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
		defer cancel()

		result, err := services.EvaluateBayesianExperiment(ctx, request)
		if err != nil {
			if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
				c.JSON(http.StatusRequestTimeout, gin.H{
					"success": false,
					"message": "Evaluasi eksperimen dibatalkan atau melewati batas waktu.",
				})
				return
			}
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}

		if err := store.SaveBayesianStats(
			ctx,
			middleware.UserID(c),
			middleware.OrganizationID(c),
			result,
		); err != nil {
			log.Printf(
				"ERROR: gagal menyimpan statistik eksperimen %q: %v",
				result.ExperimentID,
				err,
			)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Hasil evaluasi dihitung tetapi gagal disimpan.",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    result,
		})
	}
}

func decodeExperimentRequest(c *gin.Context) (models.BayesianExperimentRequest, error) {
	var request models.BayesianExperimentRequest
	c.Request.Body = http.MaxBytesReader(
		c.Writer,
		c.Request.Body,
		maxExperimentRequestSize,
	)

	decoder := json.NewDecoder(c.Request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&request); err != nil {
		return request, err
	}

	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		if err == nil {
			return request, errors.New("hanya satu objek JSON yang diperbolehkan")
		}
		return request, err
	}

	return request, nil
}
