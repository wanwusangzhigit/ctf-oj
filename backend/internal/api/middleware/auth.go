package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/response"
	"github.com/ctf-oj/backend/internal/service"
)

const (
	CtxUserID   = "uid"
	CtxUsername = "username"
	CtxRole     = "role"
)

func Auth(jwt *service.JWTService) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			response.Err(c, domain.ErrUnauthorized)
			c.Abort()
			return
		}
		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			response.Err(c, domain.ErrUnauthorized)
			c.Abort()
			return
		}
		claims, err := jwt.Parse(strings.TrimSpace(parts[1]))
		if err != nil || claims.Type != service.AccessToken {
			response.Err(c, domain.ErrUnauthorized)
			c.Abort()
			return
		}
		c.Set(CtxUserID, claims.UserID)
		c.Set(CtxUsername, claims.Username)
		c.Set(CtxRole, claims.Role)
		c.Next()
	}
}

func OptionalAuth(jwt *service.JWTService) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			c.Next()
			return
		}
		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			c.Next()
			return
		}
		if claims, err := jwt.Parse(strings.TrimSpace(parts[1])); err == nil && claims.Type == service.AccessToken {
			c.Set(CtxUserID, claims.UserID)
			c.Set(CtxUsername, claims.Username)
			c.Set(CtxRole, claims.Role)
		}
		c.Next()
	}
}

func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get(CtxRole)
		if role != string(domain.RoleAdmin) {
			response.Err(c, domain.ErrForbidden)
			c.Abort()
			return
		}
		c.Next()
	}
}

func CurrentUserID(c *gin.Context) (uint, bool) {
	v, ok := c.Get(CtxUserID)
	if !ok {
		return 0, false
	}
	id, ok := v.(uint)
	return id, ok
}

func IsAdmin(c *gin.Context) bool {
	role, _ := c.Get(CtxRole)
	return role == string(domain.RoleAdmin)
}
