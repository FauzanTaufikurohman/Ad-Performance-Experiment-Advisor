package routes_test

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/database"
	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/middleware"
	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/routes"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestTenantIsolationAndReadOnlyIdentities(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}
	t.Setenv("AUTH_SECRET", "integration-test-secret-value-with-32-characters")
	gin.SetMode(gin.TestMode)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("create test database pool: %v", err)
	}
	t.Cleanup(func() { pool.Close() })
	if err := database.Migrate(ctx, pool); err != nil {
		t.Fatalf("apply migrations to TEST_DATABASE_URL: %v", err)
	}

	suffix := fmt.Sprintf("%d", time.Now().UnixNano())
	analystID := createIdentityTestUser(t, ctx, pool, "analyst-"+suffix+"@example.invalid")
	auditorID := createIdentityTestUser(t, ctx, pool, "auditor-"+suffix+"@example.invalid")
	otherUserID := createIdentityTestUser(t, ctx, pool, "other-"+suffix+"@example.invalid")
	ownerID := createIdentityTestUser(t, ctx, pool, "owner-"+suffix+"@example.invalid")
	platformAdminID := createIdentityTestUser(t, ctx, pool, "platform-"+suffix+"@example.invalid")
	organizationA := createIdentityTestOrganization(t, ctx, pool, analystID, "Tenant A "+suffix)
	organizationB := createIdentityTestOrganization(t, ctx, pool, otherUserID, "Tenant B "+suffix)
	t.Cleanup(func() {
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cleanupCancel()
		if _, err := pool.Exec(cleanupCtx, `DELETE FROM organizations WHERE id = $1 OR id = $2`, organizationA, organizationB); err != nil {
			t.Errorf("delete test organizations: %v", err)
		}
		if _, err := pool.Exec(cleanupCtx, `DELETE FROM users WHERE id = ANY($1)`, []int64{
			analystID, auditorID, otherUserID, ownerID, platformAdminID,
		}); err != nil {
			t.Errorf("delete test users: %v", err)
		}
	})

	for _, membership := range []struct {
		organizationID int64
		userID         int64
		role           string
	}{
		{organizationID: organizationA, userID: analystID, role: middleware.RoleDataAnalyst},
		{organizationID: organizationA, userID: auditorID, role: middleware.RoleAuditor},
		{organizationID: organizationA, userID: ownerID, role: middleware.RoleOrganizationOwner},
		{organizationID: organizationB, userID: otherUserID, role: middleware.RoleOrganizationOwner},
	} {
		if _, err := pool.Exec(ctx, `
			INSERT INTO organization_memberships (organization_id, user_id, role)
			VALUES ($1, $2, $3)
		`, membership.organizationID, membership.userID, membership.role); err != nil {
			t.Fatalf("insert test membership: %v", err)
		}
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO platform_administrators (user_id, provisioned_by_user_id)
		VALUES ($1, $2)
	`, platformAdminID, ownerID); err != nil {
		t.Fatalf("insert test platform administrator: %v", err)
	}
	createIdentityTestUpload(t, ctx, pool, organizationA, analystID, "tenant-a.csv")
	uploadB := createIdentityTestUpload(t, ctx, pool, organizationB, otherUserID, "tenant-b.csv")
	router := routes.SetupRoutes(pool)

	analystToken := createIdentityTestToken(t, analystID, organizationA)
	response := performIdentityTestRequest(t, router, http.MethodGet, fmt.Sprintf("/api/uploads/%d", uploadB), analystToken, "")
	if response.Code != http.StatusNotFound {
		t.Fatalf("cross-tenant upload detail status = %d, want %d; body: %s", response.Code, http.StatusNotFound, response.Body.String())
	}
	assertTenantUploadList(t, router, analystToken, "tenant-a.csv", "tenant-b.csv")

	forgedTenantToken := createIdentityTestToken(t, analystID, organizationB)
	response = performIdentityTestRequest(t, router, http.MethodGet, fmt.Sprintf("/api/uploads/%d", uploadB), forgedTenantToken, "")
	if response.Code != http.StatusForbidden {
		t.Fatalf("token for another tenant status = %d, want %d", response.Code, http.StatusForbidden)
	}

	auditorToken := createIdentityTestToken(t, auditorID, organizationA)
	assertTenantUploadList(t, router, auditorToken, "tenant-a.csv", "tenant-b.csv")
	response = performIdentityTestRequest(t, router, http.MethodPost, "/api/uploads", auditorToken, "")
	if response.Code != http.StatusForbidden {
		t.Fatalf("auditor upload status = %d, want %d", response.Code, http.StatusForbidden)
	}

	ownerToken := createIdentityTestToken(t, ownerID, organizationA)
	invitationResponse := performIdentityTestRequest(
		t,
		router,
		http.MethodPost,
		"/api/organizations/invitations",
		ownerToken,
		fmt.Sprintf(`{"email":"new-%s@example.invalid","role":"auditor"}`, suffix),
	)
	if invitationResponse.Code != http.StatusCreated {
		t.Fatalf("create invitation status = %d, want %d; body: %s", invitationResponse.Code, http.StatusCreated, invitationResponse.Body.String())
	}
	var invitationPayload struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(invitationResponse.Body.Bytes(), &invitationPayload); err != nil || invitationPayload.Token == "" {
		t.Fatalf("decode invitation response: token missing or invalid JSON: %v", err)
	}
	invitationHash := sha256.Sum256([]byte(invitationPayload.Token))
	var invitationHashMatches bool
	if err := pool.QueryRow(ctx, `
		SELECT token_hash = $1
		FROM organization_invitations
		WHERE invited_email = $2
	`, invitationHash[:], "new-"+suffix+"@example.invalid").Scan(&invitationHashMatches); err != nil {
		t.Fatalf("verify invitation token hash: %v", err)
	}
	if !invitationHashMatches {
		t.Fatal("invitation token was not stored as its SHA-256 hash")
	}
	acceptBody := fmt.Sprintf(
		`{"token":%q,"name":"Invited Auditor","password":"integration-password"}`,
		invitationPayload.Token,
	)
	acceptResponse := performIdentityTestRequest(t, router, http.MethodPost, "/api/auth/invitations/accept", "", acceptBody)
	if acceptResponse.Code != http.StatusOK {
		t.Fatalf("accept invitation status = %d, want %d; body: %s", acceptResponse.Code, http.StatusOK, acceptResponse.Body.String())
	}
	var acceptedPayload struct {
		Token string `json:"token"`
		User  struct {
			ID int64 `json:"id"`
		} `json:"user"`
	}
	if err := json.Unmarshal(acceptResponse.Body.Bytes(), &acceptedPayload); err != nil || acceptedPayload.Token == "" {
		t.Fatalf("decode accepted invitation response: %v", err)
	}
	var invitedRole string
	if err := pool.QueryRow(ctx, `
		SELECT role FROM organization_memberships
		WHERE organization_id = $1 AND user_id = $2
	`, organizationA, acceptedPayload.User.ID).Scan(&invitedRole); err != nil {
		t.Fatalf("verify invited membership: %v", err)
	}
	if invitedRole != middleware.RoleAuditor {
		t.Fatalf("invited role = %q, want %q", invitedRole, middleware.RoleAuditor)
	}
	replayedInvitation := performIdentityTestRequest(t, router, http.MethodPost, "/api/auth/invitations/accept", "", acceptBody)
	if replayedInvitation.Code != http.StatusBadRequest {
		t.Fatalf("replayed invitation status = %d, want %d", replayedInvitation.Code, http.StatusBadRequest)
	}

	serviceCreation := performIdentityTestRequest(
		t,
		router,
		http.MethodPost,
		"/api/organizations/service-identities",
		ownerToken,
		`{"name":"AI read-only integration test"}`,
	)
	if serviceCreation.Code != http.StatusCreated {
		t.Fatalf("create service identity status = %d, want %d; body: %s", serviceCreation.Code, http.StatusCreated, serviceCreation.Body.String())
	}
	var servicePayload struct {
		APIKey string `json:"api_key"`
		Data   struct {
			ID int64 `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(serviceCreation.Body.Bytes(), &servicePayload); err != nil || servicePayload.APIKey == "" {
		t.Fatalf("decode service identity response: key missing or invalid JSON: %v", err)
	}
	serviceHash := sha256.Sum256([]byte(servicePayload.APIKey))
	var serviceHashMatches bool
	if err := pool.QueryRow(ctx, `
		SELECT token_hash = $1
		FROM service_identities
		WHERE id = $2
	`, serviceHash[:], servicePayload.Data.ID).Scan(&serviceHashMatches); err != nil {
		t.Fatalf("verify service key hash: %v", err)
	}
	if !serviceHashMatches {
		t.Fatal("service key was not stored as its SHA-256 hash")
	}
	serviceList := performIdentityTestRequest(
		t,
		router,
		http.MethodGet,
		"/api/organizations/service-identities",
		ownerToken,
		"",
	)
	if serviceList.Code != http.StatusOK {
		t.Fatalf("list service identities status = %d, want %d", serviceList.Code, http.StatusOK)
	}
	if strings.Contains(serviceList.Body.String(), "api_key") ||
		strings.Contains(serviceList.Body.String(), servicePayload.APIKey) {
		t.Fatal("service identity list exposed the API key")
	}
	analystServiceList := performIdentityTestRequest(
		t,
		router,
		http.MethodGet,
		"/api/organizations/service-identities",
		analystToken,
		"",
	)
	if analystServiceList.Code != http.StatusForbidden {
		t.Fatalf("analyst service identity list status = %d, want %d", analystServiceList.Code, http.StatusForbidden)
	}
	assertTenantUploadList(t, router, servicePayload.APIKey, "tenant-a.csv", "tenant-b.csv")
	response = performIdentityTestRequest(t, router, http.MethodPost, "/api/auth/organizations/select", servicePayload.APIKey, `{}`)
	if response.Code != http.StatusForbidden {
		t.Fatalf("service identity organization selection status = %d, want %d", response.Code, http.StatusForbidden)
	}
	response = performIdentityTestRequest(t, router, http.MethodPost, "/api/uploads", servicePayload.APIKey, "")
	if response.Code != http.StatusForbidden {
		t.Fatalf("service identity upload status = %d, want %d", response.Code, http.StatusForbidden)
	}
	revokeResponse := performIdentityTestRequest(
		t,
		router,
		http.MethodPost,
		fmt.Sprintf("/api/organizations/service-identities/%d/revoke", servicePayload.Data.ID),
		ownerToken,
		"",
	)
	if revokeResponse.Code != http.StatusOK {
		t.Fatalf("revoke service identity status = %d, want %d", revokeResponse.Code, http.StatusOK)
	}
	response = performIdentityTestRequest(t, router, http.MethodGet, "/api/uploads", servicePayload.APIKey, "")
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("revoked service identity status = %d, want %d", response.Code, http.StatusUnauthorized)
	}

	platformToken := createIdentityTestToken(t, platformAdminID, organizationA)
	statusResponse := performIdentityTestRequest(
		t,
		router,
		http.MethodPost,
		fmt.Sprintf("/api/platform/users/%d/status", otherUserID),
		platformToken,
		`{"is_active":false}`,
	)
	if statusResponse.Code != http.StatusOK {
		t.Fatalf("disable user status = %d, want %d; body: %s", statusResponse.Code, http.StatusOK, statusResponse.Body.String())
	}
	otherUserToken := createIdentityTestToken(t, otherUserID, organizationB)
	response = performIdentityTestRequest(t, router, http.MethodGet, "/api/uploads", otherUserToken, "")
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("disabled user status = %d, want %d", response.Code, http.StatusUnauthorized)
	}
	selfDisable := performIdentityTestRequest(
		t,
		router,
		http.MethodPost,
		fmt.Sprintf("/api/platform/users/%d/status", platformAdminID),
		platformToken,
		`{"is_active":false}`,
	)
	if selfDisable.Code != http.StatusConflict {
		t.Fatalf("self-disable status = %d, want %d", selfDisable.Code, http.StatusConflict)
	}

	var invitationAuditCount, serviceAuditCount, platformAuditCount int
	if err := pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM audit_logs
		WHERE organization_id = $1
		  AND action IN ('organization.invitation_created', 'organization.invitation_accepted')
	`, organizationA).Scan(&invitationAuditCount); err != nil {
		t.Fatalf("count invitation audit events: %v", err)
	}
	if err := pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM audit_logs
		WHERE organization_id = $1
		  AND action IN ('organization.service_identity_created', 'organization.service_identity_revoked')
	`, organizationA).Scan(&serviceAuditCount); err != nil {
		t.Fatalf("count service identity audit events: %v", err)
	}
	if err := pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM audit_logs
		WHERE scope = 'platform' AND action = 'platform.user_disabled'
		  AND resource_id = $1
	`, fmt.Sprintf("%d", otherUserID)).Scan(&platformAuditCount); err != nil {
		t.Fatalf("count platform audit events: %v", err)
	}
	if invitationAuditCount != 2 || serviceAuditCount != 2 || platformAuditCount != 1 {
		t.Fatalf("audit event counts = invitation %d, service %d, platform %d; want 2, 2, 1",
			invitationAuditCount, serviceAuditCount, platformAuditCount)
	}
}

func assertTenantUploadList(t *testing.T, router http.Handler, token, wantName, forbiddenName string) {
	t.Helper()
	response := performIdentityTestRequest(t, router, http.MethodGet, "/api/uploads", token, "")
	if response.Code != http.StatusOK {
		t.Fatalf("upload history status = %d, want %d; body: %s", response.Code, http.StatusOK, response.Body.String())
	}
	var payload struct {
		Data []struct {
			Filename string `json:"filename"`
		} `json:"data"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode upload history: %v", err)
	}
	body := response.Body.String()
	if !strings.Contains(body, wantName) {
		t.Errorf("upload history does not contain %q: %s", wantName, body)
	}
	if strings.Contains(body, forbiddenName) {
		t.Errorf("upload history leaked %q: %s", forbiddenName, body)
	}
}

