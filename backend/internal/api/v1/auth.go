package v1

import (
	"errors"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/api/authcookie"
	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/crypto"
	"github.com/ctf-oj/backend/internal/pkg/response"
	"github.com/ctf-oj/backend/internal/service"
)

type AuthHandler struct {
	svc    *service.AuthService
	access *service.ChallengeAccessService
}

func NewAuthHandler(s *service.AuthService, access *service.ChallengeAccessService) *AuthHandler {
	return &AuthHandler{svc: s, access: access}
}

type registerReq struct {
	Username         string `json:"username" binding:"required"`
	Email            string `json:"email" binding:"required"`
	Password         string `json:"password" binding:"required"`
	RegistrationCode string `json:"registrationCode"`
}

type loginReq struct {
	Account  string `json:"account" binding:"required"`
	Password string `json:"password" binding:"required"`
	TOTPCode string `json:"totpCode"`
}

type refreshReq struct {
	RefreshToken string `json:"refreshToken"`
}

type authResp struct {
	User *domain.User `json:"user"`
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req registerReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	u, err := h.svc.Register(c.Request.Context(), service.RegisterInput{
		Username:         req.Username,
		Email:            req.Email,
		Password:         req.Password,
		RegistrationCode: req.RegistrationCode,
	})
	if err != nil {
		response.Err(c, mapAuthErr(err))
		return
	}
	pair, err := h.svc.JWT().Issue(u.ID, u.Username, string(u.Role))
	if err != nil {
		response.Err(c, err)
		return
	}
	authcookie.Set(c, pair.AccessToken, pair.RefreshToken, time.Unix(pair.ExpiresAt, 0), time.Unix(pair.RefreshExpiresAt, 0))
	response.Created(c, authResp{User: u})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req loginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	u, pair, err := h.svc.Login(c.Request.Context(), service.LoginInput{
		Account:  req.Account,
		Password: req.Password,
		TOTPCode: req.TOTPCode,
	})
	if err != nil {
		response.Err(c, err)
		return
	}
	enrichDelegations(c.Request.Context(), u, h.access)
	authcookie.Set(c, pair.AccessToken, pair.RefreshToken, time.Unix(pair.ExpiresAt, 0), time.Unix(pair.RefreshExpiresAt, 0))
	response.OK(c, authResp{User: u})
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var req refreshReq
	_ = c.ShouldBindJSON(&req)
	token := strings.TrimSpace(req.RefreshToken)
	if token == "" {
		token = authcookie.RefreshToken(c)
	}
	if token == "" {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	pair, err := h.svc.Refresh(c.Request.Context(), token)
	if err != nil {
		authcookie.Clear(c)
		response.Err(c, err)
		return
	}
	authcookie.Set(c, pair.AccessToken, pair.RefreshToken, time.Unix(pair.ExpiresAt, 0), time.Unix(pair.RefreshExpiresAt, 0))
	response.OK(c, gin.H{"ok": true})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	authcookie.Clear(c)
	response.OK(c, gin.H{"ok": true})
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
	u.TwoFactorEnabled = u.TOTPEnabledAt != nil
	u.Permissions = domain.PermissionStrings(u.Role)
	u.HasAvatar = u.AvatarStorageKey != ""
	enrichDelegations(c.Request.Context(), u, h.access)
	response.OK(c, u)
}

// ----- Email verification -----

type verifyEmailReq struct {
	Token string `form:"token" json:"token" binding:"required"`
}

// VerifyEmail accepts token via query (?token=...) or JSON body so the same
// endpoint works for both email-link clicks (GET with query) and SPA forms.
func (h *AuthHandler) VerifyEmail(c *gin.Context) {
	token := strings.TrimSpace(c.Query("token"))
	if token == "" {
		var req verifyEmailReq
		if err := c.ShouldBindJSON(&req); err == nil {
			token = strings.TrimSpace(req.Token)
		}
	}
	if token == "" {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	if err := h.svc.VerifyEmail(c.Request.Context(), token); err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gin.H{"ok": true})
}

// ResendVerification requires the caller to be authenticated.
func (h *AuthHandler) ResendVerification(c *gin.Context) {
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
	if u.EmailVerifiedAt != nil {
		response.Err(c, errors.New("email already verified"))
		return
	}
	if err := h.svc.SendVerificationEmail(c.Request.Context(), u); err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gin.H{"ok": true})
}

// ----- Password reset -----

type forgotReq struct {
	Account string `json:"account" binding:"required"`
}

type resetReq struct {
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"newPassword" binding:"required"`
}

func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req forgotReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	// Always returns 200 to avoid leaking which accounts exist.
	_ = h.svc.RequestPasswordReset(c.Request.Context(), req.Account)
	response.OK(c, gin.H{"ok": true})
}

func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req resetReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	if err := h.svc.ResetPassword(c.Request.Context(), req.Token, req.NewPassword); err != nil {
		response.Err(c, mapAuthErr(err))
		return
	}
	response.OK(c, gin.H{"ok": true})
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
