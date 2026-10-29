package service

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/ctf-oj/backend/internal/domain"
)

/**
 * CompetitionService — manage contest windows + scoreboard freeze state.
 *
 * At most one competition is "active" at a time. The active competition
 * publishes its freeze_at window so ScoreboardService can suppress updates
 * between freeze_at and end_at.
 */
type CompetitionService struct {
	repo     domain.CompetitionRepository
	settings *SettingService
	access   *ChallengeAccessService
}

func NewCompetitionService(repo domain.CompetitionRepository, settings *SettingService) *CompetitionService {
	return &CompetitionService{repo: repo, settings: settings}
}

func (s *CompetitionService) SetAccessService(a *ChallengeAccessService) { s.access = a }

func (s *CompetitionService) List(ctx context.Context, page, pageSize int) ([]*domain.Competition, int64, error) {
	return s.repo.List(ctx, page, pageSize)
}

func (s *CompetitionService) Get(ctx context.Context, id uint) (*domain.Competition, error) {
	return s.repo.FindByID(ctx, id)
}

func (s *CompetitionService) GetActive(ctx context.Context) (*domain.Competition, error) {
	c, err := s.repo.FindActive(ctx)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, nil
		}
		return nil, err
	}
	s.filterChallenges(ctx, c, 0, false)
	return c, nil
}

type CompetitionInput struct {
	Name             string                  `json:"name"`
	Slug             string                  `json:"slug"`
	Description      string                  `json:"description"`
	StartAt          *time.Time              `json:"startAt"`
	EndAt            *time.Time              `json:"endAt"`
	FreezeAt         *time.Time              `json:"freezeAt"`
	RegistrationCode string                  `json:"registrationCode"`
	Visibility       string                  `json:"visibility"`
	ScoringMode      string                  `json:"scoringMode"`
	ChallengeIDs     []uint                  `json:"challengeIds"`
	Archived         bool                    `json:"archived"`
	IsActive         bool                    `json:"isActive"`
	AccessGrants     *[]domain.AccessSubject `json:"accessGrants,omitempty"`
}

func (s *CompetitionService) Create(ctx context.Context, in CompetitionInput) (*domain.Competition, error) {
	if strings.TrimSpace(in.Name) == "" {
		return nil, errors.New("name required")
	}
	slug := strings.TrimSpace(in.Slug)
	if slug == "" {
		return nil, errors.New("slug required")
	}
	c := &domain.Competition{
		Name:             strings.TrimSpace(in.Name),
		Slug:             slug,
		Description:      in.Description,
		StartAt:          in.StartAt,
		EndAt:            in.EndAt,
		FreezeAt:         in.FreezeAt,
		RegistrationCode: strings.TrimSpace(in.RegistrationCode),
		Visibility:       normalizeVisibility(in.Visibility),
		ScoringMode:      normalizeScoringMode(in.ScoringMode),
		IsActive:         in.IsActive,
	}
	if err := s.repo.Create(ctx, c); err != nil {
		return nil, err
	}
	if err := s.repo.SetChallenges(ctx, c.ID, in.ChallengeIDs); err != nil {
		return nil, err
	}
	if c.IsActive {
		if err := s.markActive(ctx, c.ID); err != nil {
			return nil, err
		}
	}
	if in.AccessGrants != nil && s.access != nil {
		if err := s.access.SetCompetitionGrants(ctx, c.ID, *in.AccessGrants); err != nil {
			return nil, err
		}
	}
	return c, nil
}

func (s *CompetitionService) Update(ctx context.Context, id uint, in CompetitionInput) (*domain.Competition, error) {
	c, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	c.Name = strings.TrimSpace(in.Name)
	c.Slug = strings.TrimSpace(in.Slug)
	c.Description = in.Description
	c.StartAt = in.StartAt
	c.EndAt = in.EndAt
	c.FreezeAt = in.FreezeAt
	c.RegistrationCode = strings.TrimSpace(in.RegistrationCode)
	c.Visibility = normalizeVisibility(in.Visibility)
	c.ScoringMode = normalizeScoringMode(in.ScoringMode)
	if in.Archived && c.ArchivedAt == nil {
		now := time.Now()
		c.ArchivedAt = &now
	} else if !in.Archived {
		c.ArchivedAt = nil
	}
	c.IsActive = in.IsActive
	if err := s.repo.Update(ctx, c); err != nil {
		return nil, err
	}
	if err := s.repo.SetChallenges(ctx, c.ID, in.ChallengeIDs); err != nil {
		return nil, err
	}
	if c.IsActive {
		if err := s.markActive(ctx, c.ID); err != nil {
			return nil, err
		}
	} else if s.settings != nil {
		_ = s.settings.UpdateMany(ctx, map[string]string{SettingCompetitionActiveID: "0"}, 0)
	}
	if in.AccessGrants != nil && s.access != nil {
		if err := s.access.SetCompetitionGrants(ctx, c.ID, *in.AccessGrants); err != nil {
			return nil, err
		}
	}
	return c, nil
}

