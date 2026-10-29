package middleware

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/api/authcookie"
	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/response"
	"github.com/ctf-oj/backend/internal/service"
)

const (
	CtxUserID     = "uid"
	CtxUsername   = "username"
	CtxRole       = "role"
	CtxDelegation = "delegation"
)

func Auth(jwt *service.JWTService) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := bearerToken(c.GetHeader("Authorization"))
		if token == "" {
			token = authcookie.AccessToken(c)
		}
		if token == "" {
			response.Err(c, domain.ErrUnauthorized)
			c.Abort()
			return
		}
		claims, err := jwt.Parse(token)
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
		token := bearerToken(c.GetHeader("Authorization"))
		if token == "" {
			token = authcookie.AccessToken(c)
		}
		if token == "" {
			token = strings.TrimSpace(c.Query("token"))
		}
		if token == "" {
			c.Next()
			return
		}
		if claims, err := jwt.Parse(token); err == nil && claims.Type == service.AccessToken {
			c.Set(CtxUserID, claims.UserID)
			c.Set(CtxUsername, claims.Username)
			c.Set(CtxRole, claims.Role)
		}
		c.Next()
	}
}

func bearerToken(header string) string {
	parts := strings.SplitN(strings.TrimSpace(header), " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

func RequireAnyRole(roles ...domain.Role) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[string(r)] = struct{}{}
	}
	return func(c *gin.Context) {
		role, _ := c.Get(CtxRole)
		s, _ := role.(string)
		if _, ok := allowed[s]; !ok {
			response.Err(c, domain.ErrForbidden)
			c.Abort()
			return
		}
		c.Next()
	}
}

func RequireAdmin() gin.HandlerFunc {
	return RequireAnyRole(domain.RoleAdmin)
}

func HasRole(c *gin.Context, roles ...domain.Role) bool {
	role, _ := c.Get(CtxRole)
	s, _ := role.(string)
	for _, r := range roles {
		if s == string(r) {
			return true
		}
	}
	return false
}

func RequirePermission(perm domain.Permission) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get(CtxRole)
		s, _ := role.(string)
		if !domain.RoleHasPermission(domain.Role(s), perm) {
			response.Err(c, domain.ErrForbidden)
			c.Abort()
			return
		}
		c.Next()
	}
}

func HasPermission(c *gin.Context, perm domain.Permission) bool {
	role, _ := c.Get(CtxRole)
	s, _ := role.(string)
	return domain.RoleHasPermission(domain.Role(s), perm)
}

func CanManageChallenges(c *gin.Context) bool {
	return HasPermission(c, domain.PermChallengeManage)
}

func CanManageCompetitions(c *gin.Context) bool {
	return HasPermission(c, domain.PermCompetitionManage)
}

// Delegation returns the resource grant that authorized the current request,
// e.g. "challenge:12:manage". Empty for global admins.
func Delegation(c *gin.Context) string {
	v, _ := c.Get(CtxDelegation)
	s, _ := v.(string)
	return s
}

// RequireChallengeManage allows global challenge managers or users holding a
// manage grant on the challenge in :id.
func RequireChallengeManage(access *service.ChallengeAccessService) gin.HandlerFunc {
	return func(c *gin.Context) {
		if CanManageChallenges(c) {
			c.Next()
			return
		}
		uid, ok := CurrentUserID(c)
		if !ok || access == nil {
			response.Err(c, domain.ErrForbidden)
			c.Abort()
			return
		}
		id, err := strconv.ParseUint(c.Param("id"), 10, 64)
		if err != nil {
			response.Err(c, domain.ErrForbidden)
			c.Abort()
			return
		}
		allowed, err := access.CanManageChallenge(c.Request.Context(), uint(id), uid)
		if err != nil || !allowed {
			response.Err(c, domain.ErrForbidden)
			c.Abort()
			return
		}
		c.Set(CtxDelegation, fmt.Sprintf("challenge:%d:manage", id))
		c.Next()
	}
}

