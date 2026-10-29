package middleware

import (
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/ctf-oj/backend/internal/service"
)

/**
 * SettingGate caches the public settings view in request scope so handlers
 * don't each have to re-fetch. The cached snapshot is refreshed at most once
 * per minute per worker process — fine-grained enough for things like
 * registration toggles, while keeping the hot path allocation-free.
 */

type settingCache struct {
	mu       sync.RWMutex
	snapshot *service.PublicView
	loadedAt time.Time
	ttl      time.Duration
}

var globalSettingCache = &settingCache{ttl: 30 * time.Second}

func SettingGate(svc *service.SettingService) gin.HandlerFunc {
	return func(c *gin.Context) {
		snap := loadSettings(c, svc)
		c.Set(CtxSettingsKey, snap)
		c.Next()
	}
}

const CtxSettingsKey = "settings.public"

func loadSettings(c *gin.Context, svc *service.SettingService) *service.PublicView {
	globalSettingCache.mu.RLock()
	if globalSettingCache.snapshot != nil && time.Since(globalSettingCache.loadedAt) < globalSettingCache.ttl {
		s := globalSettingCache.snapshot
		globalSettingCache.mu.RUnlock()
		return s
	}
	globalSettingCache.mu.RUnlock()

	globalSettingCache.mu.Lock()
	defer globalSettingCache.mu.Unlock()
	// double-check after acquiring the write lock
	if globalSettingCache.snapshot != nil && time.Since(globalSettingCache.loadedAt) < globalSettingCache.ttl {
		return globalSettingCache.snapshot
	}
	s, err := svc.PublicView(c.Request.Context())
	if err != nil || s == nil {
		// fall back to an empty-but-valid view so handlers don't panic
		return &service.PublicView{}
	}
	globalSettingCache.snapshot = s
	globalSettingCache.loadedAt = time.Now()
	return s
}

// SettingsFromContext returns the public settings snapshot for the request.
func SettingsFromContext(c *gin.Context) *service.PublicView {
	if v, ok := c.Get(CtxSettingsKey); ok {
		if s, ok := v.(*service.PublicView); ok && s != nil {
			return s
		}
	}
	return &service.PublicView{}
}
