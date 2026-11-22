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

const (
	invitationTokenPrefix = "advinv_"
	serviceTokenPrefix    = "advsvc_"
)

func CreateOrganizationInvitation(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var request struct {
			Email string `json:"email" binding:"required"`
			Role  string `json:"role" binding:"required"`
		}
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Email dan role wajib diisi."})
			return
		}
		email, ok := normalizeInvitationEmail(request.Email)
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Format email tidak valid."})
			return
		}

		claims, _ := middleware.AuthenticatedUser(c)
		if !middleware.CanAssignOrganizationRole(claims.Role, request.Role) ||
			request.Role == middleware.RoleOrganizationOwner {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "Role Anda tidak dapat mengundang pengguna dengan role tersebut."})
			return
		}
		if pool == nil {
			authDatabaseUnavailable(c)
			return
		}

		rawToken := make([]byte, 32)
		if _, err := rand.Read(rawToken); err != nil {
			log.Printf("ERROR: gagal membuat token undangan organisasi %d: %v", claims.OrganizationID, err)
			authServerError(c)
			return
		}
		token := invitationTokenPrefix + base64.RawURLEncoding.EncodeToString(rawToken)
		tokenHash := sha256.Sum256([]byte(token))
		expiresAt := time.Now().UTC().Add(7 * 24 * time.Hour)

		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		tx, err := pool.Begin(ctx)
		if err != nil {
			log.Printf("ERROR: gagal memulai pembuatan undangan: %v", err)
			authServerError(c)
			return
		}
		defer func() { _ = tx.Rollback(ctx) }()

		var alreadyMember bool
		err = tx.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT 1
				FROM organization_memberships m
				JOIN users u ON u.id = m.user_id
				WHERE m.organization_id = $1 AND LOWER(u.email) = $2
			)
		`, claims.OrganizationID, email).Scan(&alreadyMember)
		if err != nil {
			log.Printf("ERROR: gagal memeriksa anggota undangan organisasi %d: %v", claims.OrganizationID, err)
			authServerError(c)
			return
		}
		if alreadyMember {
			c.JSON(http.StatusConflict, gin.H{"success": false, "message": "Email tersebut sudah menjadi anggota organisasi."})
			return
		}

		_, err = tx.Exec(ctx, `
			UPDATE organization_invitations
			SET revoked_at = NOW()
			WHERE organization_id = $1
			  AND LOWER(invited_email) = $2
			  AND accepted_at IS NULL
			  AND revoked_at IS NULL
		`, claims.OrganizationID, email)
		if err != nil {
			log.Printf("ERROR: gagal mengganti undangan lama organisasi %d: %v", claims.OrganizationID, err)
			authServerError(c)
			return
		}

		var invitationID int64
		err = tx.QueryRow(ctx, `
			INSERT INTO organization_invitations (
				organization_id, invited_email, role, token_hash,
				invited_by_user_id, expires_at
			)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id
		`, claims.OrganizationID, email, request.Role, tokenHash[:], claims.UserID, expiresAt).Scan(&invitationID)
		if err != nil {
			log.Printf("ERROR: gagal menyimpan undangan organisasi %d: %v", claims.OrganizationID, err)
			authServerError(c)
			return
		}

		details, err := json.Marshal(map[string]string{
			"email": email,
			"role":  request.Role,
		})
		if err != nil {
			log.Printf("ERROR: gagal menyiapkan audit undangan organisasi: %v", err)
			authServerError(c)
			return
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO audit_logs (
				organization_id, actor_user_id, action, resource_type,
				resource_id, details
			)
			VALUES ($1, $2, 'organization.invitation_created', 'invitation', $3, $4)
		`, claims.OrganizationID, claims.UserID, strconv.FormatInt(invitationID, 10), string(details))
		if err != nil {
			log.Printf("ERROR: gagal mencatat audit undangan organisasi %d: %v", claims.OrganizationID, err)
			authServerError(c)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			log.Printf("ERROR: gagal menyimpan undangan organisasi %d: %v", claims.OrganizationID, err)
			authServerError(c)
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"success":    true,
			"message":    "Undangan dibuat. Salin token ini dan kirimkan melalui kanal tepercaya; token hanya ditampilkan sekali.",
			"token":      token,
			"expires_at": expiresAt,
		})
	}
}

