package handlers

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type serviceIdentityResponse struct {
	ID         int64      `json:"id"`
	Name       string     `json:"name"`
	IsActive   bool       `json:"is_active"`
	LastUsedAt *time.Time `json:"last_used_at"`
	CreatedAt  time.Time  `json:"created_at"`
}

func CreateServiceIdentity(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var request struct {
			Name string `json:"name" binding:"required"`
		}
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Nama service identity wajib diisi."})
			return
		}
		name := strings.TrimSpace(request.Name)
		if name == "" || len(name) > 100 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Nama service identity wajib diisi dan maksimal 100 karakter."})
			return
		}
		claims, _ := middleware.AuthenticatedUser(c)
		if pool == nil {
			authDatabaseUnavailable(c)
			return
		}

		randomToken := make([]byte, 32)
		if _, err := rand.Read(randomToken); err != nil {
			log.Printf("ERROR: gagal membuat kredensial service organisasi %d: %v", claims.OrganizationID, err)
			authServerError(c)
			return
		}
		apiKey := serviceTokenPrefix + base64.RawURLEncoding.EncodeToString(randomToken)
		tokenHash := sha256.Sum256([]byte(apiKey))

		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		tx, err := pool.Begin(ctx)
		if err != nil {
			log.Printf("ERROR: gagal memulai pembuatan service identity: %v", err)
			authServerError(c)
			return
		}
		defer func() { _ = tx.Rollback(ctx) }()

		var identity serviceIdentityResponse
		err = tx.QueryRow(ctx, `
			INSERT INTO service_identities (
				organization_id, name, token_hash, created_by_user_id
			)
			VALUES ($1, $2, $3, $4)
			RETURNING id, name, is_active, last_used_at, created_at
		`, claims.OrganizationID, name, tokenHash[:], claims.UserID).Scan(
			&identity.ID,
			&identity.Name,
			&identity.IsActive,
			&identity.LastUsedAt,
			&identity.CreatedAt,
		)
		if err != nil {
			log.Printf("ERROR: gagal menyimpan service identity organisasi %d: %v", claims.OrganizationID, err)
			authServerError(c)
			return
		}
		details, err := json.Marshal(map[string]string{"name": name})
		if err != nil {
			log.Printf("ERROR: gagal menyiapkan audit service identity: %v", err)
			authServerError(c)
			return
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO audit_logs (
				organization_id, actor_user_id, action, resource_type,
				resource_id, details
			)
			VALUES ($1, $2, 'organization.service_identity_created', 'service_identity', $3, $4)
		`, claims.OrganizationID, claims.UserID, strconv.FormatInt(identity.ID, 10), string(details))
		if err != nil {
			log.Printf("ERROR: gagal mencatat audit service identity organisasi %d: %v", claims.OrganizationID, err)
			authServerError(c)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			log.Printf("ERROR: gagal menyimpan service identity organisasi %d: %v", claims.OrganizationID, err)
			authServerError(c)
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"success": true,
			"message": "Service identity read-only dibuat. API key hanya ditampilkan sekali.",
			"data":    identity,
			"api_key": apiKey,
		})
	}
}

func GetServiceIdentities(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, _ := middleware.AuthenticatedUser(c)
		if pool == nil {
			authDatabaseUnavailable(c)
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		rows, err := pool.Query(ctx, `
			SELECT id, name, is_active, last_used_at, created_at
			FROM service_identities
			WHERE organization_id = $1
			ORDER BY created_at DESC, id DESC
		`, claims.OrganizationID)
		if err != nil {
			log.Printf("ERROR: gagal mengambil service identity organisasi %d: %v", claims.OrganizationID, err)
			authServerError(c)
			return
		}
		defer rows.Close()

		identities := make([]serviceIdentityResponse, 0)
		for rows.Next() {
			var identity serviceIdentityResponse
			if err := rows.Scan(
				&identity.ID,
				&identity.Name,
				&identity.IsActive,
				&identity.LastUsedAt,
				&identity.CreatedAt,
			); err != nil {
				log.Printf("ERROR: gagal membaca service identity organisasi %d: %v", claims.OrganizationID, err)
				authServerError(c)
				return
			}
			identities = append(identities, identity)
		}
		if err := rows.Err(); err != nil {
			log.Printf("ERROR: iterasi service identity organisasi %d gagal: %v", claims.OrganizationID, err)
			authServerError(c)
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "data": identities})
	}
}

func RevokeServiceIdentity(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		identityID, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil || identityID < 1 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "ID service identity tidak valid."})
			return
		}
		claims, _ := middleware.AuthenticatedUser(c)
		if pool == nil {
			authDatabaseUnavailable(c)
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		tx, err := pool.Begin(ctx)
		if err != nil {
			log.Printf("ERROR: gagal memulai pencabutan service identity: %v", err)
			authServerError(c)
			return
		}
		defer func() { _ = tx.Rollback(ctx) }()

		var revokedID int64
		err = tx.QueryRow(ctx, `
			UPDATE service_identities
			SET is_active = FALSE, revoked_at = NOW()
			WHERE id = $1 AND organization_id = $2 AND is_active
			RETURNING id
		`, identityID, claims.OrganizationID).Scan(&revokedID)
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Service identity aktif tidak ditemukan pada organisasi ini."})
			return
		}
		if err != nil {
			log.Printf("ERROR: gagal mencabut service identity %d: %v", identityID, err)
			authServerError(c)
			return
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO audit_logs (
				organization_id, actor_user_id, action, resource_type, resource_id
			)
			VALUES ($1, $2, 'organization.service_identity_revoked', 'service_identity', $3)
		`, claims.OrganizationID, claims.UserID, strconv.FormatInt(revokedID, 10)); err != nil {
			log.Printf("ERROR: gagal mencatat audit pencabutan service identity %d: %v", identityID, err)
			authServerError(c)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			log.Printf("ERROR: gagal menyimpan pencabutan service identity %d: %v", identityID, err)
			authServerError(c)
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Service identity berhasil dicabut."})
	}
}
