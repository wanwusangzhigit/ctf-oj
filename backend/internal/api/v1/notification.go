package v1

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/response"
	"github.com/ctf-oj/backend/internal/service"
)

type NotificationHandler struct {
	svc *service.NotificationService
}

func NewNotificationHandler(s *service.NotificationService) *NotificationHandler {
	return &NotificationHandler{svc: s}
}

func (h *NotificationHandler) ListMine(c *gin.Context) {
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	page, pageSize := parsePaging(c)
	ns, total, err := h.svc.ListMine(c.Request.Context(), uid, page, pageSize)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Paged(c, ns, total, page, pageSize)
}

func (h *NotificationHandler) UnreadCount(c *gin.Context) {
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	n, err := h.svc.UnreadCount(c.Request.Context(), uid)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gin.H{"unread": n})
}

func (h *NotificationHandler) MarkRead(c *gin.Context) {
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	if err := h.svc.MarkRead(c.Request.Context(), uid, uint(id)); err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gin.H{"ok": true})
}

func (h *NotificationHandler) MarkAllRead(c *gin.Context) {
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	if err := h.svc.MarkAllRead(c.Request.Context(), uid); err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gin.H{"ok": true})
}