// RequireHintManage resolves the hint's challenge before checking the grant.
func RequireHintManage(hints *service.HintService, access *service.ChallengeAccessService) gin.HandlerFunc {
	return func(c *gin.Context) {
		if CanManageChallenges(c) {
			c.Next()
			return
		}
		uid, ok := CurrentUserID(c)
		if !ok || access == nil || hints == nil {
			response.Err(c, domain.ErrForbidden)
			c.Abort()
			return
		}
		hintID, err := strconv.ParseUint(c.Param("hintId"), 10, 64)
		if err != nil {
			response.Err(c, domain.ErrForbidden)
			c.Abort()
			return
		}
		challengeID, err := hints.ChallengeIDForHint(c.Request.Context(), uint(hintID))
		if err != nil {
			response.Err(c, domain.ErrForbidden)
			c.Abort()
			return
		}
		allowed, err := access.CanManageChallenge(c.Request.Context(), challengeID, uid)
		if err != nil || !allowed {
			response.Err(c, domain.ErrForbidden)
			c.Abort()
			return
		}
		c.Set(CtxDelegation, fmt.Sprintf("challenge:%d:manage", challengeID))
		c.Next()
	}
}

// RequireCompetitionManage allows global competition managers or users holding
// a manage grant on the competition in :id.
func RequireCompetitionManage(comp *service.CompetitionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		if CanManageCompetitions(c) {
			c.Next()
			return
		}
		uid, ok := CurrentUserID(c)
		if !ok || comp == nil {
			response.Err(c, domain.ErrForbidden)
			c.Abort()
			return
		}
		id, err := strconv.ParseUint(c.Param("id"), 10, 64)
		if err != nil {
			response.Err(c, domain.ErrForbidden)
			c.Abort()
			return
		}
		allowed, err := comp.CanManage(c.Request.Context(), uint(id), uid, false)
		if err != nil || !allowed {
			response.Err(c, domain.ErrForbidden)
			c.Abort()
			return
		}
		c.Set(CtxDelegation, fmt.Sprintf("competition:%d:manage", id))
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

func CurrentUsername(c *gin.Context) string {
	v, _ := c.Get(CtxUsername)
	s, _ := v.(string)
	return s
}

func IsAdmin(c *gin.Context) bool {
	role, _ := c.Get(CtxRole)
	return role == string(domain.RoleAdmin)
}

// UserLoader resolves the current database state for an authenticated user.
type UserLoader func(ctx context.Context, userID uint) (*domain.User, error)

// RequireActive rejects banned accounts and refreshes the role/username from
// the database. Refreshing here means role changes take effect immediately
// instead of waiting for the access token to expire.
func RequireActive(load UserLoader) gin.HandlerFunc {
	return func(c *gin.Context) {
		uid, ok := CurrentUserID(c)
		if !ok {
			c.Next()
			return
		}
		u, err := load(c.Request.Context(), uid)
		if err != nil {
			if errors.Is(err, domain.ErrNotFound) {
				err = domain.ErrUnauthorized
			}
			response.Err(c, err)
			c.Abort()
			return
		}
		if u.IsBanned {
			authcookie.Clear(c)
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"code":    40310,
				"message": "account banned",
			})
			return
		}
		c.Set(CtxUsername, u.Username)
		c.Set(CtxRole, string(u.Role))
		c.Next()
	}
}

// OptionalActive is the optional-auth counterpart to RequireActive. If the
// token belongs to a banned or deleted user, the request continues as an
// anonymous visitor; otherwise the current role/username is refreshed.
func OptionalActive(load UserLoader) gin.HandlerFunc {
	return func(c *gin.Context) {
		uid, ok := CurrentUserID(c)
		if !ok {
			c.Next()
			return
		}
		u, err := load(c.Request.Context(), uid)
		if err != nil || u.IsBanned {
			authcookie.Clear(c)
			c.Set(CtxUserID, nil)
			c.Set(CtxUsername, "")
			c.Set(CtxRole, string(domain.RoleUser))
			c.Next()
			return
		}
		c.Set(CtxUsername, u.Username)
		c.Set(CtxRole, string(u.Role))
		c.Next()
	}
}