func (s *CompetitionService) Delete(ctx context.Context, id uint) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	if s.settings != nil {
		_ = s.settings.UpdateMany(ctx, map[string]string{SettingCompetitionActiveID: "0"}, 0)
	}
	return nil
}

func (s *CompetitionService) markActive(ctx context.Context, id uint) error {
	if err := s.repo.DeactivateAll(ctx); err != nil {
		return err
	}
	c, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	c.IsActive = true
	if err := s.repo.Update(ctx, c); err != nil {
		return err
	}
	if s.settings != nil {
		_ = s.settings.UpdateMany(ctx, map[string]string{SettingCompetitionActiveID: intToStr(int64(id))}, 0)
	}
	return nil
}

// ScoreboardCutoff returns the freeze instant while the public scoreboard
// should be held back, or nil when scores are live.
func (s *CompetitionService) ScoreboardCutoff(ctx context.Context) *time.Time {
	c, err := s.repo.FindActive(ctx)
	if err != nil || c == nil || c.FreezeAt == nil {
		return nil
	}
	now := time.Now()
	if now.Before(*c.FreezeAt) {
		return nil
	}
	if c.EndAt != nil && now.After(*c.EndAt) {
		return nil
	}
	return c.FreezeAt
}

// IsScoreboardFrozen returns true if there is an active competition whose
// freeze_at has passed but end_at has not (or no end_at).
func (s *CompetitionService) IsScoreboardFrozen(ctx context.Context) bool {
	c, err := s.repo.FindActive(ctx)
	if err != nil || c == nil {
		return false
	}
	now := time.Now()
	if c.FreezeAt == nil {
		return false
	}
	if now.Before(*c.FreezeAt) {
		return false
	}
	if c.EndAt != nil && now.After(*c.EndAt) {
		return false
	}
	return true
}

func intToStr(n int64) string {
	if n == 0 {
		return "0"
	}
	const digits = "0123456789"
	buf := make([]byte, 0, 20)
	neg := false
	if n < 0 {
		neg = true
		n = -n
	}
	for n > 0 {
		buf = append([]byte{digits[n%10]}, buf...)
		n /= 10
	}
	if neg {
		buf = append([]byte{'-'}, buf...)
	}
	return string(buf)
}

func normalizeScoringMode(v string) string {
	switch strings.TrimSpace(v) {
	case "fixed", "three_blood":
		return strings.TrimSpace(v)
	default:
		return "dynamic"
	}
}

func normalizeVisibility(v string) string {
	v = strings.TrimSpace(v)
	if v != "private" {
		return "public"
	}
	return v
}

// GetAdmin returns a competition with its access grants for the admin UI.
func (s *CompetitionService) GetAdmin(ctx context.Context, id uint) (*domain.Competition, error) {
	return s.GetAdminFor(ctx, id, 0, true)
}

// GetAdminFor returns a competition with grants for the admin UI, filtering
// bound challenges for delegated managers who may not see them.
func (s *CompetitionService) GetAdminFor(ctx context.Context, id, viewerID uint, includeHidden bool) (*domain.Competition, error) {
	c, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if s.access != nil {
		if grants, err := s.access.ListCompetitionGrants(ctx, id); err == nil {
			c.AccessGrants = grants
		}
	}
	s.filterChallenges(ctx, c, viewerID, includeHidden)
	return c, nil
}

// CanManage reports whether the viewer may update this competition. Global
// competition managers are handled by the caller.
func (s *CompetitionService) CanManage(ctx context.Context, id, userID uint, isAdmin bool) (bool, error) {
	if isAdmin {
		return true, nil
	}
	if s.access == nil {
		return false, nil
	}
	return s.access.CanManageCompetition(ctx, id, userID, false)
}

// ListVisible returns competitions visible to the viewer. Administrators see
// archived and private competitions; everyone else only public, unarchived ones.
func (s *CompetitionService) ListVisible(ctx context.Context, page, pageSize int, includeHidden bool) ([]*domain.Competition, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 50
	}
	var all []*domain.Competition
	for p := 1; ; p++ {
		items, total, err := s.repo.List(ctx, p, 100)
		if err != nil {
			return nil, 0, err
		}
		for _, c := range items {
			if includeHidden || (c.Visibility != "private" && c.ArchivedAt == nil) {
				all = append(all, c)
			}
		}
		if len(items) == 0 || len(all) >= int(total) {
			break
		}
	}
	total := int64(len(all))
	start := (page - 1) * pageSize
	if start > len(all) {
		start = len(all)
	}
	end := start + pageSize
	if end > len(all) {
		end = len(all)
	}
	return all[start:end], total, nil
}

func (s *CompetitionService) GetVisible(ctx context.Context, id uint, includeHidden bool) (*domain.Competition, error) {
	c, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !includeHidden && (c.Visibility == "private" || c.ArchivedAt != nil) {
		return nil, domain.ErrNotFound
	}
	return c, nil
}

