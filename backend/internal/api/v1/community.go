package v1

import (
	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/api/middleware"
	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/response"
	"github.com/ctf-oj/backend/internal/service"
)

type CommunityHandler struct {
	svc   *service.CommunityAccessService
	audit *service.AuditService
}

func NewCommunityHandler(s *service.CommunityAccessService, audit *service.AuditService) *CommunityHandler {
	return &CommunityHandler{svc: s, audit: audit}
}

func (h *CommunityHandler) Meta(c *gin.Context) {
	uid, _ := getUID(c)
	meta, err := h.svc.Meta(c.Request.Context(), uid, middleware.HasPermission(c, domain.PermDiscussionModerate))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, meta)
}

type communityPolicyReq struct {
	Visibility string `json:"visibility" binding:"required"`
	Posting    string `json:"posting" binding:"required"`
}

func (h *CommunityHandler) AdminGet(c *gin.Context) {
	uid, _ := getUID(c)
	meta, err := h.svc.Meta(c.Request.Context(), uid, true)
	if err != nil {
		response.Err(c, err)
		return
	}
	grants, err := h.svc.ListGrants(c.Request.Context())
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gin.H{
		"visibility": meta.Visibility,
		"posting":    meta.Posting,
		"grants":     grants,
		"copy":       meta.Copy,
	})
}

func (h *CommunityHandler) UpdatePolicy(c *gin.Context) {
	var req communityPolicyReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	uid, _ := getUID(c)
	if err := h.svc.UpdatePolicy(c.Request.Context(), req.Visibility, req.Posting, uid); err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "community.policy", "community", 0, map[string]string{
		"visibility": req.Visibility,
		"posting":    req.Posting,
	})
	h.AdminGet(c)
}

type communityCopyReq struct {
	Copy map[string]string `json:"copy" binding:"required"`
}

// UpdateCopy is a separate verb from UpdatePolicy because the policy request
// requires visibility and posting: saving copy alone would otherwise 400.
func (h *CommunityHandler) UpdateCopy(c *gin.Context) {
	var req communityCopyReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	uid, _ := getUID(c)
	if err := h.svc.UpdateCopy(c.Request.Context(), req.Copy, uid); err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "community.copy", "community", 0, req.Copy)
	h.AdminGet(c)
}

func (h *CommunityHandler) ListGrants(c *gin.Context) {
	gs, err := h.svc.ListGrants(c.Request.Context())
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gs)
}

func (h *CommunityHandler) SetGrants(c *gin.Context) {
	var req setGrantsReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	if err := h.svc.SetGrants(c.Request.Context(), req.Grants); err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "community.access", "community", 0, map[string]any{"grants": req.Grants})
	gs, err := h.svc.ListGrants(c.Request.Context())
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gs)
}
