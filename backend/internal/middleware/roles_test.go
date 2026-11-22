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
