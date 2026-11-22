package handlers

import (
	"context"
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
)

type organizationMember struct {
	ID       int64     `json:"id"`
	Name     string    `json:"name"`
	Email    string    `json:"email"`
	Role     string    `json:"role"`
	JoinedAt time.Time `json:"joined_at"`
}

func GetCurrentOrganization(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, _ := middleware.AuthenticatedUser(c)
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		var organization struct {
			ID               int64     `json:"id"`
			Name             string    `json:"name"`
			CreatedAt        time.Time `json:"created_at"`
			DefaultWorkspace string    `json:"default_workspace"`
		}
		err := pool.QueryRow(ctx, `
			SELECT o.id, o.name, o.created_at, COALESCE(w.name, '')
			FROM organizations o
			LEFT JOIN workspaces w
				ON w.organization_id = o.id AND w.is_default
			WHERE o.id = $1
		`, claims.OrganizationID).Scan(
			&organization.ID,
			&organization.Name,
			&organization.CreatedAt,
			&organization.DefaultWorkspace,
		)
		if err != nil {
			log.Printf("ERROR: gagal mengambil organisasi %d: %v", claims.OrganizationID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Gagal mengambil informasi organisasi.",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success":      true,
			"organization": organization,
			"role":         claims.Role,
		})
	}
}

func GetOrganizationMembers(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, _ := middleware.AuthenticatedUser(c)
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		rows, err := pool.Query(ctx, `
			SELECT u.id, u.name, u.email, m.role, m.created_at
			FROM organization_memberships m
			JOIN users u ON u.id = m.user_id
			WHERE m.organization_id = $1
			ORDER BY
				CASE m.role
					WHEN 'organization_owner' THEN 0
					WHEN 'organization_admin' THEN 1
					ELSE 2
				END,
				LOWER(u.name),
				u.id
		`, claims.OrganizationID)
		if err != nil {
			log.Printf("ERROR: gagal mengambil anggota organisasi %d: %v", claims.OrganizationID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Gagal mengambil anggota organisasi.",
			})
			return
		}
		defer rows.Close()

		members := make([]organizationMember, 0)
		for rows.Next() {
			var member organizationMember
			if err := rows.Scan(
				&member.ID,
				&member.Name,
				&member.Email,
				&member.Role,
				&member.JoinedAt,
			); err != nil {
				log.Printf("ERROR: gagal membaca anggota organisasi %d: %v", claims.OrganizationID, err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"message": "Gagal membaca anggota organisasi.",
				})
				return
			}
			members = append(members, member)
		}
		if err := rows.Err(); err != nil {
			log.Printf("ERROR: iterasi anggota organisasi %d gagal: %v", claims.OrganizationID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Gagal membaca anggota organisasi.",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    members,
		})
	}
}

func AddOrganizationMember(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var request struct {
			Email string `json:"email" binding:"required"`
			Role  string `json:"role" binding:"required"`
		}
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Email dan role wajib diisi.",
			})
			return
		}

		request.Email = strings.ToLower(strings.TrimSpace(request.Email))
		parsedEmail, err := mail.ParseAddress(request.Email)
		if err != nil || parsedEmail.Address != request.Email || len(request.Email) > 255 {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Format email tidak valid.",
			})
			return
		}

		claims, _ := middleware.AuthenticatedUser(c)
		if !middleware.CanAssignOrganizationRole(claims.Role, request.Role) {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"message": "Role Anda tidak dapat menetapkan role tersebut.",
			})
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		tx, err := pool.Begin(ctx)
		if err != nil {
			log.Printf("ERROR: gagal memulai penambahan anggota: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Anggota organisasi gagal ditambahkan.",
			})
			return
		}
		defer func() { _ = tx.Rollback(ctx) }()

		var userID int64
		err = tx.QueryRow(ctx, `
			SELECT id
			FROM users
			WHERE LOWER(email) = $1
		`, request.Email).Scan(&userID)
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Email belum terdaftar. Pengguna harus membuat akun terlebih dahulu.",
			})
			return
		}
		if err != nil {
			log.Printf("ERROR: gagal mencari pengguna untuk organisasi %d: %v", claims.OrganizationID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Pengguna organisasi gagal diverifikasi.",
			})
			return
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO organization_memberships (organization_id, user_id, role)
			VALUES ($1, $2, $3)
		`, claims.OrganizationID, userID, request.Role)
		if err != nil {
			var postgresError *pgconn.PgError
			if errors.As(err, &postgresError) && postgresError.Code == "23505" {
				c.JSON(http.StatusConflict, gin.H{
					"success": false,
					"message": "Pengguna sudah menjadi anggota organisasi ini.",
				})
				return
			}
			log.Printf("ERROR: gagal menambahkan anggota ke organisasi %d: %v", claims.OrganizationID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Anggota organisasi gagal ditambahkan.",
			})
			return
		}

		details, err := json.Marshal(map[string]string{
			"email": request.Email,
			"role":  request.Role,
		})
		if err != nil {
			log.Printf("ERROR: gagal menyiapkan audit penambahan anggota: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Audit anggota organisasi gagal disiapkan.",
			})
			return
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO audit_logs (
				organization_id, actor_user_id, action, resource_type,
				resource_id, details
			)
			VALUES ($1, $2, 'organization.member_added', 'user', $3, $4)
		`, claims.OrganizationID, claims.UserID, strconv.FormatInt(userID, 10), string(details))
		if err != nil {
			log.Printf("ERROR: gagal mencatat audit anggota organisasi %d: %v", claims.OrganizationID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Audit anggota organisasi gagal dicatat.",
			})
			return
		}

		if err := tx.Commit(ctx); err != nil {
			log.Printf("ERROR: gagal menyimpan anggota organisasi %d: %v", claims.OrganizationID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Anggota organisasi gagal ditambahkan.",
			})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"success": true,
			"message": "Anggota organisasi berhasil ditambahkan.",
		})
	}
}
