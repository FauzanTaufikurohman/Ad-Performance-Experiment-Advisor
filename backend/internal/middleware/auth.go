package middleware

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const userIDKey = "authenticated_user_id"

var errAuthSecretUnavailable = errors.New(
	"AUTH_SECRET atau JWT_SECRET wajib diisi minimal 32 karakter",
)

type Claims struct {
	UserID         int64  `json:"sub"`
	OrganizationID int64  `json:"org"`
	Organization   string `json:"organization,omitempty"`
	Role           string `json:"role,omitempty"`
	Email          string `json:"email"`
	Name           string `json:"name"`
	Expiry         int64  `json:"exp"`
}

func CreateToken(claims Claims) (string, error) {
	secret, err := signingSecret()
	if err != nil {
		return "", err
	}

	claims.Expiry = time.Now().Add(24 * time.Hour).Unix()
	header, err := json.Marshal(map[string]string{
		"alg": "HS256",
		"typ": "JWT",
	})
	if err != nil {
		return "", fmt.Errorf("gagal menyiapkan token: %w", err)
	}
	payload, err := json.Marshal(claims)
	if err != nil {
		return "", fmt.Errorf("gagal menyiapkan token: %w", err)
	}

	unsigned := base64.RawURLEncoding.EncodeToString(header) + "." +
		base64.RawURLEncoding.EncodeToString(payload)
	signature := sign(unsigned, secret)
	return unsigned + "." + base64.RawURLEncoding.EncodeToString(signature), nil
}

func ValidateSecret() error {
	_, err := signingSecret()
	return err
}

func ParseToken(token string) (Claims, error) {
	var claims Claims
	secret, err := signingSecret()
	if err != nil {
		return claims, err
	}

	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return claims, errors.New("token tidak valid")
	}

	providedSignature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return claims, errors.New("token tidak valid")
	}
	expectedSignature := sign(parts[0]+"."+parts[1], secret)
	if !hmac.Equal(providedSignature, expectedSignature) {
		return claims, errors.New("token tidak valid")
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return claims, errors.New("token tidak valid")
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return claims, errors.New("token tidak valid")
	}
	if claims.UserID < 1 || claims.OrganizationID < 1 ||
		claims.Expiry <= time.Now().Unix() {
		return claims, errors.New("token tidak valid atau kedaluwarsa")
	}

	return claims, nil
}

func RequireAuth(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		scheme, token, found := strings.Cut(header, " ")
		if !found || !strings.EqualFold(scheme, "Bearer") || strings.TrimSpace(token) == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "Silakan masuk untuk melanjutkan.",
			})
			return
		}

		claims, err := ParseToken(strings.TrimSpace(token))
		if err != nil {
			status := http.StatusUnauthorized
			message := "Sesi tidak valid atau kedaluwarsa. Silakan masuk kembali."
			if errors.Is(err, errAuthSecretUnavailable) {
				status = http.StatusInternalServerError
				message = "Konfigurasi autentikasi backend belum tersedia."
			}
			c.AbortWithStatusJSON(status, gin.H{
				"success": false,
				"message": message,
			})
			return
		}

		if pool == nil {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"success": false,
				"message": "Penyimpanan organisasi belum tersedia.",
			})
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
		defer cancel()
		err = pool.QueryRow(ctx, `
			SELECT o.name,
			       CASE WHEN pa.user_id IS NOT NULL
			            THEN 'platform_super_admin'
			            ELSE m.role
			       END
			FROM organizations o
			LEFT JOIN organization_memberships m
				ON m.organization_id = o.id AND m.user_id = $1
			LEFT JOIN platform_administrators pa ON pa.user_id = $1
			WHERE o.id = $2
			  AND (m.user_id IS NOT NULL OR pa.user_id IS NOT NULL)
		`, claims.UserID, claims.OrganizationID).Scan(
			&claims.Organization,
			&claims.Role,
		)
		if errors.Is(err, pgx.ErrNoRows) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"message": "Akses ke organisasi ini sudah tidak tersedia.",
			})
			return
		}
		if err != nil {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"success": false,
				"message": "Keanggotaan organisasi tidak dapat diverifikasi.",
			})
			return
		}

		c.Set(userIDKey, claims.UserID)
		c.Set("authenticated_user", claims)
		c.Next()
	}
}

func UserID(c *gin.Context) int64 {
	value, exists := c.Get(userIDKey)
	if !exists {
		return 0
	}
	userID, ok := value.(int64)
	if !ok {
		return 0
	}
	return userID
}

func OrganizationID(c *gin.Context) int64 {
	claims, ok := AuthenticatedUser(c)
	if !ok {
		return 0
	}
	return claims.OrganizationID
}

func AuthenticatedUser(c *gin.Context) (Claims, bool) {
	value, exists := c.Get("authenticated_user")
	if !exists {
		return Claims{}, false
	}
	claims, ok := value.(Claims)
	return claims, ok
}

func signingSecret() ([]byte, error) {
	secret := os.Getenv("AUTH_SECRET")
	if secret == "" {
		secret = os.Getenv("JWT_SECRET")
	}
	if len(secret) < 32 {
		return nil, errAuthSecretUnavailable
	}
	return []byte(secret), nil
}

func sign(value string, secret []byte) []byte {
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(value))
	return mac.Sum(nil)
}