func AcceptOrganizationInvitation(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var request struct {
			Token    string `json:"token" binding:"required"`
			Name     string `json:"name"`
			Password string `json:"password" binding:"required"`
		}
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Token undangan dan password wajib diisi."})
			return
		}
		if !strings.HasPrefix(request.Token, invitationTokenPrefix) || len(request.Token) > 100 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Token undangan tidak valid."})
			return
		}
		if len(request.Password) < 8 || len(request.Password) > 72 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Password harus terdiri dari 8 sampai 72 karakter."})
			return
		}
		name := strings.TrimSpace(request.Name)
		if len(name) > 100 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Nama maksimal 100 karakter."})
			return
		}
		if pool == nil {
			authDatabaseUnavailable(c)
			return
		}

		tokenHash := sha256.Sum256([]byte(request.Token))
		ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
		defer cancel()
		tx, err := pool.Begin(ctx)
		if err != nil {
			log.Printf("ERROR: gagal memulai penerimaan undangan: %v", err)
			authServerError(c)
			return
		}
		defer func() { _ = tx.Rollback(ctx) }()

		var invitation struct {
			ID             int64
			OrganizationID int64
			Email          string
			Role           string
		}
		err = tx.QueryRow(ctx, `
			SELECT id, organization_id, invited_email, role
			FROM organization_invitations
			WHERE token_hash = $1
			  AND expires_at > NOW()
			  AND accepted_at IS NULL
			  AND revoked_at IS NULL
			FOR UPDATE
		`, tokenHash[:]).Scan(
			&invitation.ID,
			&invitation.OrganizationID,
			&invitation.Email,
			&invitation.Role,
		)
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Undangan tidak berlaku, kedaluwarsa, atau sudah digunakan."})
			return
		}
		if err != nil {
			log.Printf("ERROR: gagal memverifikasi undangan: %v", err)
			authServerError(c)
			return
		}

		var user authUser
		var passwordHash string
		var isActive bool
		err = tx.QueryRow(ctx, `
			SELECT id, name, email, password_hash, is_active
			FROM users
			WHERE LOWER(email) = $1
			FOR UPDATE
		`, strings.ToLower(invitation.Email)).Scan(
			&user.ID,
			&user.Name,
			&user.Email,
			&passwordHash,
			&isActive,
		)
		if errors.Is(err, pgx.ErrNoRows) {
			if name == "" {
				c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Nama wajib diisi untuk membuat akun baru."})
				return
			}
			passwordHashBytes, hashErr := bcrypt.GenerateFromPassword([]byte(request.Password), bcrypt.DefaultCost)
			if hashErr != nil {
				log.Printf("ERROR: gagal membuat hash password undangan: %v", hashErr)
				authServerError(c)
				return
			}
			err = tx.QueryRow(ctx, `
				INSERT INTO users (name, email, password_hash)
				VALUES ($1, $2, $3)
				RETURNING id, name, email
			`, name, invitation.Email, string(passwordHashBytes)).Scan(&user.ID, &user.Name, &user.Email)
			if err != nil {
				log.Printf("ERROR: gagal membuat akun dari undangan: %v", err)
				authServerError(c)
				return
			}
		} else if err != nil {
			log.Printf("ERROR: gagal memeriksa akun undangan: %v", err)
			authServerError(c)
			return
		} else {
			if !isActive {
				c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "Akun dinonaktifkan. Hubungi administrator platform."})
				return
			}
			if bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(request.Password)) != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Password akun tidak cocok."})
				return
			}
		}

		user.OrganizationID = invitation.OrganizationID
		user.OrganizationRole = invitation.Role
		if _, err := tx.Exec(ctx, `
			INSERT INTO organization_memberships (organization_id, user_id, role)
			VALUES ($1, $2, $3)
		`, invitation.OrganizationID, user.ID, invitation.Role); err != nil {
			var postgresError *pgconn.PgError
			if errors.As(err, &postgresError) && postgresError.Code == "23505" {
				c.JSON(http.StatusConflict, gin.H{"success": false, "message": "Akun sudah menjadi anggota organisasi ini."})
				return
			}
			log.Printf("ERROR: gagal membuat membership undangan %d: %v", invitation.ID, err)
			authServerError(c)
			return
		}

		_, err = tx.Exec(ctx, `
			UPDATE organization_invitations
			SET accepted_at = NOW()
			WHERE id = $1 AND accepted_at IS NULL AND revoked_at IS NULL
		`, invitation.ID)
		if err != nil {
			log.Printf("ERROR: gagal menyelesaikan undangan %d: %v", invitation.ID, err)
			authServerError(c)
			return
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO audit_logs (
				organization_id, actor_user_id, action, resource_type,
				resource_id, details
			)
			VALUES ($1, $2, 'organization.invitation_accepted', 'invitation', $3, $4)
		`, invitation.OrganizationID, user.ID, strconv.FormatInt(invitation.ID, 10),
			`{"role":"`+invitation.Role+`"}`); err != nil {
			log.Printf("ERROR: gagal mencatat audit penerimaan undangan %d: %v", invitation.ID, err)
			authServerError(c)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			log.Printf("ERROR: gagal menyimpan penerimaan undangan %d: %v", invitation.ID, err)
			authServerError(c)
			return
		}

		memberships, err := loadOrganizationMemberships(ctx, pool, user.ID)
		if err != nil {
			log.Printf("ERROR: gagal mengambil organisasi akun undangan %d: %v", user.ID, err)
			authServerError(c)
			return
		}
		respondWithSession(c, user, memberships)
	}
}

func SetUserStatus(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil || userID < 1 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "ID pengguna tidak valid."})
			return
		}
		var request struct {
			IsActive *bool `json:"is_active" binding:"required"`
		}
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "is_active wajib berupa boolean."})
			return
		}
		claims, _ := middleware.AuthenticatedUser(c)
		if !*request.IsActive && userID == claims.UserID {
			c.JSON(http.StatusConflict, gin.H{"success": false, "message": "Anda tidak dapat menonaktifkan akun sendiri."})
			return
		}
		if pool == nil {
			authDatabaseUnavailable(c)
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		tx, err := pool.Begin(ctx)
		if err != nil {
			log.Printf("ERROR: gagal memulai perubahan status akun: %v", err)
			authServerError(c)
			return
		}
		defer func() { _ = tx.Rollback(ctx) }()
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(748219632)`); err != nil {
			log.Printf("ERROR: gagal mengunci perubahan status akun: %v", err)
			authServerError(c)
			return
		}

		var currentlyActive bool
		err = tx.QueryRow(ctx, `
			SELECT is_active FROM users WHERE id = $1 FOR UPDATE
		`, userID).Scan(&currentlyActive)
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Pengguna tidak ditemukan."})
			return
		}
		if err != nil {
			log.Printf("ERROR: gagal membaca status pengguna %d: %v", userID, err)
			authServerError(c)
			return
		}

		if currentlyActive && !*request.IsActive {
			var isPlatformAdmin bool
			if err := tx.QueryRow(ctx, `
				SELECT EXISTS (SELECT 1 FROM platform_administrators WHERE user_id = $1)
			`, userID).Scan(&isPlatformAdmin); err != nil {
				log.Printf("ERROR: gagal memeriksa administrator platform %d: %v", userID, err)
				authServerError(c)
				return
			}
			if isPlatformAdmin {
				var otherActiveAdmins int
				if err := tx.QueryRow(ctx, `
					SELECT COUNT(*)
					FROM platform_administrators pa
					JOIN users u ON u.id = pa.user_id
					WHERE u.is_active AND pa.user_id <> $1
				`, userID).Scan(&otherActiveAdmins); err != nil {
					log.Printf("ERROR: gagal memeriksa administrator platform aktif: %v", err)
					authServerError(c)
					return
				}
				if otherActiveAdmins == 0 {
					c.JSON(http.StatusConflict, gin.H{"success": false, "message": "Akun ini adalah Platform Super Admin aktif terakhir."})
					return
				}
			}
		}

		_, err = tx.Exec(ctx, `
			UPDATE users
			SET is_active = $2,
			    disabled_at = CASE WHEN $2 THEN NULL ELSE NOW() END,
			    disabled_by_user_id = CASE WHEN $2 THEN NULL ELSE $3::BIGINT END
			WHERE id = $1
		`, userID, *request.IsActive, claims.UserID)
		if err != nil {
			log.Printf("ERROR: gagal mengubah status pengguna %d: %v", userID, err)
			authServerError(c)
			return
		}
		action := "platform.user_disabled"
		if *request.IsActive {
			action = "platform.user_enabled"
		}
		details, err := json.Marshal(map[string]any{"is_active": *request.IsActive})
		if err != nil {
			log.Printf("ERROR: gagal menyiapkan audit perubahan status akun: %v", err)
			authServerError(c)
			return
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO audit_logs (
				scope, actor_user_id, action, resource_type, resource_id, details
			)
			VALUES ('platform', $1, $2, 'user', $3, $4)
		`, claims.UserID, action, strconv.FormatInt(userID, 10), string(details))
		if err != nil {
			log.Printf("ERROR: gagal mencatat audit status pengguna %d: %v", userID, err)
			authServerError(c)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			log.Printf("ERROR: gagal menyimpan status pengguna %d: %v", userID, err)
			authServerError(c)
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success":   true,
			"message":   "Status akun berhasil diperbarui.",
			"is_active": *request.IsActive,
		})
	}
}

func normalizeInvitationEmail(value string) (string, bool) {
	email := strings.ToLower(strings.TrimSpace(value))
	parsed, err := mail.ParseAddress(email)
	return email, err == nil && parsed.Address == email && len(email) <= 255
}
