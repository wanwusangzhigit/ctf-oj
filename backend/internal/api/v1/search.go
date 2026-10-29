package v1

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/pkg/response"
	"github.com/ctf-oj/backend/internal/service"
)

type SearchHandler struct{ svc *service.SearchService }

func NewSearchHandler(s *service.SearchService) *SearchHandler { return &SearchHandler{svc: s} }

func (h *SearchHandler) Search(c *gin.Context) {
	limit := 5
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			limit = n
		}
	}
	items, err := h.svc.Search(c.Request.Context(), c.Query("q"), limit)
	if err != nil {
		response.Err(c, err)
		return
	}
	response.OK(c, items)
}
