package v1

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/api/middleware"
	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/response"
	"github.com/ctf-oj/backend/internal/service"
)

type UserHandler struct {
	svc    *service.UserService
	comp   *service.CompetitionService
	access *service.ChallengeAccessService
}

func NewUserHandler(s *service.UserService, comp *service.CompetitionService, access *service.ChallengeAccessService) *UserHandler {
	return &UserHandler{svc: s, comp: comp, access: access}
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
	enrichDelegations(c.Request.Context(), u, h.access)
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
	viewer, _ := getUID(c)
	followers, following, isFollowing, _ := h.svc.FollowStats(c.Request.Context(), uint(id), viewer)
	if viewer == uint(id) || middleware.IsAdmin(c) {
		response.OK(c, struct {
			*domain.User
			FollowerCount  int64 `json:"followerCount"`
			FollowingCount int64 `json:"followingCount"`
		}{User: u, FollowerCount: followers, FollowingCount: following})
		return
	}
	pub := u.Public()
	if u.ProfileVisibility == "private" {
		pub.Bio = ""
		response.OK(c, struct {
			domain.PublicUser
			PrivateProfile bool  `json:"privateProfile"`
			FollowerCount  int64 `json:"followerCount"`
			FollowingCount int64 `json:"followingCount"`
			IsFollowing    bool  `json:"isFollowing"`
		}{PublicUser: pub, PrivateProfile: true, FollowerCount: followers, FollowingCount: following, IsFollowing: isFollowing})
		return
	}
	response.OK(c, struct {
		domain.PublicUser
		FollowerCount  int64 `json:"followerCount"`
		FollowingCount int64 `json:"followingCount"`
		IsFollowing    bool  `json:"isFollowing"`
	}{PublicUser: pub, FollowerCount: followers, FollowingCount: following, IsFollowing: isFollowing})
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

// MySubmissions lists the authenticated user's flag submission history.
func (h *UserHandler) MySubmissions(c *gin.Context) {
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	page, pageSize := parsePaging(c)
	items, total, err := h.svc.Submissions(c.Request.Context(), uid, page, pageSize)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Paged(c, items, total, page, pageSize)
}

// UploadAvatar accepts multipart/form-data with a single "file" field.
// Successful response is the updated user object (without the storage key).
func (h *UserHandler) UploadAvatar(c *gin.Context) {
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	file, err := c.FormFile("file")
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	// Sanity guard: 5 MB limit.
	if file.Size > 5*1024*1024 {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	src, err := file.Open()
	if err != nil {
		response.Err(c, err)
		return
	}
	defer src.Close()
	u, err := h.svc.UploadAvatar(c.Request.Context(), uid, src, file.Filename)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, u)
}

// GetAvatar streams the user's avatar image. Public — no auth required —
// because avatars are visible to anyone viewing a profile or scoreboard.
func (h *UserHandler) GetAvatar(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	reader, size, err := h.svc.AvatarReader(c.Request.Context(), uint(id))
	if err != nil {
		response.Err(c, err)
		return
	}
	if reader == nil {
		c.Status(404)
		return
	}
	defer reader.Close()
	c.DataFromReader(200, size, "image/jpeg", reader, nil)
}

func (h *UserHandler) Scoreboard(c *gin.Context) {
	page, pageSize := parsePaging(c)
	var cutoff *time.Time
	if h.comp != nil {
		cutoff = h.comp.ScoreboardCutoff(c.Request.Context())
	}
	users, total, err := h.svc.Scoreboard(c.Request.Context(), page, pageSize, cutoff)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Paged(c, users, total, page, pageSize)
}

type changePasswordReq struct {
	CurrentPassword string `json:"currentPassword" binding:"required"`
	NewPassword     string `json:"newPassword" binding:"required"`
}

func (h *UserHandler) ChangePassword(c *gin.Context) {
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	var req changePasswordReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	if err := h.svc.ChangePassword(c.Request.Context(), uid, req.CurrentPassword, req.NewPassword); err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gin.H{"ok": true})
}

type updateProfileReq struct {
	Bio               string `json:"bio"`
	ProfileVisibility string `json:"profileVisibility"`
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
	if req.ProfileVisibility != "" {
		if req.ProfileVisibility != "public" && req.ProfileVisibility != "private" {
			response.Err(c, domain.ErrInvalidArgument)
			return
		}
		u.ProfileVisibility = req.ProfileVisibility
	}
	if err := h.svc.Update(c.Request.Context(), u); err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, u)
}

func (h *UserHandler) Setup2FA(c *gin.Context) {
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	secret, uri, err := h.svc.Setup2FA(c.Request.Context(), uid)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gin.H{"secret": secret, "otpauthUrl": uri})
}

func (h *UserHandler) Enable2FA(c *gin.Context) {
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	if err := h.svc.Enable2FA(c.Request.Context(), uid, req.Code); err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gin.H{"enabled": true})
}

func (h *UserHandler) Disable2FA(c *gin.Context) {
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	var req struct {
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	if err := h.svc.Disable2FA(c.Request.Context(), uid, req.Password); err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gin.H{"enabled": false})
}
