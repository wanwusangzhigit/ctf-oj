package v1

import (
	"context"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/response"
	"github.com/ctf-oj/backend/internal/service"
)

type AccessHandler struct {
	svc   *service.ChallengeAccessService
	audit *service.AuditService
}

func NewAccessHandler(svc *service.ChallengeAccessService, audit *service.AuditService) *AccessHandler {
	return &AccessHandler{svc: svc, audit: audit}
}

func enrichDelegations(ctx context.Context, u *domain.User, access *service.ChallengeAccessService) {
	if u == nil || access == nil {
		return
	}
	if ds, err := access.ListDelegations(ctx, u.ID); err == nil {
		u.Delegations = ds
	}
}

func (h *AccessHandler) ListGroups(c *gin.Context) {
	gs, err := h.svc.ListGroups(c.Request.Context())
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gs)
}

func (h *AccessHandler) CreateGroup(c *gin.Context) {
	var req service.ChallengeGroupInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	g, err := h.svc.CreateGroup(c.Request.Context(), req)
	if err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "access_group.create", "access_group", g.ID, map[string]string{"name": g.Name})
	response.Created(c, g)
}

func (h *AccessHandler) UpdateGroup(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	var req service.ChallengeGroupInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	g, err := h.svc.UpdateGroup(c.Request.Context(), uint(id), req)
	if err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "access_group.update", "access_group", g.ID, map[string]string{"name": g.Name})
	response.OK(c, g)
}

func (h *AccessHandler) DeleteGroup(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	if err := h.svc.DeleteGroup(c.Request.Context(), uint(id)); err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "access_group.delete", "access_group", uint(id), nil)
	response.NoContent(c)
}

func (h *AccessHandler) SearchSubjects(c *gin.Context) {
	subs, err := h.svc.SearchSubjects(c.Request.Context(), c.Query("type"), c.Query("q"))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, subs)
}

func (h *AccessHandler) ListGrants(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	gs, err := h.svc.ListGrants(c.Request.Context(), uint(id))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gs)
}

type setGrantsReq struct {
	Grants []domain.AccessSubject `json:"grants"`
}

func (h *AccessHandler) ListCompetitionGrants(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	gs, err := h.svc.ListCompetitionGrants(c.Request.Context(), uint(id))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gs)
}

func (h *AccessHandler) SetCompetitionGrants(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	var req setGrantsReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	if err := h.svc.SetCompetitionGrants(c.Request.Context(), uint(id), req.Grants); err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "competition.access", "competition", uint(id), map[string]any{"grants": req.Grants})
	gs, err := h.svc.ListCompetitionGrants(c.Request.Context(), uint(id))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gs)
}

func (h *AccessHandler) SetGrants(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	var req setGrantsReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	if err := h.svc.SetGrants(c.Request.Context(), uint(id), req.Grants); err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "challenge.access", "challenge", uint(id), map[string]any{"grants": req.Grants})
	gs, err := h.svc.ListGrants(c.Request.Context(), uint(id))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gs)
}
