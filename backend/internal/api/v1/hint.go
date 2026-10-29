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
 * HintHandler — public read & unlock + admin CRUD.
 */

type HintHandler struct {
	svc   *service.HintService
	audit *service.AuditService
}

func NewHintHandler(svc *service.HintService, audit *service.AuditService) *HintHandler {
	return &HintHandler{svc: svc, audit: audit}
}

// PublicList returns the hints for a challenge, masking content for hints
// the user hasn't unlocked yet.
func (h *HintHandler) PublicList(c *gin.Context) {
	cid, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	uid, _ := getUID(c)
	out, err := h.svc.PublicList(c.Request.Context(), uid, uint(cid), middleware.CanManageChallenges(c))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, out)
}

// Unlock records that the user has unlocked a hint. Idempotent.
func (h *HintHandler) Unlock(c *gin.Context) {
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	hintID, err := strconv.ParseUint(c.Param("hintId"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	if err := h.svc.Unlock(c.Request.Context(), uid, uint(hintID), middleware.CanManageChallenges(c)); err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gin.H{"ok": true})
}

// AdminList returns all hints for a challenge including full content.
func (h *HintHandler) AdminList(c *gin.Context) {
	cid, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	out, err := h.svc.AdminList(c.Request.Context(), uint(cid))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, out)
}

type adminHintReq struct {
	SortOrder int     `json:"sortOrder"`
	CostRatio float32 `json:"costRatio"`
	Content   string  `json:"content"`
}

func (h *HintHandler) AdminCreate(c *gin.Context) {
	cid, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	var req adminHintReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	hint := &domain.ChallengeHint{
		ChallengeID: uint(cid),
		SortOrder:   req.SortOrder,
		CostRatio:   req.CostRatio,
		Content:     req.Content,
	}
	out, err := h.svc.AdminCreate(c.Request.Context(), hint)
	if err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "hint.create", "hint", out.ID, map[string]string{
		"challengeId": strconv.FormatUint(cid, 10),
	})
	response.Created(c, out)
}

func (h *HintHandler) AdminUpdate(c *gin.Context) {
	hintID, err := strconv.ParseUint(c.Param("hintId"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	var req adminHintReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	hint := &domain.ChallengeHint{
		ID:        uint(hintID),
		SortOrder: req.SortOrder,
		CostRatio: req.CostRatio,
		Content:   req.Content,
	}
	out, err := h.svc.AdminUpdate(c.Request.Context(), hint)
	if err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "hint.update", "hint", out.ID, map[string]string{
		"challengeId": strconv.FormatUint(uint64(out.ChallengeID), 10),
	})
	response.OK(c, out)
}

func (h *HintHandler) AdminDelete(c *gin.Context) {
	hintID, err := strconv.ParseUint(c.Param("hintId"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	if err := h.svc.AdminDelete(c.Request.Context(), uint(hintID)); err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "hint.delete", "hint", uint(hintID), nil)
	response.OK(c, gin.H{"ok": true})
}
