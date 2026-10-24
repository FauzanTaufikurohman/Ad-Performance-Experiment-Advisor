package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func setupUploadRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.POST("/api/uploads", UploadCSV)

	return router
}

func sendUploadRequest(
	t *testing.T,
	filename string,
	content []byte,
) *httptest.ResponseRecorder {
	t.Helper()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		t.Fatalf("failed to create form file: %v", err)
	}

	if _, err := part.Write(content); err != nil {
		t.Fatalf("failed to write file content: %v", err)
	}

	if err := writer.Close(); err != nil {
		t.Fatalf("failed to close multipart writer: %v", err)
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/uploads",
		body,
	)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	recorder := httptest.NewRecorder()
	setupUploadRouter().ServeHTTP(recorder, req)

	return recorder
}

func TestUploadCSVValidFile(t *testing.T) {
	csv := `date,campaign,impressions,clicks,spend,conversions,conversion_value
2026-10-01,Campaign A,1000,50,100,5,300
2026-10-02,Campaign B,2000,100,200,10,600`

	response := sendUploadRequest(
		t,
		"sample.csv",
		[]byte(csv),
	)

	if response.Code != http.StatusOK {
		t.Fatalf(
			"status = %d, want %d; body: %s",
			response.Code,
			http.StatusOK,
			response.Body.String(),
		)
	}

	var result map[string]any

	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatalf("invalid JSON response: %v", err)
	}

	if result["success"] != true {
		t.Errorf("success = %v, want true", result["success"])
	}
	for _, field := range []string{"metrics", "findings", "readiness"} {
		if _, exists := result[field]; !exists {
			t.Errorf("response is missing field %q", field)
		}
	}
}

func TestUploadCSVRejectsInvalidCSV(t *testing.T) {
	csv := `date,campaign,impressions,clicks,spend,conversions,conversion_value
invalid-date,Campaign A,1000,50,100,5,300`

	response := sendUploadRequest(
		t,
		"invalid.csv",
		[]byte(csv),
	)

	if response.Code == http.StatusOK {
		t.Fatalf(
			"invalid CSV should be rejected; body: %s",
			response.Body.String(),
		)
	}
}

func TestUploadCSVRejectsNonCSVFile(t *testing.T) {
	response := sendUploadRequest(
		t,
		"sample.txt",
		[]byte("this is not a CSV file"),
	)

	if response.Code == http.StatusOK {
		t.Fatal("non-CSV file should be rejected")
	}
}

func TestUploadCSVRejectsOversizedFile(t *testing.T) {
	// Sesuaikan jika batas ukuran di handler bukan 10 MiB.
	content := []byte(
		"date,campaign,impressions,clicks,spend,conversions,conversion_value\n" +
			strings.Repeat("A", 10*1024*1024+1),
	)

	response := sendUploadRequest(
		t,
		"large.csv",
		content,
	)

	if response.Code == http.StatusOK {
		t.Fatal("oversized file should be rejected")
	}
}

func TestUploadCSVResponseIsJSON(t *testing.T) {
	csv := `date,campaign,impressions,clicks,spend,conversions,conversion_value
2026-10-01,Campaign A,1000,50,100,5,300`

	response := sendUploadRequest(
		t,
		"sample.csv",
		[]byte(csv),
	)

	if !strings.Contains(
		response.Header().Get("Content-Type"),
		"application/json",
	) {
		t.Errorf(
			"Content-Type = %q, want application/json",
			response.Header().Get("Content-Type"),
		)
	}

	_ = fmt.Sprintf("%d", response.Code)
}
