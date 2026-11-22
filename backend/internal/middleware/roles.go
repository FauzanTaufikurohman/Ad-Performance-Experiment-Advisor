package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

const (
	RoleOrganizationOwner   = "organization_owner"
	RoleOrganizationAdmin   = "organization_admin"
	RoleCMOExecutive        = "cmo_executive"
	RoleMarketingManager    = "marketing_manager"
	RoleCampaignSpecialist  = "campaign_specialist"
	RoleDataAnalyst         = "data_analyst"
	RoleFinancialController = "financial_controller"
	RoleAuditor             = "auditor"
	RoleAIServiceIdentity   = "ai_service_identity"
	RolePlatformSuperAdmin  = "platform_super_admin"
)

var organizationRoles = map[string]struct{}{
	RoleOrganizationOwner:   {},
	RoleOrganizationAdmin:   {},
	RoleCMOExecutive:        {},
	RoleMarketingManager:    {},
	RoleCampaignSpecialist:  {},
	RoleDataAnalyst:         {},
	RoleFinancialController: {},
	RoleAuditor:             {},
}

func IsOrganizationRole(role string) bool {
	_, exists := organizationRoles[role]
	return exists
}

func CanManageOrganizationMembers(role string) bool {
	return role == RolePlatformSuperAdmin ||
		role == RoleOrganizationOwner ||
		role == RoleOrganizationAdmin
}

func CanAssignOrganizationRole(actorRole, targetRole string) bool {
	if !CanManageOrganizationMembers(actorRole) || !IsOrganizationRole(targetRole) {
		return false
	}
	if actorRole == RolePlatformSuperAdmin {
		return true
	}
	if targetRole == RoleOrganizationOwner {
		return actorRole == RoleOrganizationOwner
	}
	return true
}

func RequireRoles(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(roles))
	for _, role := range roles {
		allowed[role] = struct{}{}
	}

	return func(c *gin.Context) {
		claims, ok := AuthenticatedUser(c)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "Sesi tidak valid. Silakan masuk kembali.",
			})
			return
		}
		if _, exists := allowed[claims.Role]; !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"message": "Role Anda tidak memiliki izin untuk tindakan ini.",
			})
			return
		}
		c.Next()
	}
}
