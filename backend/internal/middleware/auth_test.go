package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestTokenRoundTripAndTampering(t *testing.T) {
	t.Setenv("AUTH_SECRET", "test-secret-with-at-least-32-characters")

	token, err := CreateToken(Claims{
		UserID: 42,
		Email:  "user@example.com",
		Name:   "Test User",
	})
	if err != nil {
		t.Fatalf("CreateToken() error = %v", err)
	}

	claims, err := ParseToken(token)
	if err != nil {
		t.Fatalf("ParseToken() error = %v", err)
	}
	if claims.UserID != 42 || claims.Email != "user@example.com" {
		t.Fatalf("claims = %+v, want user 42 and matching email", claims)
	}

	if _, err := ParseToken(token + "tampered"); err == nil {
		t.Fatal("ParseToken() accepted a tampered token")
	}
}

func TestTokenAcceptsLegacyJWTSecret(t *testing.T) {
	t.Setenv("AUTH_SECRET", "")
	t.Setenv("JWT_SECRET", "legacy-test-secret-with-at-least-32-characters")

	token, err := CreateToken(Claims{UserID: 7})
	if err != nil {
		t.Fatalf("CreateToken() error = %v", err)
	}
	if _, err := ParseToken(token); err != nil {
		t.Fatalf("ParseToken() error = %v", err)
	}
}

func TestRequireAuthRejectsMissingToken(t *testing.T) {
	router := gin.New()
	router.GET("/private", RequireAuth(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/private", nil)

	router.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusUnauthorized)
	}
}
