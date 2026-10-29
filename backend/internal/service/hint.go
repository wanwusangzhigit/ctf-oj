package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/ctf-oj/backend/internal/domain"
)

/**
 * HintService — admin-side CRUD for challenge hints + user-side unlock.
 *
 * Cost model: each hint has a cost_ratio in [0, 1]. When the user solves
 * the challenge, ChallengeService consults ListUnlocked() and reduces the
 * awarded score by sum(cost_ratio).
 *
 * Unlocking is permanent — once unlocked, a hint's content is visible to
 * the user forever, regardless of whether they ever solve the challenge.
 */
type HintService struct {
	repo   domain.HintRepository
	chals  domain.ChallengeRepository
	access *ChallengeAccessService
}

func NewHintService(repo domain.HintRepository, chals domain.ChallengeRepository) *HintService {
	return &HintService{repo: repo, chals: chals}
}

// AdminList returns all hints for a challenge (admin view — full content).
func (s *HintService) SetAccessService(a *ChallengeAccessService) { s.access = a }

func (s *HintService) AdminList(ctx context.Context, challengeID uint) ([]*domain.ChallengeHint, error) {
	return s.repo.FindByChallenge(ctx, challengeID)
}

func (s *HintService) ChallengeIDForHint(ctx context.Context, hintID uint) (uint, error) {
	h, err := s.repo.FindByID(ctx, hintID)
	if err != nil {
		return 0, err
	}
	return h.ChallengeID, nil
}

// PublicList returns all hints for a challenge but masks content + cost
// for any hint the user hasn't unlocked yet.
func (s *HintService) PublicList(ctx context.Context, userID, challengeID uint, includeUnpublished bool) ([]HintView, error) {
	c, err := s.chals.FindByID(ctx, challengeID)
	if err != nil {
		return nil, err
	}
	if s.access != nil {
		ok, err := s.access.CanView(ctx, c, userID, includeUnpublished)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, domain.ErrNotFound
		}
	} else if !c.IsPublished && !includeUnpublished {
		return nil, domain.ErrNotFound
	}
	hints, err := s.repo.FindByChallenge(ctx, challengeID)
	if err != nil {
		return nil, err
	}
	if len(hints) == 0 {
		return nil, nil
	}
	ids := make([]uint, 0, len(hints))
	for _, h := range hints {
		ids = append(ids, h.ID)
	}
	unlocked, err := s.repo.ListUnlockedHintIDs(ctx, userID, ids)
	if err != nil {
		return nil, err
	}
	unlockedSet := make(map[uint]bool, len(unlocked))
	for _, id := range unlocked {
		unlockedSet[id] = true
	}
	out := make([]HintView, 0, len(hints))
	for _, h := range hints {
		v := HintView{
			ID:        h.ID,
			SortOrder: h.SortOrder,
			CostRatio: h.CostRatio,
			Unlocked:  unlockedSet[h.ID],
		}
		if unlockedSet[h.ID] {
			v.Content = h.Content
		}
		out = append(out, v)
	}
	return out, nil
}

type HintView struct {
	ID        uint    `json:"id"`
	SortOrder int     `json:"sortOrder"`
	CostRatio float32 `json:"costRatio"`
	Unlocked  bool    `json:"unlocked"`
	Content   string  `json:"content,omitempty"`
}

// AdminCreate / AdminUpdate / AdminDelete — admin CRUD.
func (s *HintService) AdminCreate(ctx context.Context, h *domain.ChallengeHint) (*domain.ChallengeHint, error) {
	if h.ChallengeID == 0 {
		return nil, errors.New("challenge_id required")
	}
	if _, err := s.chals.FindByID(ctx, h.ChallengeID); err != nil {
		return nil, err
	}
	if h.CostRatio < 0 || h.CostRatio > 1 {
		return nil, errors.New("cost_ratio must be in [0, 1]")
	}
	if err := s.repo.Create(ctx, h); err != nil {
		return nil, err
	}
	return h, nil
}

func (s *HintService) AdminUpdate(ctx context.Context, h *domain.ChallengeHint) (*domain.ChallengeHint, error) {
	if h.CostRatio < 0 || h.CostRatio > 1 {
		return nil, errors.New("cost_ratio must be in [0, 1]")
	}
	if err := s.repo.Update(ctx, h); err != nil {
		return nil, err
	}
	// Re-read so the caller gets the full row (challenge_id, timestamps).
	return s.repo.FindByID(ctx, h.ID)
}

func (s *HintService) AdminDelete(ctx context.Context, id uint) error {
	return s.repo.Delete(ctx, id)
}

// Unlock records that a user has unlocked a hint. Idempotent — repeated
// unlocks are a no-op.
func (s *HintService) Unlock(ctx context.Context, userID, hintID uint, includeUnpublished bool) error {
	h, err := s.repo.FindByID(ctx, hintID)
	if err != nil {
		return err
	}
	c, err := s.chals.FindByID(ctx, h.ChallengeID)
	if err != nil {
		return err
	}
	if s.access != nil {
		ok, err := s.access.CanView(ctx, c, userID, includeUnpublished)
		if err != nil {
			return err
		}
		if !ok {
			return domain.ErrNotFound
		}
	} else if !c.IsPublished && !includeUnpublished {
		return domain.ErrNotFound
	}
	if err := s.repo.Unlock(ctx, userID, hintID); err != nil {
		return fmt.Errorf("unlock hint: %w", err)
	}
	return nil
}

// CostReductionForUser returns the sum of cost_ratio for all hints the user
// has unlocked on the given challenge. Used by ChallengeService.SubmitFlag to
// compute the final awarded score.
func (s *HintService) CostReductionForUser(ctx context.Context, userID, challengeID uint) (float32, error) {
	hints, err := s.repo.FindByChallenge(ctx, challengeID)
	if err != nil {
		return 0, err
	}
	if len(hints) == 0 {
		return 0, nil
	}
	ids := make([]uint, 0, len(hints))
	for _, h := range hints {
		ids = append(ids, h.ID)
	}
	unlocked, err := s.repo.ListUnlockedHintIDs(ctx, userID, ids)
	if err != nil {
		return 0, err
	}
	unlockedSet := make(map[uint]bool, len(unlocked))
	for _, id := range unlocked {
		unlockedSet[id] = true
	}
	var total float32
	for _, h := range hints {
		if unlockedSet[h.ID] {
			total += h.CostRatio
		}
	}
	if total > 1 {
		total = 1 // never give negative score
	}
	return total, nil
}
