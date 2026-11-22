package handlers

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/middleware"
	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/models"
	"github.com/gin-gonic/gin"
)

type fakeBayesianStatsStore struct {
	userID         int64
	organizationID int64
	result         models.BayesianExperimentResult
	runs           []models.BayesianExperimentRun
	err            error
	calls          int
	page           int
	limit          int
	total          int64
}

func (store *fakeBayesianStatsStore) SaveBayesianStats(
	_ context.Context,
	userID int64,
	organizationID int64,
	result models.BayesianExperimentResult,
) error {
	store.userID = userID
	store.organizationID = organizationID
	store.result = result
	store.calls++
	return store.err
}

func (store *fakeBayesianStatsStore) ListBayesianExperimentRuns(
	_ context.Context,
	organizationID int64,
	page int,
	limit int,
) ([]models.BayesianExperimentRun, int64, error) {
	store.organizationID = organizationID
	store.page = page
	store.limit = limit
	if store.err != nil {
		return nil, 0, store.err
	}
	total := store.total
	if total == 0 {
		total = int64(len(store.runs))
	}
	return store.runs, total, nil
}

func TestEvaluateExperimentSavesAuthenticatedResult(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store := &fakeBayesianStatsStore{}
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("authenticated_user_id", int64(7))
		c.Set("authenticated_user", middleware.Claims{
			UserID:         7,
			OrganizationID: 3,
		})
		c.Next()
	})
	router.POST("/evaluate", EvaluateExperiment(store))
	body := `{
		"experiment_id":"campaign-1",
		"metric":"ctr",
		"arms":[
			{"name":"control","impressions":10000,"clicks":500,"conversions":50},
			{"name":"variant","impressions":10000,"clicks":1500,"conversions":150}
		]
	}`

	response := httptest.NewRecorder()
	router.ServeHTTP(
		response,
		httptest.NewRequest(http.MethodPost, "/evaluate", strings.NewReader(body)),
	)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", response.Code, http.StatusOK, response.Body)
	}
	if store.calls != 1 || store.userID != 7 || store.organizationID != 3 {
		t.Fatalf(
			"store calls/user/organization = %d/%d/%d, want 1/7/3",
			store.calls,
			store.userID,
			store.organizationID,
		)
	}
	if store.result.ExperimentID != "campaign-1" || store.result.Winner != "variant" {
		t.Fatalf("stored result = %+v, want campaign-1 with variant winner", store.result)
	}
}

func TestGetExperimentHistoryUsesActiveOrganization(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store := &fakeBayesianStatsStore{
		total: 21,
		runs: []models.BayesianExperimentRun{{
			Result: models.BayesianExperimentResult{
				ExperimentID: "campaign-1",
				Metric:       models.BayesianMetricCTR,
			},
		}},
	}
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("authenticated_user", middleware.Claims{OrganizationID: 3})
		c.Next()
	})
	router.GET("/history", GetExperimentHistory(store))

	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/history?page=2&limit=5", nil))

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", response.Code, http.StatusOK, response.Body)
	}
	if store.organizationID != 3 {
		t.Fatalf("organization = %d, want active organization 3", store.organizationID)
	}
	if store.page != 2 || store.limit != 5 {
		t.Fatalf("page/limit = %d/%d, want 2/5", store.page, store.limit)
	}
	if !strings.Contains(response.Body.String(), "campaign-1") {
		t.Fatalf("history response does not contain stored experiment: %s", response.Body)
	}
	if !strings.Contains(response.Body.String(), `"total_pages":5`) {
		t.Fatalf("history response should include pagination metadata: %s", response.Body)
	}
}

func TestGetExperimentHistoryRejectsInvalidPagination(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store := &fakeBayesianStatsStore{}
	router := gin.New()
	router.GET("/history", GetExperimentHistory(store))

	for _, path := range []string{
		"/history?page=0",
		"/history?page=not-a-number",
		"/history?limit=101",
		"/history?limit=not-a-number",
	} {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, path, nil))
		if response.Code != http.StatusBadRequest {
			t.Errorf("%s status = %d, want %d", path, response.Code, http.StatusBadRequest)
		}
	}
	if store.page != 0 || store.limit != 0 {
		t.Fatalf("store was called for invalid pagination: page/limit = %d/%d", store.page, store.limit)
	}
}

func TestGetExperimentHistoryReportsStoreFailure(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/history", GetExperimentHistory(&fakeBayesianStatsStore{
		err: errors.New("database unavailable"),
	}))

	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/history", nil))

	if response.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusInternalServerError)
	}
}

func TestMonteCarloEndpointRequiresSixArms(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store := &fakeBayesianStatsStore{}
	router := gin.New()
	router.POST("/monte-carlo", RunMonteCarloExperiment(store))
	body := `{
		"experiment_id":"campaign-1",
		"metric":"ctr",
		"arms":[
			{"name":"a","impressions":1000,"clicks":100},
			{"name":"b","impressions":1000,"clicks":101}
		]
	}`

	response := httptest.NewRecorder()
	router.ServeHTTP(
		response,
		httptest.NewRequest(http.MethodPost, "/monte-carlo", strings.NewReader(body)),
	)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusBadRequest)
	}
	if store.calls != 0 {
		t.Fatalf("store calls = %d, want 0", store.calls)
	}
}

func TestEvaluateExperimentReportsPersistenceFailure(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store := &fakeBayesianStatsStore{err: errors.New("database unavailable")}
	router := gin.New()
	router.POST("/evaluate", EvaluateExperiment(store))
	body := `{
		"experiment_id":"campaign-1",
		"metric":"ctr",
		"arms":[
			{"name":"control","impressions":10000,"clicks":500},
			{"name":"variant","impressions":10000,"clicks":1500}
		]
	}`

	response := httptest.NewRecorder()
	router.ServeHTTP(
		response,
		httptest.NewRequest(http.MethodPost, "/evaluate", strings.NewReader(body)),
	)

	if response.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusInternalServerError)
	}
	if !strings.Contains(response.Body.String(), "gagal disimpan") {
		t.Fatalf("response should report persistence failure: %s", response.Body)
	}
}
