package v1

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/response"
	"github.com/ctf-oj/backend/internal/service"
)

type FollowHandler struct{ svc *service.UserService }

func NewFollowHandler(s *service.UserService) *FollowHandler { return &FollowHandler{svc: s} }

func targetID(c *gin.Context) (uint, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		response.Err(c, domain.ErrInvalidArgument)
		return 0, false
	}
	return uint(id), true
}

func (h *FollowHandler) Follow(c *gin.Context) {
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	id, ok := targetID(c)
	if !ok {
		return
	}
	if err := h.svc.Follow(c.Request.Context(), uid, id); err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gin.H{"following": true})
}

func (h *FollowHandler) Unfollow(c *gin.Context) {
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	id, ok := targetID(c)
	if !ok {
		return
	}
	if err := h.svc.Unfollow(c.Request.Context(), uid, id); err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gin.H{"following": false})
}

func (h *FollowHandler) Followers(c *gin.Context) {
	id, ok := targetID(c)
	if !ok {
		return
	}
	page, pageSize := parsePaging(c)
	items, total, err := h.svc.Followers(c.Request.Context(), id, page, pageSize)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Paged(c, items, total, page, pageSize)
}

func (h *FollowHandler) Following(c *gin.Context) {
	id, ok := targetID(c)
	if !ok {
		return
	}
	page, pageSize := parsePaging(c)
	items, total, err := h.svc.Following(c.Request.Context(), id, page, pageSize)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Paged(c, items, total, page, pageSize)
}

func (h *FollowHandler) Feed(c *gin.Context) {
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	limit := 30
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}
	items, err := h.svc.Feed(c.Request.Context(), uid, limit)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, items)
}
