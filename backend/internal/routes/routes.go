package routes

import (
	"net/http"

	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/handlers"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set(
			"Access-Control-Allow-Origin",
			"http://localhost:3000",
		)
		c.Writer.Header().Set(
			"Access-Control-Allow-Methods",
			"GET, POST, OPTIONS",
		)
		c.Writer.Header().Set(
			"Access-Control-Allow-Headers",
			"Content-Type, Authorization",
		)

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func SetupRoutes(pool *pgxpool.Pool) *gin.Engine {
	router := gin.Default()
	router.Use(corsMiddleware())

	router.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Ad Performance API is running",
		})
	})

	router.POST("/api/uploads", handlers.UploadCSVWithDB(pool))
	router.GET("/api/uploads", handlers.GetUploadHistory(pool))
	router.GET("/api/uploads/:id", handlers.GetUploadDetail(pool))

	return router
}