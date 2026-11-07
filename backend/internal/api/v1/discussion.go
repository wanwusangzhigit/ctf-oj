package v1

import (
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
	Title     string `json:"title"`
	ContentMD string `json:"contentMd" binding:"required"`
	ParentID  *uint  `json:"parentId"`
	SectionID *uint  `json:"sectionId"`
}

func discussionGlobalModerate(c *gin.Context, scope domain.DiscussionScope) bool {
	switch scope {
	case domain.DiscussionScopeChallenge:
		return middleware.IsAdmin(c)
	case domain.DiscussionScopeCommunity, domain.DiscussionScopeCompetition:
		return middleware.HasPermission(c, domain.PermDiscussionModerate)
	default:
		return false
	}
}

func challengeTarget(c *gin.Context) (service.DiscussionTarget, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return service.DiscussionTarget{}, false
	}
	competitionID, _ := strconv.ParseUint(c.Query("competition_id"), 10, 64)
	return service.DiscussionTarget{Scope: domain.DiscussionScopeChallenge, ID: uint(id), CompetitionID: uint(competitionID)}, true
}

func competitionTarget(c *gin.Context) (service.DiscussionTarget, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return service.DiscussionTarget{}, false
	}
	return service.DiscussionTarget{Scope: domain.DiscussionScopeCompetition, ID: uint(id)}, true
}

func teamTarget(c *gin.Context) (service.DiscussionTarget, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return service.DiscussionTarget{}, false
	}
	return service.DiscussionTarget{Scope: domain.DiscussionScopeTeam, ID: uint(id)}, true
}

func (h *DiscussionHandler) list(c *gin.Context, target service.DiscussionTarget) {
	page, pageSize := parsePaging(c)
	uid, _ := getUID(c)
	includeUnpublished := target.Scope == domain.DiscussionScopeChallenge && middleware.IsAdmin(c)
	opts := domain.DiscussionListOptions{
		Page:           page,
		PageSize:       pageSize,
		Sort:           c.Query("sort"),
		Tag:            c.Query("tag"),
		Query:          c.Query("q"),
		IncludeReplies: target.Scope != domain.DiscussionScopeCommunity,
	}
	ds, total, err := h.svc.List(c.Request.Context(), target, uid, opts, includeUnpublished, discussionGlobalModerate(c, target.Scope))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Paged(c, ds, total, page, pageSize)
}

func (h *DiscussionHandler) List(c *gin.Context) {
	target, ok := challengeTarget(c)
	if !ok {
		return
	}
	h.list(c, target)
}

func (h *DiscussionHandler) CommunityList(c *gin.Context) {
	target := service.DiscussionTarget{Scope: domain.DiscussionScopeCommunity}
	// ?section= narrows the list to one board. An unparsable value is ignored
	// rather than rejected, the way competition_id is: these ids come straight
	// out of a URL a person may have edited.
	if id, err := strconv.ParseUint(c.Query("section"), 10, 64); err == nil && id > 0 {
		target.ID = uint(id)
	}
	h.list(c, target)
}

func (h *DiscussionHandler) CommunityGet(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	uid, _ := getUID(c)
	d, err := h.svc.Get(
		c.Request.Context(),
		service.DiscussionTarget{Scope: domain.DiscussionScopeCommunity},
		uint(id),
		uid,
		false,
		discussionGlobalModerate(c, domain.DiscussionScopeCommunity),
	)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, d)
}

func (h *DiscussionHandler) CompetitionList(c *gin.Context) {
	target, ok := competitionTarget(c)
	if !ok {
		return
	}
	h.list(c, target)
}

func (h *DiscussionHandler) TeamList(c *gin.Context) {
	target, ok := teamTarget(c)
	if !ok {
		return
	}
	h.list(c, target)
}

