package v1

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/response"
	"github.com/ctf-oj/backend/internal/service"
)

type UserHandler struct {
	svc *service.UserService
}

func NewUserHandler(s *service.UserService) *UserHandler {
	return &UserHandler{svc: s}
}

func (h *UserHandler) Me(c *gin.Context) {
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	u, err := h.svc.Get(c.Request.Context(), uid)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, u)
}

func (h *UserHandler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	u, err := h.svc.Get(c.Request.Context(), uint(id))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, u)
}

func (h *UserHandler) MySolves(c *gin.Context) {
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	ss, err := h.svc.MySolves(c.Request.Context(), uid)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, ss)
}

func (h *UserHandler) Scoreboard(c *gin.Context) {
	page, pageSize := parsePaging(c)
	users, total, err := h.svc.Scoreboard(c.Request.Context(), page, pageSize)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Paged(c, users, total, page, pageSize)
}

type updateProfileReq struct {
	Bio string `json:"bio"`
}

func (h *UserHandler) UpdateProfile(c *gin.Context) {
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	u, err := h.svc.Get(c.Request.Context(), uid)
	if err != nil {
		response.Err(c, err)
		return
	}
	var req updateProfileReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	if len(req.Bio) > 500 {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	u.Bio = req.Bio
	if err := h.svc.Update(c.Request.Context(), u); err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, u)
}
