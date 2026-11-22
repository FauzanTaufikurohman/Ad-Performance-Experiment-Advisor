package handlers

import (
	"context"
	"errors"
	"log"
	"net/http"
	"net/mail"
	"strconv"
	"strings"
	"time"

	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type authRequest struct {
	Name             string `json:"name"`
	OrganizationName string `json:"organization_name"`
	Email            string `json:"email" binding:"required"`
	Password         string `json:"password" binding:"required"`
}

type authUser struct {
	ID               int64  `json:"id"`
	Name             string `json:"name"`
	Email            string `json:"email"`
	OrganizationID   int64  `json:"organization_id"`
	OrganizationName string `json:"organization_name"`
	OrganizationRole string `json:"organization_role"`
}

type organizationMembership struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Role string `json:"role"`
}

func Register(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !authSecretConfigured(c) {
			return
		}

		var request authRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Email dan password wajib diisi.",
			})
			return
		}

		name := strings.TrimSpace(request.Name)
		organizationName := strings.TrimSpace(request.OrganizationName)
		email := strings.ToLower(strings.TrimSpace(request.Email))
		if name == "" || len(name) > 100 {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Nama wajib diisi dan maksimal 100 karakter.",
			})
			return
		}
		if organizationName == "" || len(organizationName) > 150 {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Nama organisasi wajib diisi dan maksimal 150 karakter.",
			})
			return
		}
		parsedEmail, err := mail.ParseAddress(email)
		if err != nil || parsedEmail.Address != email || len(email) > 255 {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Format email tidak valid.",
			})
			return
		}
		if len(request.Password) < 8 || len(request.Password) > 72 {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Password harus terdiri dari 8 sampai 72 karakter.",
			})
			return
		}
		if pool == nil {
			authDatabaseUnavailable(c)
			return
		}

		passwordHash, err := bcrypt.GenerateFromPassword(
			[]byte(request.Password),
			bcrypt.DefaultCost,
		)
		if err != nil {
			log.Printf("ERROR: gagal membuat password hash: %v", err)
			authServerError(c)
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		tx, err := pool.Begin(ctx)
		if err != nil {
			log.Printf("ERROR: gagal memulai pendaftaran organisasi: %v", err)
			authServerError(c)
			return
		}
		defer func() { _ = tx.Rollback(ctx) }()

		var user authUser
		err = tx.QueryRow(ctx, `
			INSERT INTO users (name, email, password_hash)
			VALUES ($1, $2, $3)
			RETURNING id, name, email
		`, name, email, string(passwordHash)).Scan(&user.ID, &user.Name, &user.Email)
		if err != nil {
			var postgresError *pgconn.PgError
			if errors.As(err, &postgresError) && postgresError.Code == "23505" {
				c.JSON(http.StatusConflict, gin.H{
					"success": false,
					"message": "Email sudah terdaftar.",
				})
				return
			}
			log.Printf("ERROR: gagal mendaftarkan pengguna: %v", err)
			authServerError(c)
			return
		}

		err = tx.QueryRow(ctx, `
			INSERT INTO organizations (name, created_by_user_id)
			VALUES ($1, $2)
			RETURNING id
		`, organizationName, user.ID).Scan(&user.OrganizationID)
		if err != nil {
			log.Printf("ERROR: gagal membuat organisasi pendaftaran: %v", err)
			authServerError(c)
			return
		}
		user.OrganizationName = organizationName
		user.OrganizationRole = middleware.RoleOrganizationOwner

		if _, err := tx.Exec(ctx, `
			INSERT INTO organization_memberships (organization_id, user_id, role)
			VALUES ($1, $2, $3)
		`, user.OrganizationID, user.ID, user.OrganizationRole); err != nil {
			log.Printf("ERROR: gagal membuat membership pemilik: %v", err)
			authServerError(c)
			return
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO workspaces (
				organization_id, name, is_default, created_by_user_id
			)
			VALUES ($1, 'Default workspace', TRUE, $2)
		`, user.OrganizationID, user.ID); err != nil {
			log.Printf("ERROR: gagal membuat workspace awal: %v", err)
			authServerError(c)
			return
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO audit_logs (
				organization_id, actor_user_id, action, resource_type, resource_id
			)
			VALUES ($1, $2, 'organization.created', 'organization', $3)
		`, user.OrganizationID, user.ID, strconv.FormatInt(user.OrganizationID, 10)); err != nil {
			log.Printf("ERROR: gagal mencatat audit pendaftaran organisasi: %v", err)
			authServerError(c)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			log.Printf("ERROR: gagal menyimpan pendaftaran organisasi: %v", err)
			authServerError(c)
			return
		}

		respondWithSession(c, user, []organizationMembership{{
			ID: user.OrganizationID, Name: organizationName, Role: user.OrganizationRole,
		}})
	}
}