func createIdentityTestUser(t *testing.T, ctx context.Context, pool *pgxpool.Pool, email string) int64 {
	t.Helper()
	var id int64
	if err := pool.QueryRow(ctx, `
		INSERT INTO users (name, email, password_hash)
		VALUES ('Identity Test', $1, 'unused')
		RETURNING id
	`, email).Scan(&id); err != nil {
		t.Fatalf("create test user %q: %v", email, err)
	}
	return id
}

func createIdentityTestOrganization(
	t *testing.T,
	ctx context.Context,
	pool *pgxpool.Pool,
	createdBy int64,
	name string,
) int64 {
	t.Helper()
	var id int64
	if err := pool.QueryRow(ctx, `
		INSERT INTO organizations (name, created_by_user_id)
		VALUES ($1, $2)
		RETURNING id
	`, name, createdBy).Scan(&id); err != nil {
		t.Fatalf("create test organization %q: %v", name, err)
	}
	return id
}

func createIdentityTestUpload(
	t *testing.T,
	ctx context.Context,
	pool *pgxpool.Pool,
	organizationID, userID int64,
	filename string,
) int64 {
	t.Helper()
	var id int64
	if err := pool.QueryRow(ctx, `
		INSERT INTO uploads (filename, organization_id, user_id)
		VALUES ($1, $2, $3)
		RETURNING id
	`, filename, organizationID, userID).Scan(&id); err != nil {
		t.Fatalf("create test upload %q: %v", filename, err)
	}
	return id
}

func createIdentityTestToken(t *testing.T, userID, organizationID int64) string {
	t.Helper()
	token, err := middleware.CreateToken(middleware.Claims{
		UserID:         userID,
		OrganizationID: organizationID,
	})
	if err != nil {
		t.Fatalf("create test token: %v", err)
	}
	return token
}

func performIdentityTestRequest(
	t *testing.T,
	router http.Handler,
	method, path, token, body string,
) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}
