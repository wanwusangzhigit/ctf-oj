package v1

import (
	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/api/middleware"
	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/service"
)

// recordAudit captures a privileged mutation using the current request actor.
// A nil audit service is tolerated so optional wiring stays simple.
func recordAudit(c *gin.Context, svc *service.AuditService, action, targetType string, targetID uint, payload any) {
	if svc == nil {
		return
	}
	uid, _ := getUID(c)
	svc.Record(
		c.Request.Context(),
		&domain.User{ID: uid, Username: middleware.CurrentUsername(c)},
		action,
		targetType,
		targetID,
		c.ClientIP(),
		withDelegation(c, payload),
	)
}

// withDelegation tags audit entries produced through a resource grant so
// administrators can distinguish them from global-role actions.
func withDelegation(c *gin.Context, payload any) any {
	grant := middleware.Delegation(c)
	if grant == "" {
		return payload
	}
	switch p := payload.(type) {
	case nil:
		return map[string]any{"delegated": true, "grant": grant}
	case map[string]string:
		out := make(map[string]any, len(p)+2)
		for k, v := range p {
			out[k] = v
		}
		out["delegated"] = true
		out["grant"] = grant
		return out
	case map[string]any:
		out := make(map[string]any, len(p)+2)
		for k, v := range p {
			out[k] = v
		}
		out["delegated"] = true
		out["grant"] = grant
		return out
	default:
		return map[string]any{"delegated": true, "grant": grant, "detail": payload}
	}
}
