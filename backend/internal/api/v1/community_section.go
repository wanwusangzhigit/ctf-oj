package v1

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/response"
	"github.com/ctf-oj/backend/internal/service"
)

type CommunitySectionHandler struct {
	svc   *service.CommunitySectionService
	audit *service.AuditService
}

func NewCommunitySectionHandler(s *service.CommunitySectionService, audit *service.AuditService) *CommunitySectionHandler {
	return &CommunitySectionHandler{svc: s, audit: audit}
}

// sectionCopyReq is what a board manager can send: the board's own text. Policy
// and ordering live in sectionAdminReq, because moving a board or locking it
// down is station work.
type sectionCopyReq struct {
	Name         string `json:"name" binding:"required"`
	Blurb        string `json:"blurb"`
	GuidelinesMD string `json:"guidelinesMd"`
}

type sectionAdminReq struct {
	Name         string `json:"name" binding:"required"`
	Blurb        string `json:"blurb"`
	GuidelinesMD string `json:"guidelinesMd"`
	Visibility   string `json:"visibility"`
	Posting      string `json:"posting"`
	SortOrder    int    `json:"sortOrder"`
}

func (req sectionCopyReq) input() service.CommunitySectionInput {
	return service.CommunitySectionInput{
		Name:         req.Name,
		Blurb:        req.Blurb,
		GuidelinesMD: req.GuidelinesMD,
	}
}

func (req sectionAdminReq) input() service.CommunitySectionInput {
	return service.CommunitySectionInput{
		Name:         req.Name,
		Blurb:        req.Blurb,
		GuidelinesMD: req.GuidelinesMD,
		Visibility:   req.Visibility,
		Posting:      req.Posting,
		SortOrder:    req.SortOrder,
	}
}

func sectionIDParam(c *gin.Context) (uint, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		response.Err(c, domain.ErrInvalidArgument)
		return 0, false
	}
	return uint(id), true
}

func (h *CommunitySectionHandler) ListAdmin(c *gin.Context) {
	sections, err := h.svc.ListAdmin(c.Request.Context())
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, sections)
}

func (h *CommunitySectionHandler) Create(c *gin.Context) {
	var req sectionAdminReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	section, err := h.svc.Create(c.Request.Context(), req.input())
	if err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "community_section.create", "community_section", section.ID, map[string]string{"name": section.Name})
	response.Created(c, section)
}

func (h *CommunitySectionHandler) Update(c *gin.Context) {
	id, ok := sectionIDParam(c)
	if !ok {
		return
	}
	var req sectionAdminReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	section, err := h.svc.Update(c.Request.Context(), id, req.input())
	if err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "community_section.update", "community_section", section.ID, map[string]string{"name": section.Name})
	response.OK(c, section)
}

// UpdateCopy is the board manager's route. It reuses the admin payload shape but
// drops every field that route may not write.
func (h *CommunitySectionHandler) UpdateCopy(c *gin.Context) {
	id, ok := sectionIDParam(c)
	if !ok {
		return
	}
	var req sectionCopyReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	section, err := h.svc.UpdateCopy(c.Request.Context(), id, req.input())
	if err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "community_section.copy", "community_section", section.ID, map[string]string{"name": section.Name})
	response.OK(c, section)
}

func (h *CommunitySectionHandler) Delete(c *gin.Context) {
	id, ok := sectionIDParam(c)
	if !ok {
		return
	}
	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "community_section.delete", "community_section", id, nil)
	response.NoContent(c)
}

func (h *CommunitySectionHandler) ListGrants(c *gin.Context) {
	id, ok := sectionIDParam(c)
	if !ok {
		return
	}
	gs, err := h.svc.ListGrants(c.Request.Context(), id)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gs)
}

func (h *CommunitySectionHandler) SetGrants(c *gin.Context) {
	id, ok := sectionIDParam(c)
	if !ok {
		return
	}
	var req setGrantsReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	if err := h.svc.SetGrants(c.Request.Context(), id, req.Grants); err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "community_section.access", "community_section", id, map[string]any{"grants": req.Grants})
	gs, err := h.svc.ListGrants(c.Request.Context(), id)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gs)
}