func (h *DiscussionHandler) create(c *gin.Context, target service.DiscussionTarget) {
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
	includeUnpublished := target.Scope == domain.DiscussionScopeChallenge && middleware.IsAdmin(c)
	if target.Scope == domain.DiscussionScopeCommunity && req.SectionID != nil {
		target.ID = *req.SectionID
	}
	d, err := h.svc.Create(c.Request.Context(), uid, target, service.DiscussionInput{
		Title:     req.Title,
		ContentMD: req.ContentMD,
		ParentID:  req.ParentID,
	}, includeUnpublished, discussionGlobalModerate(c, target.Scope))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Created(c, d)
}

func (h *DiscussionHandler) Create(c *gin.Context) {
	target, ok := challengeTarget(c)
	if !ok {
		return
	}
	h.create(c, target)
}

func (h *DiscussionHandler) CommunityCreate(c *gin.Context) {
	h.create(c, service.DiscussionTarget{Scope: domain.DiscussionScopeCommunity})
}

func (h *DiscussionHandler) CompetitionCreate(c *gin.Context) {
	target, ok := competitionTarget(c)
	if !ok {
		return
	}
	h.create(c, target)
}

func (h *DiscussionHandler) TeamCreate(c *gin.Context) {
	target, ok := teamTarget(c)
	if !ok {
		return
	}
	h.create(c, target)
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
	if err := h.svc.Delete(c.Request.Context(), uid, uint(id), middleware.HasPermission(c, domain.PermDiscussionModerate)); err != nil {
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
	liked, err := h.svc.ToggleLike(c.Request.Context(), uid, uint(id), middleware.HasPermission(c, domain.PermDiscussionModerate))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gin.H{"liked": liked})
}

func (h *DiscussionHandler) moderate(c *gin.Context, param string, globalModerate bool) {
	id, err := strconv.ParseUint(c.Param(param), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	var req service.ModerationInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	d, err := h.svc.Moderate(c.Request.Context(), uid, uint(id), req, globalModerate)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, d)
}

func (h *DiscussionHandler) Moderate(c *gin.Context) {
	h.moderate(c, "id", middleware.HasPermission(c, domain.PermDiscussionModerate))
}

func (h *DiscussionHandler) CommunityModerate(c *gin.Context) {
	h.moderate(c, "id", middleware.HasPermission(c, domain.PermDiscussionModerate))
}

func (h *DiscussionHandler) TeamModerate(c *gin.Context) {
	h.moderate(c, "discussionId", false)
}

func (h *DiscussionHandler) CompetitionModerate(c *gin.Context) {
	h.moderate(c, "discussionId", middleware.HasPermission(c, domain.PermDiscussionModerate))
}

// topicCaller resolves the scope-agnostic :id param and the caller for the
// content and revision routes, which any scope's topic can be edited through.
func topicCaller(c *gin.Context) (uint, uint, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return 0, 0, false
	}
	uid, ok := getUID(c)
	if !ok {
		response.Err(c, domain.ErrUnauthorized)
		return 0, 0, false
	}
	return uint(id), uid, true
}

// GetContent reads a topic for the edit form. It is separate from the scoped GET
// routes because those increment the view counter, and every save would inflate it.
func (h *DiscussionHandler) GetContent(c *gin.Context) {
	id, uid, ok := topicCaller(c)
	if !ok {
		return
	}
	d, err := h.svc.GetTopicForEdit(c.Request.Context(), id, uid, middleware.HasPermission(c, domain.PermDiscussionModerate))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, d)
}

func (h *DiscussionHandler) UpdateContent(c *gin.Context) {
	id, uid, ok := topicCaller(c)
	if !ok {
		return
	}
	var in service.DiscussionEditInput
	if err := c.ShouldBindJSON(&in); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	d, err := h.svc.UpdateTopic(c.Request.Context(), id, uid, in, middleware.HasPermission(c, domain.PermDiscussionModerate))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, d)
}

func (h *DiscussionHandler) Revisions(c *gin.Context) {
	id, uid, ok := topicCaller(c)
	if !ok {
		return
	}
	page, pageSize := parsePaging(c)
	revs, total, err := h.svc.ListRevisions(c.Request.Context(), id, uid, page, pageSize, middleware.HasPermission(c, domain.PermDiscussionModerate))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Paged(c, revs, total, page, pageSize)
}
