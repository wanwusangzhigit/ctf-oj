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

type TeamHandler struct {
	svc  *service.TeamService
	comp *service.CompetitionService
}

func NewTeamHandler(svc *service.TeamService, comp *service.CompetitionService) *TeamHandler {
	return &TeamHandler{svc: svc, comp: comp}
}

type teamMemberView struct {
	ID       uint               `json:"id"`
	TeamID   uint               `json:"teamId"`
	UserID   uint               `json:"userId"`
	JoinedAt time.Time          `json:"joinedAt"`
	User     *domain.PublicUser `json:"user,omitempty"`
}

type teamView struct {
	ID          uint               `json:"id"`
	Name        string             `json:"name"`
	Slug        string             `json:"slug"`
	Description string             `json:"description"`
	OwnerID     uint               `json:"ownerId"`
	InviteCode  string             `json:"inviteCode,omitempty"`
	Score       int                `json:"score"`
	CreatedAt   time.Time          `json:"createdAt"`
	UpdatedAt   time.Time          `json:"updatedAt"`
	Owner       *domain.PublicUser `json:"owner,omitempty"`
	Members     []teamMemberView   `json:"members,omitempty"`
}

// toTeamView projects a team without leaking member emails or the invite code
// to anyone who is not the owner (or an admin).
func toTeamView(t *domain.Team, viewerID uint, isAdmin bool) teamView {
	v := teamView{
		ID:          t.ID,
		Name:        t.Name,
		Slug:        t.Slug,
		Description: t.Description,
		OwnerID:     t.OwnerID,
		Score:       t.Score,
		CreatedAt:   t.CreatedAt,
		UpdatedAt:   t.UpdatedAt,
	}
	if isAdmin || viewerID == t.OwnerID {
		v.InviteCode = t.InviteCode
	}
	if t.Owner != nil {
		pu := t.Owner.Public()
		v.Owner = &pu
	}
	if len(t.Members) > 0 {
		v.Members = make([]teamMemberView, 0, len(t.Members))
		for _, m := range t.Members {
			mv := teamMemberView{ID: m.ID, TeamID: m.TeamID, UserID: m.UserID, JoinedAt: m.JoinedAt}
			if m.User != nil {
				pu := m.User.Public()
				mv.User = &pu
			}
			v.Members = append(v.Members, mv)
		}
	}
	return v
}

func toTeamViews(ts []*domain.Team, viewerID uint, isAdmin bool) []teamView {
	out := make([]teamView, 0, len(ts))
	for _, t := range ts {
		out = append(out, toTeamView(t, viewerID, isAdmin))
	}
	return out
}

type createTeamReq struct {
	Name        string `json:"name" binding:"required"`
	Slug        string `json:"slug" binding:"required"`
	Description string `json:"description"`
}

func (h *TeamHandler) List(c *gin.Context) {
	page, pageSize := parsePaging(c)
	ts, total, err := h.svc.List(c.Request.Context(), page, pageSize)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Paged(c, toTeamViews(ts, 0, false), total, page, pageSize)
}

func (h *TeamHandler) Scoreboard(c *gin.Context) {
	page, pageSize := parsePaging(c)
	var cutoff *time.Time
	if h.comp != nil {
		cutoff = h.comp.ScoreboardCutoff(c.Request.Context())
	}
	ts, total, err := h.svc.Scoreboard(c.Request.Context(), page, pageSize, cutoff)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Paged(c, toTeamViews(ts, 0, false), total, page, pageSize)
}

func (h *TeamHandler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	t, err := h.svc.Get(c.Request.Context(), uint(id))
	if err != nil {
		response.Err(c, err)
		return
	}
	uid, _ := getUID(c)
	response.OK(c, toTeamView(t, uid, middleware.IsAdmin(c)))
}

func (h *TeamHandler) Create(c *gin.Context) {
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	var req createTeamReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	t, err := h.svc.Create(c.Request.Context(), uid, service.TeamInput(req))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Created(c, toTeamView(t, uid, middleware.IsAdmin(c)))
}

type joinByCodeReq struct {
	InviteCode string `json:"inviteCode" binding:"required"`
}

func (h *TeamHandler) JoinByCode(c *gin.Context) {
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	var req joinByCodeReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	t, err := h.svc.JoinByInviteCode(c.Request.Context(), uid, req.InviteCode)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, toTeamView(t, uid, middleware.IsAdmin(c)))
}

func (h *TeamHandler) Leave(c *gin.Context) {
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	if err := h.svc.Leave(c.Request.Context(), uid); err != nil {
		response.Err(c, err)
		return
	}
	response.NoContent(c)
}

func (h *TeamHandler) MyMembership(c *gin.Context) {
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	t, err := h.svc.MyMembership(c.Request.Context(), uid)
	if err != nil {
		response.OK(c, nil)
		return
	}
	response.OK(c, toTeamView(t, uid, middleware.IsAdmin(c)))
}

func (h *TeamHandler) Disband(c *gin.Context) {
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
	if err := h.svc.Disband(c.Request.Context(), uid, uint(id)); err != nil {
		response.Err(c, err)
		return
	}
	response.NoContent(c)
}

type transferOwnerReq struct {
	NewOwnerID uint `json:"newOwnerId" binding:"required"`
}

func (h *TeamHandler) TransferOwner(c *gin.Context) {
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
	var req transferOwnerReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	t, err := h.svc.TransferOwner(c.Request.Context(), uid, uint(id), req.NewOwnerID)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, toTeamView(t, uid, middleware.IsAdmin(c)))
}

type removeMemberReq struct {
	UserID uint `json:"userId" binding:"required"`
}

func (h *TeamHandler) RemoveMember(c *gin.Context) {
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
	var req removeMemberReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	if err := h.svc.RemoveMember(c.Request.Context(), uid, uint(id), req.UserID); err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gin.H{"ok": true})
}

// RotateInvite regenerates the invite code. Owner only.
func (h *TeamHandler) RotateInvite(c *gin.Context) {
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
	t, err := h.svc.RotateInviteCode(c.Request.Context(), uid, uint(id))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gin.H{"inviteCode": t.InviteCode})
}
