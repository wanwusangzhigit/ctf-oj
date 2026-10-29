package v1

import (
	"fmt"
	"net/http"
	"path"
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
	audit     *service.AuditService
	adminOnly bool
}

func NewChallengeHandler(s *service.ChallengeService, audit *service.AuditService) *ChallengeHandler {
	return &ChallengeHandler{svc: s, audit: audit}
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
	filter.Query = c.Query("q")
	filter.Status = c.Query("status")
	if v := c.Query("difficulty"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			filter.Difficulty = n
		}
	}
	switch c.Query("type") {
	case "static":
		f := false
		filter.IsDynamic = &f
	case "container":
		t := true
		filter.IsDynamic = &t
	}
	if v := c.Query("solved"); v != "" {
		b := v == "true" || v == "1"
		filter.Solved = &b
	}
	if v := c.Query("competition_id"); v != "" {
		if id, err := strconv.ParseUint(v, 10, 64); err == nil {
			filter.CompetitionID = uint(id)
		}
	}
	uid, _ := getUID(c)
	isAdmin := middleware.CanManageChallenges(c)

	if strings.EqualFold(c.Query("scope"), "admin") {
		if isAdmin {
			cs, total, err := h.svc.ListAll(c.Request.Context(), filter)
			if err != nil {
				response.Err(c, err)
				return
			}
			response.Paged(c, cs, total, page, pageSize)
			return
		}
		if uid > 0 {
			cs, total, err := h.svc.ListManagedFor(c.Request.Context(), filter, uid)
			if err != nil {
				response.Err(c, err)
				return
			}
			response.Paged(c, cs, total, page, pageSize)
			return
		}
	}

	filter.SolvedBy = uid
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
	if strings.EqualFold(c.Query("scope"), "admin") {
		adminScope := middleware.CanManageChallenges(c)
		if !adminScope && uid > 0 {
			adminScope, err = h.svc.CanManage(c.Request.Context(), uint(id), uid)
			if err != nil {
				response.Err(c, err)
				return
			}
		}
		if adminScope {
			v, err := h.svc.GetForAdmin(c.Request.Context(), uint(id))
			if err != nil {
				response.Err(c, err)
				return
			}
			response.OK(c, v)
			return
		}
	}
	competitionID, _ := strconv.ParseUint(c.Query("competition_id"), 10, 64)
	v, err := h.svc.GetForUser(c.Request.Context(), uint(id), uid, middleware.CanManageChallenges(c), uint(competitionID))
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
	recordAudit(c, h.audit, "challenge.create", "challenge", ch.ID, map[string]string{
		"title": ch.Title, "status": string(ch.Status),
	})
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
	if middleware.Delegation(c) != "" {
		current, err := h.svc.GetForAdmin(c.Request.Context(), uint(id))
		if err != nil {
			response.Err(c, err)
			return
		}
		req.AccessGrants = nil
		req.Status = string(current.Status)
		req.IsPublished = current.IsPublished
	}
	ch, err := h.svc.Update(c.Request.Context(), uint(id), req)
	if err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "challenge.update", "challenge", ch.ID, map[string]string{
		"title": ch.Title, "status": string(ch.Status),
	})
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
	_ = h.svc.PurgeSources(uint(id))
	recordAudit(c, h.audit, "challenge.delete", "challenge", uint(id), nil)
	response.NoContent(c)
}

// ----- Challenge source files (dockerfile / compose) -----

func (h *ChallengeHandler) ListSources(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	entries, err := h.svc.ListSources(c.Request.Context(), uint(id))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, entries)
}

func (h *ChallengeHandler) UploadSource(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	relPath := strings.TrimSpace(c.PostForm("path"))
	if relPath == "" {
		// fallback to filename when path field is absent
		relPath = c.Request.FormValue("filename")
	}
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	defer file.Close()
	if err := h.svc.UploadSource(c.Request.Context(), uint(id), relPath, file); err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "challenge.source_upload", "challenge", uint(id), map[string]string{"path": relPath})
	entries, _ := h.svc.ListSources(c.Request.Context(), uint(id))
	response.OK(c, entries)
}

func (h *ChallengeHandler) DownloadSource(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	relPath := strings.TrimSpace(c.Param("path"))
	if relPath == "" {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	r, size, err := h.svc.OpenSource(c.Request.Context(), uint(id), relPath)
	if err != nil {
		response.Err(c, err)
		return
	}
	defer r.Close()
	c.DataFromReader(http.StatusOK, size, "application/octet-stream", r, map[string]string{
		"Content-Disposition": fmt.Sprintf(`attachment; filename="%s"`, pathBase(relPath)),
	})
}

func (h *ChallengeHandler) DeleteSource(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	relPath := strings.TrimSpace(c.Param("path"))
	if relPath == "" {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	if err := h.svc.DeleteSource(c.Request.Context(), uint(id), relPath); err != nil {
		response.Err(c, err)
		return
	}
	recordAudit(c, h.audit, "challenge.source_delete", "challenge", uint(id), map[string]string{"path": relPath})
	entries, _ := h.svc.ListSources(c.Request.Context(), uint(id))
	response.OK(c, entries)
}

type submitReq struct {
	Flag          string `json:"flag" binding:"required"`
	CompetitionID uint   `json:"competitionId"`
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
	res, err := h.svc.SubmitFlag(c.Request.Context(), uid, uint(id), req.Flag, c.ClientIP(), req.CompetitionID, middleware.CanManageChallenges(c))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, res)
}

func pathBase(p string) string {
	return path.Base(p)
}
