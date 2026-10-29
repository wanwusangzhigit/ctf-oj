package service

import (
	"context"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/ctf-oj/backend/internal/domain"
)

/**
 * SettingService — read-through cache over the site_settings table.
 *
 * Reads are very hot (every page load asks for site.name + tagline), so we
 * cache values in-memory after the first DB hit. Writes invalidate the cache.
 * The cache is conservative: callers that need a perfectly-fresh value can
 * call Refresh() before reading.
 */
type SettingService struct {
	repo domain.SettingRepository

	mu       sync.RWMutex
	cache    map[string]string
	loadedAt time.Time
}

func NewSettingService(repo domain.SettingRepository) *SettingService {
	return &SettingService{repo: repo, cache: make(map[string]string)}
}

const (
	SettingSiteName                  = "site.name"
	SettingSiteTagline               = "site.tagline"
	SettingSiteRulesMd               = "site.rules_md"
	SettingRegistrationOpen          = "site.registration_open"
	SettingRegistrationCode          = "site.registration_code"
	SettingEmailVerificationRequired = "auth.email_verification_required"
	SettingPasswordResetEnabled      = "auth.password_reset_enabled"
	SettingCompetitionActiveID       = "competition.active_id"
	SettingCommunityVisibility       = "community.visibility"
	SettingCommunityPosting          = "community.posting"
)

// PublicView is the shape returned by GET /api/v1/settings — only the keys
// safe for unauthenticated consumers.
type PublicView struct {
	SiteName                  string `json:"siteName"`
	SiteTagline               string `json:"siteTagline"`
	SiteRulesMd               string `json:"siteRulesMd"`
	RegistrationOpen          bool   `json:"registrationOpen"`
	EmailVerificationRequired bool   `json:"emailVerificationRequired"`
	PasswordResetEnabled      bool   `json:"passwordResetEnabled"`
	HasRegistrationCode       bool   `json:"hasRegistrationCode"`
	HasActiveCompetition      bool   `json:"hasActiveCompetition"`
}

func (s *SettingService) PublicView(ctx context.Context) (*PublicView, error) {
	if err := s.ensureLoaded(ctx); err != nil {
		return nil, err
	}
	return &PublicView{
		SiteName:                  s.get(SettingSiteName, "CTF-OJ"),
		SiteTagline:               s.get(SettingSiteTagline, ""),
		SiteRulesMd:               s.get(SettingSiteRulesMd, ""),
		RegistrationOpen:          s.getBool(SettingRegistrationOpen, true),
		EmailVerificationRequired: s.getBool(SettingEmailVerificationRequired, false),
		PasswordResetEnabled:      s.getBool(SettingPasswordResetEnabled, false),
		HasRegistrationCode:       strings.TrimSpace(s.get(SettingRegistrationCode, "")) != "",
		HasActiveCompetition:      s.get(SettingCompetitionActiveID, "0") != "0",
	}, nil
}

// GetString / GetBool / GetInt expose arbitrary keys to other services.
func (s *SettingService) GetString(ctx context.Context, key string, def string) string {
	if err := s.ensureLoaded(ctx); err != nil {
		return def
	}
	return s.get(key, def)
}

func (s *SettingService) GetBool(ctx context.Context, key string, def bool) bool {
	if err := s.ensureLoaded(ctx); err != nil {
		return def
	}
	return s.getBool(key, def)
}

// AdminView is the full key/value list returned to admins.
func (s *SettingService) AdminView(ctx context.Context) ([]*domain.SiteSetting, error) {
	return s.repo.List(ctx)
}

// UpdateMany writes a batch of settings and refreshes the cache.
func (s *SettingService) UpdateMany(ctx context.Context, kv map[string]string, updatedBy uint) error {
	settings := make([]*domain.SiteSetting, 0, len(kv))
	now := time.Now()
	for k, v := range kv {
		settings = append(settings, &domain.SiteSetting{
			Key: k, Value: v, UpdatedAt: now, UpdatedBy: updatedBy,
		})
	}
	if err := s.repo.UpsertMany(ctx, settings); err != nil {
		return err
	}
	return s.Refresh(ctx)
}

// Refresh drops the in-memory cache so the next read repopulates from DB.
func (s *SettingService) Refresh(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	all, err := s.repo.List(ctx)
	if err != nil {
		return err
	}
	fresh := make(map[string]string, len(all))
	for _, s := range all {
		fresh[s.Key] = s.Value
	}
	s.cache = fresh
	s.loadedAt = time.Now()
	return nil
}

func (s *SettingService) ensureLoaded(ctx context.Context) error {
	s.mu.RLock()
	if len(s.cache) > 0 {
		s.mu.RUnlock()
		return nil
	}
	s.mu.RUnlock()
	return s.Refresh(ctx)
}

func (s *SettingService) get(key, def string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if v, ok := s.cache[key]; ok {
		return v
	}
	return def
}

func (s *SettingService) getBool(key string, def bool) bool {
	v := s.get(key, "")
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "true", "1", "yes", "on":
		return true
	case "false", "0", "no", "off", "":
		if v == "" {
			return def
		}
		return false
	}
	if b, err := strconv.ParseBool(v); err == nil {
		return b
	}
	return def
}
