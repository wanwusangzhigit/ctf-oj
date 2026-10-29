package v1

import (
	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/response"
	"github.com/ctf-oj/backend/internal/service"
)

type BroadcastHandler struct {
	svc   *service.BroadcastService
	audit *service.AuditService
}

func NewBroadcastHandler(s *service.BroadcastService, audit *service.AuditService) *BroadcastHandler {
	return &BroadcastHandler{svc: s, audit: audit}
}

func (h *BroadcastHandler) Send(c *gin.Context) {
	var req struct {
		Subject string `json:"subject" binding:"required"`
		Body    string `json:"body" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	res, err := h.svc.Send(c.Request.Context(), req.Subject, req.Body)
	if err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "broadcast.send", "broadcast", 0, map[string]any{
		"subject": req.Subject, "result": res,
	})
	response.OK(c, res)
}
