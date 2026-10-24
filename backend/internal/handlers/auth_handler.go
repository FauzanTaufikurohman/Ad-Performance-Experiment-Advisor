package handlers

import (
	"context"
	"errors"
	"log"
	"net/http"
	"net/mail"
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
	Name     string `json:"name"`
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type authUser struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
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
		email := strings.ToLower(strings.TrimSpace(request.Email))
		if name == "" || len(name) > 100 {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Nama wajib diisi dan maksimal 100 karakter.",
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

		var user authUser
		err = pool.QueryRow(ctx, `
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

		respondWithToken(c, user)
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
		err := pool.QueryRow(ctx, `
			SELECT id, name, email, password_hash
			FROM users
			WHERE email = $1
		`, email).Scan(&user.ID, &user.Name, &user.Email, &passwordHash)
		if errors.Is(err, pgx.ErrNoRows) ||
			(err == nil && bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(request.Password)) != nil) {
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

		respondWithToken(c, user)
	}
}

func CurrentUser() gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, ok := middleware.AuthenticatedUser(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "Sesi tidak valid. Silakan masuk kembali.",
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"user": authUser{
				ID:    claims.UserID,
				Name:  claims.Name,
				Email: claims.Email,
			},
		})
	}
}

func respondWithToken(c *gin.Context, user authUser) {
	token, err := middleware.CreateToken(middleware.Claims{
		UserID: user.ID,
		Email:  user.Email,
		Name:   user.Name,
	})
	if err != nil {
		log.Printf("ERROR: gagal membuat token autentikasi: %v", err)
		authServerError(c)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"token":   token,
		"user":    user,
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
