package v1

import (
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/api/middleware"
	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/response"
	"github.com/ctf-oj/backend/internal/service"
)

type ChallengeHandler struct {
	svc       *service.ChallengeService
	adminOnly bool
}

func NewChallengeHandler(s *service.ChallengeService) *ChallengeHandler {
	return &ChallengeHandler{svc: s}
}

func parsePaging(c *gin.Context) (int, int) {
	page, _ := strconv.Atoi(c.Query("page"))
	pageSize, _ := strconv.Atoi(c.Query("page_size"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 50
	}
	return page, pageSize
}

func (h *ChallengeHandler) List(c *gin.Context) {
	page, pageSize := parsePaging(c)
	filter := domain.ChallengeFilter{Page: page, PageSize: pageSize}
	if v := c.Query("category_id"); v != "" {
		if id, err := strconv.ParseUint(v, 10, 64); err == nil {
			filter.CategoryID = uint(id)
		}
	}
	uid, _ := getUID(c)
	isAdmin := middleware.IsAdmin(c)

	if isAdmin && strings.EqualFold(c.Query("scope"), "admin") {
		cs, total, err := h.svc.ListAll(c.Request.Context(), filter)
		if err != nil {
			response.Err(c, err)
			return
		}
		response.Paged(c, cs, total, page, pageSize)
		return
	}

	vs, total, err := h.svc.ListForUser(c.Request.Context(), filter, uid)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Paged(c, vs, total, page, pageSize)
}

func (h *ChallengeHandler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	uid, _ := getUID(c)
	v, err := h.svc.GetForUser(c.Request.Context(), uint(id), uid)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, v)
}

func (h *ChallengeHandler) Create(c *gin.Context) {
	var req service.ChallengeAdminInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	uid, _ := getUID(c)
	ch, err := h.svc.Create(c.Request.Context(), req, uid)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Created(c, ch)
}

func (h *ChallengeHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	var req service.ChallengeAdminInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	ch, err := h.svc.Update(c.Request.Context(), uint(id), req)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, ch)
}

func (h *ChallengeHandler) Delete(c *gin.Context) {
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

type submitReq struct {
	Flag string `json:"flag" binding:"required"`
}

func (h *ChallengeHandler) Submit(c *gin.Context) {
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
	var req submitReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	res, err := h.svc.SubmitFlag(c.Request.Context(), uid, uint(id), req.Flag, c.ClientIP())
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, res)
}
