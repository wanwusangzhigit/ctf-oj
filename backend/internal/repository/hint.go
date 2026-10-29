package repository

import (
	"context"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/ctf-oj/backend/internal/domain"
)

type hintRepo struct{ db *gorm.DB }

func NewHintRepository(db *gorm.DB) domain.HintRepository {
	return &hintRepo{db: db}
}

func (r *hintRepo) Create(ctx context.Context, h *domain.ChallengeHint) error {
	return mapErr(r.db.WithContext(ctx).Create(h).Error)
}

func (r *hintRepo) FindByChallenge(ctx context.Context, challengeID uint) ([]*domain.ChallengeHint, error) {
	var out []*domain.ChallengeHint
	if err := r.db.WithContext(ctx).
		Where("challenge_id = ?", challengeID).
		Order("sort_order ASC, id ASC").
		Find(&out).Error; err != nil {
		return nil, err
	}
	return out, nil
}

func (r *hintRepo) FindByID(ctx context.Context, id uint) (*domain.ChallengeHint, error) {
	var h domain.ChallengeHint
	if err := r.db.WithContext(ctx).First(&h, "id = ?", id).Error; err != nil {
		return nil, mapErr(err)
	}
	return &h, nil
}

func (r *hintRepo) Update(ctx context.Context, h *domain.ChallengeHint) error {
	// Targeted column update — Save() would write zero values for fields the
	// caller didn't load (challenge_id, created_at), tripping the FK and
	// wiping timestamps.
	res := r.db.WithContext(ctx).
		Model(&domain.ChallengeHint{}).
		Where("id = ?", h.ID).
		Updates(map[string]any{
			"sort_order": h.SortOrder,
			"cost_ratio": h.CostRatio,
			"content_md": h.Content,
			"updated_at": time.Now(),
		})
	if res.Error != nil {
		return mapErr(res.Error)
	}
	if res.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *hintRepo) Delete(ctx context.Context, id uint) error {
	return mapErr(r.db.WithContext(ctx).Delete(&domain.ChallengeHint{}, "id = ?", id).Error)
}

func (r *hintRepo) ListUnlocksByUser(ctx context.Context, userID, challengeID uint) ([]*domain.HintUnlock, error) {
	var out []*domain.HintUnlock
	err := r.db.WithContext(ctx).
		Joins("JOIN challenge_hints h ON h.id = hint_unlocks.hint_id").
		Where("hint_unlocks.user_id = ? AND h.challenge_id = ?", userID, challengeID).
		Find(&out).Error
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (r *hintRepo) ListUnlockedHintIDs(ctx context.Context, userID uint, hintIDs []uint) ([]uint, error) {
	if len(hintIDs) == 0 {
		return nil, nil
	}
	var ids []uint
	err := r.db.WithContext(ctx).
		Model(&domain.HintUnlock{}).
		Where("user_id = ? AND hint_id IN ?", userID, hintIDs).
		Pluck("hint_id", &ids).Error
	if err != nil {
		return nil, err
	}
	return ids, nil
}

// Unlock uses ON CONFLICT DO NOTHING so duplicate unlocks are a no-op
// (e.g., if the user clicks twice).
func (r *hintRepo) Unlock(ctx context.Context, userID, hintID uint) error {
	unlock := &domain.HintUnlock{UserID: userID, HintID: hintID}
	return r.db.WithContext(ctx).
		Clauses(clause.OnConflict{DoNothing: true}).
		Create(unlock).Error
}
