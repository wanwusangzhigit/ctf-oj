package v1

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/api/middleware"
	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/response"
	"github.com/ctf-oj/backend/internal/service"
)

type AnnouncementHandler struct {
	svc *service.AnnouncementService
}

func NewAnnouncementHandler(s *service.AnnouncementService) *AnnouncementHandler {
	return &AnnouncementHandler{svc: s}
}

func (h *AnnouncementHandler) List(c *gin.Context) {
	page, pageSize := parsePaging(c)
	as, total, err := h.svc.List(c.Request.Context(), true, page, pageSize)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Paged(c, as, total, page, pageSize)
}

func (h *AnnouncementHandler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	a, err := h.svc.Get(c.Request.Context(), uint(id))
	if err != nil {
		response.Err(c, err)
		return
	}
	if !a.IsPublished && !middleware.IsAdmin(c) {
		response.Err(c, domain.ErrNotFound)
		return
	}
	response.OK(c, a)
}

func (h *AnnouncementHandler) Create(c *gin.Context) {
	var req service.AnnouncementInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	uid, _ := getUID(c)
	a, err := h.svc.Create(c.Request.Context(), req, uid)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Created(c, a)
}

func (h *AnnouncementHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	var req service.AnnouncementInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	a, err := h.svc.Update(c.Request.Context(), uint(id), req)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, a)
}

func (h *AnnouncementHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	if err := h.svc.Delete(c.Request.Context(), uint(id)); err != nil {
		response.Err(c, err)
		return
	}
	response.NoContent(c)
}
