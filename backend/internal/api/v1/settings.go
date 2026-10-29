package v1

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/api/middleware"
	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/response"
	"github.com/ctf-oj/backend/internal/service"
)

/**
 * SettingHandler — public read + admin write.
 */

type SettingHandler struct {
	svc  *service.SettingService
	auth *service.AuditService
}

func NewSettingHandler(svc *service.SettingService, audit *service.AuditService) *SettingHandler {
	return &SettingHandler{svc: svc, auth: audit}
}

// Public returns the safe-to-share subset of settings.
func (h *SettingHandler) Public(c *gin.Context) {
	v, err := h.svc.PublicView(c.Request.Context())
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, v)
}

// AdminList returns the full key/value list.
func (h *SettingHandler) AdminList(c *gin.Context) {
	all, err := h.svc.AdminView(c.Request.Context())
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, all)
}

// AdminUpdate accepts a flat map[string]string and writes them all.
func (h *SettingHandler) AdminUpdate(c *gin.Context) {
	var req map[string]string
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	if len(req) == 0 {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	// Strip keys the admin must not change through this endpoint.
	for _, protected := range []string{"competition.active_id"} {
		delete(req, protected)
	}
	uid, _ := getUID(c)
	if err := h.svc.UpdateMany(c.Request.Context(), req, uid); err != nil {
		response.Err(c, err)
		return
	}
	if h.auth != nil {
		ip := c.ClientIP()
		user := &domain.User{ID: uid, Username: middleware.CurrentUsername(c)}
		h.auth.Record(c.Request.Context(), user, "settings.update", "setting", 0, ip, req)
	}
	response.OK(c, gin.H{"ok": true})
}

// AuditHandler — list audit log entries (admin only).
type AuditHandler struct {
	svc *service.AuditService
}

func NewAuditHandler(svc *service.AuditService) *AuditHandler {
	return &AuditHandler{svc: svc}
}

func (h *AuditHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))
	filter := domain.AuditLogFilter{}
	if v := c.Query("action"); v != "" {
		filter.Action = v
	}
	if v := c.Query("target_type"); v != "" {
		filter.TargetType = v
	}
	if v := c.Query("actor_id"); v != "" {
		if id, err := strconv.ParseUint(v, 10, 64); err == nil {
			filter.ActorID = uint(id)
		}
	}
	entries, total, err := h.svc.List(c.Request.Context(), page, pageSize, filter)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Paged(c, entries, total, page, pageSize)
}
