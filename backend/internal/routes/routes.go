package routes

import (
	"context"
	"net/http"
	"time"

	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/handlers"
	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/middleware"
	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/repositories"
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
	router.GET("/api/health/live", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	router.GET("/api/health/ready", func(c *gin.Context) {
		if pool == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"success": false,
				"message": "Database belum tersedia.",
			})
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		if err := pool.Ping(ctx); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"success": false,
				"message": "Database belum siap melayani permintaan.",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Ad Performance API siap melayani permintaan.",
		})
	})

	router.POST("/api/auth/register", handlers.Register(pool))
	router.POST("/api/auth/login", handlers.Login(pool))
	router.POST("/api/auth/invitations/accept", handlers.AcceptOrganizationInvitation(pool))

	protected := router.Group("/api")
	protected.Use(middleware.RequireAuth(pool))
	protected.GET("/auth/me", middleware.RequireHuman(), handlers.CurrentUser(pool))
	protected.POST("/auth/organizations/select", middleware.RequireHuman(), handlers.SelectOrganization(pool))
	protected.GET("/organizations/current", middleware.RequireHuman(), handlers.GetCurrentOrganization(pool))
	protected.GET("/organizations/members", middleware.RequireHuman(), handlers.GetOrganizationMembers(pool))
	protected.POST(
		"/organizations/members",
		middleware.RequireHuman(),
		middleware.RequireRoles(
			middleware.RolePlatformSuperAdmin,
			middleware.RoleOrganizationOwner,
			middleware.RoleOrganizationAdmin,
		),
		handlers.AddOrganizationMember(pool),
	)
	protected.POST(
		"/organizations/invitations",
		middleware.RequireHuman(),
		middleware.RequireRoles(
			middleware.RolePlatformSuperAdmin,
			middleware.RoleOrganizationOwner,
			middleware.RoleOrganizationAdmin,
		),
		handlers.CreateOrganizationInvitation(pool),
	)
	serviceIdentityManagers := middleware.RequireRoles(
		middleware.RolePlatformSuperAdmin,
		middleware.RoleOrganizationOwner,
		middleware.RoleOrganizationAdmin,
	)
	protected.GET(
		"/organizations/service-identities",
		middleware.RequireHuman(),
		serviceIdentityManagers,
		handlers.GetServiceIdentities(pool),
	)
	protected.POST(
		"/organizations/service-identities",
		middleware.RequireHuman(),
		serviceIdentityManagers,
		handlers.CreateServiceIdentity(pool),
	)
	protected.POST(
		"/organizations/service-identities/:id/revoke",
		middleware.RequireHuman(),
		serviceIdentityManagers,
		handlers.RevokeServiceIdentity(pool),
	)
	protected.POST(
		"/platform/users/:id/status",
		middleware.RequireHuman(),
		middleware.RequireRoles(middleware.RolePlatformSuperAdmin),
		handlers.SetUserStatus(pool),
	)
	protected.POST(
		"/uploads",
		middleware.RequireRoles(
			middleware.RolePlatformSuperAdmin,
			middleware.RoleOrganizationOwner,
			middleware.RoleOrganizationAdmin,
			middleware.RoleCMOExecutive,
			middleware.RoleMarketingManager,
			middleware.RoleCampaignSpecialist,
			middleware.RoleDataAnalyst,
		),
		handlers.UploadCSVWithDB(pool),
	)
	protected.GET("/uploads", handlers.GetUploadHistory(pool))
	protected.GET("/uploads/:id", handlers.GetUploadDetail(pool))
	protected.GET("/decisions", handlers.GetDecisionInbox(pool))
	analysisRoles := middleware.RequireRoles(
		middleware.RolePlatformSuperAdmin,
		middleware.RoleOrganizationOwner,
		middleware.RoleOrganizationAdmin,
		middleware.RoleCMOExecutive,
		middleware.RoleMarketingManager,
		middleware.RoleCampaignSpecialist,
		middleware.RoleDataAnalyst,
	)
	protected.POST("/ai/analyze", analysisRoles, handlers.AnalyzeUploadWithAI(pool))
	var bayesianStatsStore handlers.BayesianStatsStore
	if pool != nil {
		bayesianStatsStore = repositories.BayesianStatsRepository{Pool: pool}
	}
	protected.GET(
		"/v1/experiments/results",
		handlers.GetExperimentHistory(bayesianStatsStore),
	)
	protected.POST(
		"/v1/experiments/evaluate",
		middleware.RequireRoles(
			middleware.RolePlatformSuperAdmin,
			middleware.RoleOrganizationOwner,
			middleware.RoleOrganizationAdmin,
			middleware.RoleCMOExecutive,
			middleware.RoleMarketingManager,
			middleware.RoleCampaignSpecialist,
			middleware.RoleDataAnalyst,
		),
		handlers.EvaluateExperiment(bayesianStatsStore),
	)
	protected.POST(
		"/v1/experiments/monte-carlo",
		middleware.RequireRoles(
			middleware.RolePlatformSuperAdmin,
			middleware.RoleOrganizationOwner,
			middleware.RoleOrganizationAdmin,
			middleware.RoleCMOExecutive,
			middleware.RoleMarketingManager,
			middleware.RoleCampaignSpecialist,
			middleware.RoleDataAnalyst,
		),
		handlers.RunMonteCarloExperiment(bayesianStatsStore),
	)

	return router
}
