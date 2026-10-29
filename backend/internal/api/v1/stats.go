package v1

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/api/middleware"
	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/response"
	"github.com/ctf-oj/backend/internal/service"
)

type StatsHandler struct {
	svc *service.StatsService
}

func NewStatsHandler(s *service.StatsService) *StatsHandler {
	return &StatsHandler{svc: s}
}

func (h *StatsHandler) Overview(c *gin.Context) {
	o, err := h.svc.Overview(c.Request.Context())
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, o)
}

func (h *StatsHandler) ByCategory(c *gin.Context) {
	out, err := h.svc.ByCategory(c.Request.Context())
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, out)
}

func (h *StatsHandler) SolveTrend(c *gin.Context) {
	days := 30
	if v := c.Query("days"); v != "" {
		if n, err := parseInt(v); err == nil && n > 0 {
			days = n
		}
	}
	out, err := h.svc.SolveTrend(c.Request.Context(), days)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, out)
}

func (h *StatsHandler) RecentSolves(c *gin.Context) {
	limit := 20
	if v := c.Query("limit"); v != "" {
		if n, err := parseInt(v); err == nil && n > 0 {
			limit = n
		}
	}
	out, err := h.svc.RecentSolves(c.Request.Context(), limit)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, out)
}

func parseInt(s string) (int, error) {
	var n int
	for _, ch := range s {
		if ch < '0' || ch > '9' {
			return 0, errInvalidInt
		}
		n = n*10 + int(ch-'0')
		if n > 1_000_000 {
			return 0, errInvalidInt
		}
	}
	if s == "" {
		return 0, errInvalidInt
	}
	return n, nil
}

var errInvalidInt = &strconvErr{}

type strconvErr struct{}

func (*strconvErr) Error() string { return "invalid int" }

func (h *StatsHandler) SubmissionTrend(c *gin.Context) {
	days := 30
	if v := c.Query("days"); v != "" {
		if n, err := parseInt(v); err == nil && n > 0 {
			days = n
		}
	}
	out, err := h.svc.SubmissionTrend(c.Request.Context(), days)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, out)
}

func (h *StatsHandler) Podium(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	out, err := h.svc.Podium(c.Request.Context(), uint(id))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, out)
}

func (h *StatsHandler) FirstBloods(c *gin.Context) {
	limit := 20
	if v := c.Query("limit"); v != "" {
		if n, err := parseInt(v); err == nil && n > 0 {
			limit = n
		}
	}
	out, err := h.svc.FirstBloods(c.Request.Context(), limit)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, out)
}

func (h *StatsHandler) UserActivity(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	viewer, _ := getUID(c)
	if viewer != uint(id) && !middleware.IsAdmin(c) {
		private, err := h.svc.IsProfilePrivate(c.Request.Context(), uint(id))
		if err != nil {
			response.Err(c, err)
			return
		}
		if private {
			response.OK(c, []*service.ActivityDay{})
			return
		}
	}
	days := 365
	if v := c.Query("days"); v != "" {
		if n, err := parseInt(v); err == nil && n > 0 {
			days = n
		}
	}
	out, err := h.svc.UserActivity(c.Request.Context(), uint(id), days)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, out)
}

func (h *StatsHandler) UserAchievements(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Err(c, domain.ErrInvalidArgument)
		return
	}
	viewer, _ := getUID(c)
	if viewer != uint(id) && !middleware.IsAdmin(c) {
		private, err := h.svc.IsProfilePrivate(c.Request.Context(), uint(id))
		if err != nil {
			response.Err(c, err)
			return
		}
		if private {
			response.OK(c, []*service.Achievement{})
			return
		}
	}
	out, err := h.svc.UserAchievements(c.Request.Context(), uint(id))
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, out)
}
