package v1

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/api/middleware"
	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/response"
	"github.com/ctf-oj/backend/internal/service"
)

type WriteupHandler struct {
	svc *service.WriteupService
}

func NewWriteupHandler(s *service.WriteupService) *WriteupHandler {
	return &WriteupHandler{svc: s}
}

func (h *WriteupHandler) List(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	uid, _ := getUID(c)
	out, err := h.svc.List(c.Request.Context(), uint(id), uid, middleware.IsAdmin(c))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, out)
}

func (h *WriteupHandler) Create(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	var req service.WriteupInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	out, err := h.svc.Create(c.Request.Context(), uid, uint(id), req, middleware.IsAdmin(c))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Created(c, out)
}

func (h *WriteupHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	var req service.WriteupInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	out, err := h.svc.Update(c.Request.Context(), uint(id), uid, middleware.IsAdmin(c), req)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, out)
}

func (h *WriteupHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	if err := h.svc.Delete(c.Request.Context(), uint(id), uid, middleware.IsAdmin(c)); err != nil {
		response.Err(c, err)
		return
	}
	response.NoContent(c)
}

func (h *WriteupHandler) ListMine(c *gin.Context) {
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	out, err := h.svc.ListMine(c.Request.Context(), uid)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, out)
}
