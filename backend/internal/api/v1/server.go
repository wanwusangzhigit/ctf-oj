package v1

import (
	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/pkg/response"
	"github.com/ctf-oj/backend/internal/service"
)

type ServerHandler struct {
	svc   *service.ServerService
	audit *service.AuditService
}

func NewServerHandler(svc *service.ServerService, audit *service.AuditService) *ServerHandler {
	return &ServerHandler{svc: svc, audit: audit}
}

func (h *ServerHandler) Overview(c *gin.Context) {
	response.OK(c, h.svc.Overview(c.Request.Context()))
}

func (h *ServerHandler) Prune(c *gin.Context) {
	out, err := h.svc.PruneContainers(c.Request.Context())
	if err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "server.prune", "server", 0, map[string]string{"output": out})
	response.OK(c, gin.H{"output": out})
}
