package v1

import (
	"errors"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/api/middleware"
	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/response"
	"github.com/ctf-oj/backend/internal/service"
)

type DiscussionHandler struct {
	svc *service.DiscussionService
}

func NewDiscussionHandler(s *service.DiscussionService) *DiscussionHandler {
	return &DiscussionHandler{svc: s}
}

type discussionReq struct {
	ContentMD string `json:"contentMd" binding:"required"`
	ParentID  *uint  `json:"parentId"`
}

func (h *DiscussionHandler) List(c *gin.Context) {
	chalID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	page, pageSize := parsePaging(c)
	uid, _ := getUID(c)
	ds, total, err := h.svc.List(c.Request.Context(), uint(chalID), uid, page, pageSize)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Paged(c, ds, total, page, pageSize)
}

func (h *DiscussionHandler) Create(c *gin.Context) {
	chalID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	var req discussionReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	d, err := h.svc.Create(c.Request.Context(), uid, uint(chalID), service.DiscussionInput{
		ContentMD: req.ContentMD,
		ParentID:  req.ParentID,
	})
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Created(c, d)
}

func (h *DiscussionHandler) Delete(c *gin.Context) {
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
	if err := h.svc.Delete(c.Request.Context(), uid, uint(id), middleware.IsAdmin(c)); err != nil {
		response.Err(c, err)
		return
	}
	response.NoContent(c)
}

func (h *DiscussionHandler) ToggleLike(c *gin.Context) {
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
	liked, err := h.svc.ToggleLike(c.Request.Context(), uid, uint(id))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gin.H{"liked": liked})
}

var _ = errors.New
