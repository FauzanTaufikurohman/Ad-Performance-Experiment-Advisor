package routes

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORSHeadersForUploads(t *testing.T) {
	router := SetupRoutes(nil)

	t.Run("preflight", func(t *testing.T) {
		request := httptest.NewRequest(
			http.MethodOptions,
			"/api/uploads?page=1&limit=10",
			nil,
		)
		request.Header.Set("Origin", "http://localhost:3000")
		request.Header.Set("Access-Control-Request-Method", "GET")
		request.Header.Set(
			"Access-Control-Request-Headers",
			"authorization,content-type",
		)
		response := httptest.NewRecorder()

		router.ServeHTTP(response, request)

		if response.Code != http.StatusNoContent {
			t.Fatalf("status = %d, want %d", response.Code, http.StatusNoContent)
		}
		assertCORSHeaders(t, response)
	})

	t.Run("actual request", func(t *testing.T) {
		request := httptest.NewRequest(
			http.MethodGet,
			"/api/uploads?page=1&limit=10",
			nil,
		)
		request.Header.Set("Origin", "http://localhost:3000")
		response := httptest.NewRecorder()

		router.ServeHTTP(response, request)

		assertCORSHeaders(t, response)
	})
}

func TestExperimentEndpointsRequireAuthentication(t *testing.T) {
	router := SetupRoutes(nil)

	for _, route := range []struct {
		method string
		path   string
	}{
		{method: http.MethodGet, path: "/api/v1/experiments/results"},
		{method: http.MethodPost, path: "/api/v1/experiments/evaluate"},
		{method: http.MethodPost, path: "/api/v1/experiments/monte-carlo"},
		{method: http.MethodGet, path: "/api/decisions"},
	} {
		request := httptest.NewRequest(route.method, route.path, nil)
		response := httptest.NewRecorder()

		router.ServeHTTP(response, request)

		if response.Code != http.StatusUnauthorized {
			t.Errorf("%s %s status = %d, want %d", route.method, route.path, response.Code, http.StatusUnauthorized)
		}
	}
}

func TestHealthEndpoints(t *testing.T) {
	router := SetupRoutes(nil)

	t.Run("live", func(t *testing.T) {
		response := httptest.NewRecorder()
		router.ServeHTTP(
			response,
			httptest.NewRequest(http.MethodGet, "/api/health/live", nil),
		)

		if response.Code != http.StatusNoContent {
			t.Fatalf("status = %d, want %d", response.Code, http.StatusNoContent)
		}
	})

	t.Run("not ready without database", func(t *testing.T) {
		response := httptest.NewRecorder()
		router.ServeHTTP(
			response,
			httptest.NewRequest(http.MethodGet, "/api/health/ready", nil),
		)

		if response.Code != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want %d", response.Code, http.StatusServiceUnavailable)
		}
	})
}

func assertCORSHeaders(t *testing.T, response *httptest.ResponseRecorder) {
	t.Helper()

	if got := response.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3000" {
		t.Errorf(
			"Access-Control-Allow-Origin = %q, want %q",
			got,
			"http://localhost:3000",
		)
	}
}
