package middleware

import (
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/domain"
)

// CompetitionContext copies a competition id from the query string into the
// request context. Public challenge subresources use it to resolve hidden
// challenges bound to a live competition.
func CompetitionContext() gin.HandlerFunc {
	return func(c *gin.Context) {
		raw := strings.TrimSpace(c.Query("competition_id"))
		if raw == "" {
			raw = strings.TrimSpace(c.Query("competition"))
		}
		if raw != "" {
			if id, err := strconv.ParseUint(raw, 10, 64); err == nil && id > 0 {
				c.Request = c.Request.WithContext(
					domain.WithCompetitionID(c.Request.Context(), uint(id)),
				)
			}
		}
		c.Next()
	}
}
