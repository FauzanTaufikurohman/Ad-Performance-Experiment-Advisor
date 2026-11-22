package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestCanAssignOrganizationRole(t *testing.T) {
	tests := []struct {
		name      string
		actorRole string
		target    string
		want      bool
	}{
		{"owner assigns analyst", RoleOrganizationOwner, RoleDataAnalyst, true},
		{"admin assigns manager", RoleOrganizationAdmin, RoleMarketingManager, true},
		{"admin cannot assign owner", RoleOrganizationAdmin, RoleOrganizationOwner, false},
		{"platform admin assigns owner", RolePlatformSuperAdmin, RoleOrganizationOwner, true},
		{"analyst cannot assign role", RoleDataAnalyst, RoleCampaignSpecialist, false},
		{"cannot assign platform super admin", RoleOrganizationOwner, RolePlatformSuperAdmin, false},
		{"platform admin cannot assign platform admin", RolePlatformSuperAdmin, RolePlatformSuperAdmin, false},
		{"owner assigns auditor", RoleOrganizationOwner, RoleAuditor, true},
		{"admin assigns auditor", RoleOrganizationAdmin, RoleAuditor, true},
		{"cannot assign AI service identity as user", RoleOrganizationOwner, RoleAIServiceIdentity, false},
		{"unknown target role", RoleOrganizationOwner, "unknown", false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := CanAssignOrganizationRole(test.actorRole, test.target); got != test.want {
				t.Fatalf("CanAssignOrganizationRole(%q, %q) = %t, want %t",
					test.actorRole, test.target, got, test.want)
			}
		})
	}
}

func TestRequireRolesDeniesReadOnlyRoleForWrites(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST(
		"/write",
		func(c *gin.Context) {
			c.Set("authenticated_user", Claims{Role: RoleFinancialController})
			c.Next()
		},
		RequireRoles(RoleOrganizationOwner, RoleMarketingManager),
		func(c *gin.Context) {
			c.Status(http.StatusNoContent)
		},
	)

	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/write", nil))

	if response.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusForbidden)
	}
}

func TestRequireRolesDeniesAuditorAndServiceIdentityForWrites(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, role := range []string{RoleAuditor, RoleAIServiceIdentity} {
		t.Run(role, func(t *testing.T) {
			router := gin.New()
			router.POST(
				"/write",
				func(c *gin.Context) {
					c.Set("authenticated_user", Claims{Role: role})
					c.Next()
				},
				RequireRoles(RoleOrganizationOwner, RoleOrganizationAdmin, RoleDataAnalyst),
				func(c *gin.Context) {
					c.Status(http.StatusNoContent)
				},
			)

			response := httptest.NewRecorder()
			router.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/write", nil))

			if response.Code != http.StatusForbidden {
				t.Fatalf("status = %d, want %d", response.Code, http.StatusForbidden)
			}
		})
	}
}

func TestRequireHumanDeniesServiceIdentity(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST(
		"/human-only",
		func(c *gin.Context) {
			c.Set("authenticated_user", Claims{PrincipalType: "service"})
			c.Next()
		},
		RequireHuman(),
		func(c *gin.Context) {
			c.Status(http.StatusNoContent)
		},
	)

	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/human-only", nil))

	if response.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusForbidden)
	}
}
