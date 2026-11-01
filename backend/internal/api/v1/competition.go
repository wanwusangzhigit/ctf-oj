package v1

import (
	"encoding/csv"
	"errors"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/api/middleware"
	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/response"
	"github.com/ctf-oj/backend/internal/service"
)

type CompetitionHandler struct {
	svc   *service.CompetitionService
	audit *service.AuditService
}

func NewCompetitionHandler(svc *service.CompetitionService, audit *service.AuditService) *CompetitionHandler {
	return &CompetitionHandler{svc: svc, audit: audit}
}

func parseTimePtr(s string) *time.Time {
	s = trim(s)
	if s == "" {
		return nil
	}
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return nil
	}
	return &t
}

func trim(s string) string {
	for len(s) > 0 && (s[0] == ' ' || s[0] == '\n' || s[0] == '\t') {
		s = s[1:]
	}
	for len(s) > 0 && (s[len(s)-1] == ' ' || s[len(s)-1] == '\n' || s[len(s)-1] == '\t') {
		s = s[:len(s)-1]
	}
	return s
}

// PublicActive returns the active competition (without registration code) so
// the frontend can show a banner / freeze notice.
func (h *CompetitionHandler) PublicActive(c *gin.Context) {
	comp, err := h.svc.GetActive(c.Request.Context())
	if err != nil || comp == nil || comp.Visibility == "private" || comp.ArchivedAt != nil {
		response.OK(c, nil)
		return
	}
	response.OK(c, comp)
}

// adminCompetitionView exposes the registration code only on admin-scoped
// responses; the domain field is otherwise hidden from JSON.
type adminCompetitionView struct {
	*domain.Competition
	RegistrationCode string `json:"registrationCode"`
}

func toAdminCompetition(c *domain.Competition) adminCompetitionView {
	return adminCompetitionView{Competition: c, RegistrationCode: c.RegistrationCode}
}

func (h *CompetitionHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))
	uid, _ := getUID(c)
	adminScope := c.Query("scope") == "admin" && middleware.CanManageCompetitions(c)
	if c.Query("scope") == "admin" && !adminScope && uid > 0 {
		items, total, err := h.svc.ListManagedFor(c.Request.Context(), page, pageSize, uid)
		if err != nil {
			response.Err(c, err)
			return
		}
		views := make([]adminCompetitionView, 0, len(items))
		for _, item := range items {
			views = append(views, toAdminCompetition(item))
		}
		response.Paged(c, views, total, page, pageSize)
		return
	}
	items, total, err := h.svc.ListVisibleFor(c.Request.Context(), page, pageSize, uid, adminScope)
	if err != nil {
		response.Err(c, err)
		return
	}
	if adminScope {
		views := make([]adminCompetitionView, 0, len(items))
		for _, item := range items {
			views = append(views, toAdminCompetition(item))
		}
		response.Paged(c, views, total, page, pageSize)
		return
	}
	response.Paged(c, items, total, page, pageSize)
}

func (h *CompetitionHandler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	uid, _ := getUID(c)
	adminScope := c.Query("scope") == "admin"
	if adminScope && !middleware.CanManageCompetitions(c) {
		allowed, err := h.svc.CanManage(c.Request.Context(), uint(id), uid, false)
		if err != nil {
			response.Err(c, err)
			return
		}
		adminScope = allowed
	}
	if adminScope {
		comp, err := h.svc.GetAdminFor(c.Request.Context(), uint(id), uid, middleware.CanManageCompetitions(c))
		if err != nil {
			response.Err(c, err)
			return
		}
		response.OK(c, toAdminCompetition(comp))
		return
	}
	comp, err := h.svc.GetVisibleFor(c.Request.Context(), uint(id), uid, false)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, comp)
}

func (h *CompetitionHandler) Create(c *gin.Context) {
	var req service.CompetitionInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	comp, err := h.svc.Create(c.Request.Context(), req)
	if err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "competition.create", "competition", comp.ID, map[string]string{"name": comp.Name})
	response.Created(c, comp)
}

func (h *CompetitionHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	var req service.CompetitionInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	if middleware.Delegation(c) != "" {
		current, err := h.svc.Get(c.Request.Context(), uint(id))
		if err != nil {
			response.Err(c, err)
			return
		}
		req.IsActive = current.IsActive
		req.Archived = current.ArchivedAt != nil
		req.Visibility = current.Visibility
		req.AccessGrants = nil
	}
	comp, err := h.svc.Update(c.Request.Context(), uint(id), req)
	if err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "competition.update", "competition", comp.ID, map[string]string{"name": comp.Name})
	response.OK(c, comp)
}

func (h *CompetitionHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	if err := h.svc.Delete(c.Request.Context(), uint(id)); err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "competition.delete", "competition", uint(id), nil)
	response.OK(c, gin.H{"ok": true})
}

func (h *CompetitionHandler) canSeeLiveScoreboard(c *gin.Context, id, uid uint) bool {
	if middleware.CanManageCompetitions(c) {
		return true
	}
	if uid == 0 {
		return false
	}
	ok, err := h.svc.CanManage(c.Request.Context(), id, uid, false)
	return err == nil && ok
}

func (h *CompetitionHandler) Scoreboard(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	uid, _ := getUID(c)
	if _, err := h.svc.GetVisibleFor(c.Request.Context(), uint(id), uid, middleware.CanManageCompetitions(c)); err != nil {
		response.Err(c, err)
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))
	includeFrozen := h.canSeeLiveScoreboard(c, uint(id), uid)
	if c.Query("group") == "team" {
		items, total, err := h.svc.TeamScoreboard(c.Request.Context(), uint(id), page, pageSize, includeFrozen)
		if err != nil {
			response.Err(c, err)
			return
		}
		response.Paged(c, items, total, page, pageSize)
		return
	}
	items, total, err := h.svc.Scoreboard(c.Request.Context(), uint(id), page, pageSize, includeFrozen)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Paged(c, items, total, page, pageSize)
}

