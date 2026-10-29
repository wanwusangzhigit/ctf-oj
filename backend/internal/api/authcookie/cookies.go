package authcookie

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	AccessName  = "ctf_oj_access"
	RefreshName = "ctf_oj_refresh"
	SessionName = "ctf_oj_session"

	accessPath  = "/api/v1"
	refreshPath = "/api/v1/auth"
	sessionPath = "/"
)

// Set writes the access, refresh and session hint cookies. Access and refresh
// tokens are HttpOnly; the session hint lets the SPA skip the auth probe for
// anonymous visitors without exposing the tokens to JavaScript.
func Set(c *gin.Context, access, refresh string, accessExpiresAt, refreshExpiresAt time.Time) {
	secure := isSecure(c)
	refreshMaxAge := secondsUntil(refreshExpiresAt)
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(AccessName, access, secondsUntil(accessExpiresAt), accessPath, "", secure, true)
	c.SetCookie(RefreshName, refresh, refreshMaxAge, refreshPath, "", secure, true)
	c.SetCookie(SessionName, "1", refreshMaxAge, sessionPath, "", secure, false)
}

func Clear(c *gin.Context) {
	secure := isSecure(c)
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(AccessName, "", -1, accessPath, "", secure, true)
	c.SetCookie(RefreshName, "", -1, refreshPath, "", secure, true)
	c.SetCookie(SessionName, "", -1, sessionPath, "", secure, false)
}

func AccessToken(c *gin.Context) string {
	token, _ := c.Cookie(AccessName)
	return strings.TrimSpace(token)
}

func RefreshToken(c *gin.Context) string {
	token, _ := c.Cookie(RefreshName)
	return strings.TrimSpace(token)
}

func secondsUntil(t time.Time) int {
	seconds := int(time.Until(t).Seconds())
	if seconds < 1 {
		return 1
	}
	return seconds
}

func isSecure(c *gin.Context) bool {
	return c.Request.TLS != nil || strings.EqualFold(c.GetHeader("X-Forwarded-Proto"), "https")
}
