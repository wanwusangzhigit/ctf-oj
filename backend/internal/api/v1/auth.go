package v1

import (
	"errors"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/crypto"
	"github.com/ctf-oj/backend/internal/pkg/response"
	"github.com/ctf-oj/backend/internal/service"
)

type AuthHandler struct {
	svc *service.AuthService
}

func NewAuthHandler(s *service.AuthService) *AuthHandler {
	return &AuthHandler{svc: s}
}

type registerReq struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type loginReq struct {
	Account  string `json:"account" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type refreshReq struct {
	RefreshToken string `json:"refreshToken" binding:"required"`
}

type authResp struct {
	User      *domain.User     `json:"user"`
	TokenPair *service.TokenPair `json:"tokens"`
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req registerReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	u, err := h.svc.Register(c.Request.Context(), service.RegisterInput(req))
	if err != nil {
		response.Err(c, mapAuthErr(err))
		return
	}
	pair, err := h.svc.JWT().Issue(u.ID, u.Username, string(u.Role))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Created(c, authResp{User: u, TokenPair: pair})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req loginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	u, pair, err := h.svc.Login(c.Request.Context(), service.LoginInput(req))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, authResp{User: u, TokenPair: pair})
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var req refreshReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	pair, err := h.svc.Refresh(c.Request.Context(), strings.TrimSpace(req.RefreshToken))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gin.H{"tokens": pair})
}

func (h *AuthHandler) Me(c *gin.Context) {
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	u, err := h.svc.Users().FindByID(c.Request.Context(), uid)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, u)
}

func mapAuthErr(err error) error {
	switch {
	case errors.Is(err, crypto.ErrInvalidUsername),
		errors.Is(err, crypto.ErrInvalidEmail),
		errors.Is(err, crypto.ErrWeakPassword):
		return domain.ErrInvalidArgument
	}
	return err
}
