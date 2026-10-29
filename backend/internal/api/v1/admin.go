package v1

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/api/middleware"
	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/response"
	"github.com/ctf-oj/backend/internal/service"
)

type AdminUserHandler struct {
	users domain.UserRepository
	svc   *service.UserService
	audit *service.AuditService
}

func NewAdminUserHandler(u domain.UserRepository, svc *service.UserService, audit *service.AuditService) *AdminUserHandler {
	return &AdminUserHandler{users: u, svc: svc, audit: audit}
}

func (h *AdminUserHandler) List(c *gin.Context) {
	page, pageSize := parsePaging(c)
	filter := domain.UserFilter{
		Query: c.Query("q"),
		Role:  c.Query("role"),
	}
	if v := c.Query("banned"); v != "" {
		b := v == "true" || v == "1"
		filter.Banned = &b
	}
	us, total, err := h.users.Search(c.Request.Context(), filter, page, pageSize)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Paged(c, us, total, page, pageSize)
}

type updateUserReq struct {
	Role          *string `json:"role"`
	IsBanned      *bool   `json:"isBanned"`
	BannedReason  string  `json:"bannedReason"`
	ScoreExcluded *bool   `json:"scoreExcluded"`
}

func (h *AdminUserHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	var req updateUserReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	ctx := c.Request.Context()
	target, err := h.users.FindByID(ctx, uint(id))
	if err != nil {
		response.Err(c, err)
		return
	}
	actorID, _ := middleware.CurrentUserID(c)
	if target.ID == actorID {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	beforeRole := target.Role
	beforeBanned := target.IsBanned
	beforeExcluded := target.ScoreExcluded

	if req.Role != nil {
		role := domain.Role(*req.Role)
		if role != domain.RoleUser && role != domain.RoleAdmin &&
			role != domain.RoleChallengeAdmin && role != domain.RoleCompetitionAdmin &&
			role != domain.RoleModerator {
			response.Err(c, domain.ErrInvalidArgument)
			return
		}
		if err := h.users.SetRole(ctx, target.ID, role); err != nil {
			response.Err(c, err)
			return
		}
	}
	if req.IsBanned != nil {
		if err := h.users.SetBanned(ctx, target.ID, *req.IsBanned, req.BannedReason); err != nil {
			response.Err(c, err)
			return
		}
	}
	if req.ScoreExcluded != nil {
		if err := h.users.SetScoreExcluded(ctx, target.ID, *req.ScoreExcluded); err != nil {
			response.Err(c, err)
			return
		}
	}
	updated, err := h.users.FindByID(ctx, target.ID)
	if err != nil {
		response.Err(c, err)
		return
	}

	actor := &domain.User{ID: actorID, Username: middleware.CurrentUsername(c)}
	ip := c.ClientIP()
	if updated.Role != beforeRole {
		h.audit.Record(ctx, actor, "user.role", "user", updated.ID, ip, map[string]string{
			"from": string(beforeRole),
			"to":   string(updated.Role),
		})
	}
	if updated.IsBanned != beforeBanned {
		action := "user.unban"
		if updated.IsBanned {
			action = "user.ban"
		}
		h.audit.Record(ctx, actor, action, "user", updated.ID, ip, map[string]string{
			"reason": updated.BannedReason,
		})
	}
	if updated.ScoreExcluded != beforeExcluded {
		h.audit.Record(ctx, actor, "user.score_excluded", "user", updated.ID, ip, map[string]bool{
			"excluded": updated.ScoreExcluded,
		})
	}
	response.OK(c, updated)
}

type AdminInstanceHandler struct {
	svc   *service.InstanceService
	audit *service.AuditService
}

func NewAdminInstanceHandler(svc *service.InstanceService, audit *service.AuditService) *AdminInstanceHandler {
	return &AdminInstanceHandler{svc: svc, audit: audit}
}

func (h *AdminInstanceHandler) List(c *gin.Context) {
	page, pageSize := parsePaging(c)
	filter := domain.InstanceListFilter{}
	if v := c.Query("user_id"); v != "" {
		if id, err := strconv.ParseUint(v, 10, 64); err == nil {
			filter.UserID = uint(id)
		}
	}
	if v := c.Query("challenge_id"); v != "" {
		if id, err := strconv.ParseUint(v, 10, 64); err == nil {
			filter.ChallengeID = uint(id)
		}
	}
	if v := c.Query("status"); v != "" {
		filter.Status = domain.InstanceStatus(v)
	}
	is, total, err := h.svc.AdminList(c.Request.Context(), page, pageSize, filter)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Paged(c, is, total, page, pageSize)
}

func (h *AdminInstanceHandler) Stop(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	if err := h.svc.AdminStop(c.Request.Context(), uint(id)); err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "instance.stop", "instance", uint(id), nil)
	response.OK(c, gin.H{"ok": true})
}

func (h *AdminInstanceHandler) Logs(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	out, err := h.svc.Logs(c.Request.Context(), 0, true, uint(id))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gin.H{"logs": out})
}

type resetPasswordReq struct {
	NewPassword string `json:"newPassword" binding:"required"`
}

// ResetPassword sets a new password for a user without knowing the old one.
func (h *AdminUserHandler) ResetPassword(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	var req resetPasswordReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	if err := h.svc.AdminResetPassword(c.Request.Context(), uint(id), req.NewPassword); err != nil {
		response.Err(c, err)
		return
	}
	actorID, _ := middleware.CurrentUserID(c)
	h.audit.Record(c.Request.Context(), &domain.User{ID: actorID, Username: middleware.CurrentUsername(c)},
		"user.reset_password", "user", uint(id), c.ClientIP(), nil)
	response.OK(c, gin.H{"ok": true})
}