// GetVisibleFor also strips bound challenges the viewer may not see.
func (s *CompetitionService) GetVisibleFor(ctx context.Context, id, viewerID uint, includeHidden bool) (*domain.Competition, error) {
	c, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !includeHidden {
		if s.access != nil {
			ok, err := s.access.CanViewCompetition(ctx, c, viewerID, false)
			if err != nil {
				return nil, err
			}
			if !ok {
				return nil, domain.ErrNotFound
			}
		} else if c.Visibility == "private" || c.ArchivedAt != nil {
			return nil, domain.ErrNotFound
		}
	}
	s.filterChallenges(ctx, c, viewerID, includeHidden)
	return c, nil
}

// ListVisibleFor mirrors ListVisible and filters each competition's bound
// challenges for the viewer.
func (s *CompetitionService) ListVisibleFor(ctx context.Context, page, pageSize int, viewerID uint, includeHidden bool) ([]*domain.Competition, int64, error) {
	if includeHidden {
		items, total, err := s.ListVisible(ctx, page, pageSize, true)
		if err != nil {
			return nil, 0, err
		}
		for _, c := range items {
			s.filterChallenges(ctx, c, viewerID, true)
		}
		return items, total, nil
	}
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 50
	}
	var all []*domain.Competition
	for p := 1; ; p++ {
		items, total, err := s.repo.List(ctx, p, 100)
		if err != nil {
			return nil, 0, err
		}
		for _, c := range items {
			if s.access != nil {
				ok, err := s.access.CanViewCompetition(ctx, c, viewerID, false)
				if err != nil {
					return nil, 0, err
				}
				if !ok {
					continue
				}
			} else if c.Visibility == "private" || c.ArchivedAt != nil {
				continue
			}
			all = append(all, c)
		}
		if len(items) == 0 || len(all) >= int(total) {
			break
		}
	}
	total := int64(len(all))
	start := (page - 1) * pageSize
	if start > len(all) {
		start = len(all)
	}
	end := start + pageSize
	if end > len(all) {
		end = len(all)
	}
	items := all[start:end]
	for _, c := range items {
		s.filterChallenges(ctx, c, viewerID, false)
	}
	return items, total, nil
}

// ListManagedFor returns competitions the user can modify through a grant.
func (s *CompetitionService) ListManagedFor(ctx context.Context, page, pageSize int, userID uint) ([]*domain.Competition, int64, error) {
	if s.access == nil || userID == 0 {
		return []*domain.Competition{}, 0, nil
	}
	ids, err := s.access.ManagedCompetitionIDs(ctx, userID)
	if err != nil {
		return nil, 0, err
	}
	all := make([]*domain.Competition, 0, len(ids))
	for _, id := range ids {
		c, err := s.repo.FindByID(ctx, id)
		if err != nil {
			continue
		}
		s.filterChallenges(ctx, c, userID, false)
		all = append(all, c)
	}
	sort.Slice(all, func(i, j int) bool { return all[i].ID > all[j].ID })
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 50
	}
	total := int64(len(all))
	start := (page - 1) * pageSize
	if start > len(all) {
		start = len(all)
	}
	end := start + pageSize
	if end > len(all) {
		end = len(all)
	}
	return all[start:end], total, nil
}

func (s *CompetitionService) filterChallenges(ctx context.Context, c *domain.Competition, viewerID uint, includeHidden bool) {
	if c.BoundChallengeCount == 0 {
		c.BoundChallengeCount = len(c.Challenges)
	}
	if includeHidden || len(c.Challenges) == 0 {
		return
	}
	visible := make([]*domain.Challenge, 0, len(c.Challenges))
	for _, ch := range c.Challenges {
		if s.access != nil {
			ok, err := s.access.CanView(ctx, ch, viewerID, false)
			if err != nil || !ok {
				continue
			}
		} else if !ch.IsPublished {
			continue
		}
		visible = append(visible, ch)
	}
	c.Challenges = visible
}

// window resolves the effective [start, end] range for a competition.
func window(c *domain.Competition) (time.Time, time.Time) {
	start := time.Unix(0, 0)
	if c.StartAt != nil {
		start = *c.StartAt
	}
	end := time.Now()
	if c.EndAt != nil {
		end = *c.EndAt
	}
	return start, end
}

// TeamScoreboard ranks teams by their members' solves inside the window.
func (s *CompetitionService) TeamScoreboard(ctx context.Context, id uint, page, pageSize int) ([]*domain.TeamScore, int64, error) {
	c, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, 0, err
	}
	start, end := window(c)
	return s.repo.TeamScoreboard(ctx, id, start, end, c.ScoringMode, page, pageSize)
}

// Scoreboard ranks users by solves inside the competition window, restricted
// to the bound challenges when the competition has any.
func (s *CompetitionService) Scoreboard(ctx context.Context, id uint, page, pageSize int) ([]domain.PublicUser, int64, error) {
	c, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, 0, err
	}
	start := time.Unix(0, 0)
	if c.StartAt != nil {
		start = *c.StartAt
	}
	end := time.Now()
	if c.EndAt != nil {
		end = *c.EndAt
	}
	users, total, err := s.repo.Scoreboard(ctx, id, start, end, c.ScoringMode, page, pageSize)
	if err != nil {
		return nil, 0, err
	}
	out := make([]domain.PublicUser, 0, len(users))
	for _, u := range users {
		out = append(out, u.Public())
	}
	return out, total, nil
}