// Export streams the scoreboard as CSV. Admin/competition-admin only.
func (h *CompetitionHandler) Export(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	comp, err := h.svc.GetVisible(c.Request.Context(), uint(id), true)
	if err != nil {
		response.Err(c, err)
		return
	}
	group := c.Query("group")
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", `attachment; filename="`+comp.Slug+`-`+nonEmpty(group, "user")+`.csv"`)
	w := csv.NewWriter(c.Writer)
	defer w.Flush()
	_ = w.Write([]string{"rank", nonEmpty(group, "user"), "score"})

	const perPage = 100
	rank := 1
	for page := 1; ; page++ {
		if group == "team" {
			items, total, err := h.svc.TeamScoreboard(c.Request.Context(), uint(id), page, perPage, true)
			if err != nil {
				return
			}
			for _, t := range items {
				_ = w.Write([]string{strconv.Itoa(rank), t.Name, strconv.Itoa(t.Score)})
				rank++
			}
			if int64(rank-1) >= total || len(items) == 0 {
				break
			}
			continue
		}
		items, total, err := h.svc.Scoreboard(c.Request.Context(), uint(id), page, perPage, true)
		if err != nil {
			return
		}
		for _, u := range items {
			_ = w.Write([]string{strconv.Itoa(rank), u.Username, strconv.Itoa(u.Score)})
			rank++
		}
		if int64(rank-1) >= total || len(items) == 0 {
			break
		}
	}
}

func (h *CompetitionHandler) Register(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	uid, ok := getUID(c)
	if !ok || uid == 0 {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	var req struct {
		Code string `json:"code"`
	}
	_ = c.ShouldBindJSON(&req)
	reg, err := h.svc.Register(c.Request.Context(), uint(id), uid, req.Code)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Created(c, reg)
}

func (h *CompetitionHandler) Unregister(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	uid, ok := getUID(c)
	if !ok || uid == 0 {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	if err := h.svc.Unregister(c.Request.Context(), uint(id), uid); err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, gin.H{"ok": true})
}

func (h *CompetitionHandler) RegistrationStatus(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	uid, ok := getUID(c)
	if !ok || uid == 0 {
		response.Err(c, domain.ErrUnauthorized)
		return
	}
	reg, err := h.svc.Registration(c.Request.Context(), uint(id), uid)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			response.OK(c, gin.H{"registered": false})
			return
		}
		response.Err(c, err)
		return
	}
	response.OK(c, gin.H{"registered": true, "registration": reg})
}

func (h *CompetitionHandler) AdminListRegistrations(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))
	items, total, err := h.svc.ListRegistrations(c.Request.Context(), uint(id), page, pageSize)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Paged(c, items, total, page, pageSize)
}

func (h *CompetitionHandler) SetScoreExcluded(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	userID, err := strconv.ParseUint(c.Param("userId"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	var req struct {
		Excluded bool   `json:"excluded"`
		Reason   string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	actor, _ := getUID(c)
	reg, err := h.svc.SetScoreExcluded(c.Request.Context(), uint(id), uint(userID), req.Excluded, req.Reason, actor)
	if err != nil {
		response.Err(c, err)
		return
	}
	action := "competition.score_restore"
	if req.Excluded {
		action = "competition.score_exclude"
	}
	recordAudit(c, h.audit, action, "competition_registration", uint(userID), map[string]string{
		"competitionId": strconv.FormatUint(id, 10),
		"reason":        req.Reason,
	})
	response.OK(c, reg)
}

func (h *CompetitionHandler) ListAnnouncements(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	uid, _ := getUID(c)
	if _, err := h.svc.GetVisibleFor(c.Request.Context(), uint(id), uid, false); err != nil {
		response.Err(c, err)
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, total, err := h.svc.ListAnnouncements(c.Request.Context(), uint(id), true, page, pageSize)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Paged(c, items, total, page, pageSize)
}

func (h *CompetitionHandler) AdminListAnnouncements(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))
	items, total, err := h.svc.ListAnnouncements(c.Request.Context(), uint(id), false, page, pageSize)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.Paged(c, items, total, page, pageSize)
}

func (h *CompetitionHandler) CreateAnnouncement(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	var req service.CompetitionAnnouncementInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	actor, _ := getUID(c)
	a, err := h.svc.CreateAnnouncement(c.Request.Context(), uint(id), actor, req)
	if err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "competition.announcement.create", "competition_announcement", a.ID, map[string]string{
		"competitionId": strconv.FormatUint(id, 10),
		"title":         a.Title,
	})
	response.Created(c, a)
}

func (h *CompetitionHandler) UpdateAnnouncement(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	annID, err := strconv.ParseUint(c.Param("announcementId"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	var req service.CompetitionAnnouncementInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	a, err := h.svc.UpdateAnnouncement(c.Request.Context(), uint(id), uint(annID), req)
	if err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "competition.announcement.update", "competition_announcement", a.ID, map[string]string{
		"competitionId": strconv.FormatUint(id, 10),
		"title":         a.Title,
	})
	response.OK(c, a)
}

func (h *CompetitionHandler) DeleteAnnouncement(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	annID, err := strconv.ParseUint(c.Param("announcementId"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	if err := h.svc.DeleteAnnouncement(c.Request.Context(), uint(id), uint(annID)); err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "competition.announcement.delete", "competition_announcement", uint(annID), map[string]string{
		"competitionId": strconv.FormatUint(id, 10),
	})
	response.OK(c, gin.H{"ok": true})
}

func nonEmpty(v, fallback string) string {
	if v == "" {
		return fallback
	}
	return v
}