func Login(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !authSecretConfigured(c) {
			return
		}

		var request authRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Email dan password wajib diisi.",
			})
			return
		}
		if pool == nil {
			authDatabaseUnavailable(c)
			return
		}

		email := strings.ToLower(strings.TrimSpace(request.Email))
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		var user authUser
		var passwordHash string
		var isActive bool
		err := pool.QueryRow(ctx, `
			SELECT id, name, email, password_hash, is_active
			FROM users
			WHERE email = $1
		`, email).Scan(&user.ID, &user.Name, &user.Email, &passwordHash, &isActive)
		if errors.Is(err, pgx.ErrNoRows) ||
			(err == nil && (!isActive ||
				bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(request.Password)) != nil)) {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "Email atau password salah.",
			})
			return
		}
		if err != nil {
			log.Printf("ERROR: gagal memeriksa kredensial pengguna: %v", err)
			authServerError(c)
			return
		}

		memberships, err := loadOrganizationMemberships(ctx, pool, user.ID)
		if err != nil {
			log.Printf("ERROR: gagal mengambil organisasi pengguna %d: %v", user.ID, err)
			authServerError(c)
			return
		}
		if len(memberships) == 0 {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"message": "Akun belum memiliki organisasi. Hubungi administrator.",
			})
			return
		}

		user.OrganizationID = memberships[0].ID
		user.OrganizationName = memberships[0].Name
		user.OrganizationRole = memberships[0].Role
		if _, err := pool.Exec(ctx, `
			INSERT INTO audit_logs (
				organization_id, actor_user_id, action, resource_type, resource_id
			)
			VALUES ($1, $2, 'auth.login', 'user', $3)
		`, user.OrganizationID, user.ID, strconv.FormatInt(user.ID, 10)); err != nil {
			log.Printf("ERROR: gagal mencatat audit login pengguna %d: %v", user.ID, err)
			authServerError(c)
			return
		}
		respondWithSession(c, user, memberships)
	}
}

func CurrentUser(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, ok := middleware.AuthenticatedUser(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "Sesi tidak valid. Silakan masuk kembali.",
			})
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		memberships, err := loadOrganizationMemberships(ctx, pool, claims.UserID)
		if err != nil {
			log.Printf("ERROR: gagal mengambil organisasi pengguna %d: %v", claims.UserID, err)
			authServerError(c)
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success":       true,
			"user":          authUserFromClaims(claims),
			"organizations": memberships,
		})
	}
}

func SelectOrganization(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var request struct {
			OrganizationID int64 `json:"organization_id" binding:"required,gt=0"`
		}
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "organization_id wajib berupa bilangan positif.",
			})
			return
		}

		claims, ok := middleware.AuthenticatedUser(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "Sesi tidak valid. Silakan masuk kembali.",
			})
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		var user authUser
		user.ID = claims.UserID
		user.Name = claims.Name
		user.Email = claims.Email
		err := pool.QueryRow(ctx, `
			SELECT o.id, o.name,
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
		`, claims.UserID, request.OrganizationID).Scan(
			&user.OrganizationID,
			&user.OrganizationName,
			&user.OrganizationRole,
		)
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"message": "Anda bukan anggota organisasi tersebut.",
			})
			return
		}
		if err != nil {
			log.Printf("ERROR: gagal memilih organisasi pengguna %d: %v", claims.UserID, err)
			authServerError(c)
			return
		}

		memberships, err := loadOrganizationMemberships(ctx, pool, claims.UserID)
		if err != nil {
			log.Printf("ERROR: gagal mengambil organisasi pengguna %d: %v", claims.UserID, err)
			authServerError(c)
			return
		}
		respondWithSession(c, user, memberships)
	}
}

func loadOrganizationMemberships(
	ctx context.Context,
	pool *pgxpool.Pool,
	userID int64,
) ([]organizationMembership, error) {
	rows, err := pool.Query(ctx, `
		SELECT o.id, o.name,
		       CASE WHEN pa.user_id IS NOT NULL
		            THEN 'platform_super_admin'
		            ELSE m.role
		       END
		FROM organizations o
		LEFT JOIN organization_memberships m
			ON m.organization_id = o.id AND m.user_id = $1
		LEFT JOIN platform_administrators pa ON pa.user_id = $1
		WHERE m.user_id IS NOT NULL OR pa.user_id IS NOT NULL
		ORDER BY o.created_at, o.id
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	memberships := make([]organizationMembership, 0)
	for rows.Next() {
		var membership organizationMembership
		if err := rows.Scan(&membership.ID, &membership.Name, &membership.Role); err != nil {
			return nil, err
		}
		memberships = append(memberships, membership)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return memberships, nil
}

func authUserFromClaims(claims middleware.Claims) authUser {
	return authUser{
		ID:               claims.UserID,
		Name:             claims.Name,
		Email:            claims.Email,
		OrganizationID:   claims.OrganizationID,
		OrganizationName: claims.Organization,
		OrganizationRole: claims.Role,
	}
}

func respondWithSession(
	c *gin.Context,
	user authUser,
	memberships []organizationMembership,
) {
	token, err := middleware.CreateToken(middleware.Claims{
		UserID:         user.ID,
		OrganizationID: user.OrganizationID,
		Email:          user.Email,
		Name:           user.Name,
	})
	if err != nil {
		log.Printf("ERROR: gagal membuat token autentikasi: %v", err)
		authServerError(c)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"token":         token,
		"user":          user,
		"organizations": memberships,
	})
}

func authDatabaseUnavailable(c *gin.Context) {
	c.JSON(http.StatusInternalServerError, gin.H{
		"success": false,
		"message": "Koneksi database belum tersedia.",
	})
}

func authSecretConfigured(c *gin.Context) bool {
	if err := middleware.ValidateSecret(); err != nil {
		log.Printf("ERROR: konfigurasi autentikasi tidak valid: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Konfigurasi autentikasi backend belum tersedia.",
		})
		return false
	}
	return true
}

func authServerError(c *gin.Context) {
	c.JSON(http.StatusInternalServerError, gin.H{
		"success": false,
		"message": "Terjadi kesalahan pada server autentikasi.",
	})
}
