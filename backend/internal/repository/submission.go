package repository

import (
	"context"
	"time"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
)

type submissionRepo struct {
	db *gorm.DB
}

func NewSubmissionRepository(db *gorm.DB) domain.SubmissionRepository {
	return &submissionRepo{db: db}
}

func (r *submissionRepo) Create(ctx context.Context, s *domain.Submission) error {
	return mapErr(r.db.WithContext(ctx).Create(s).Error)
}

func (r *submissionRepo) ListByUserAndChallenge(ctx context.Context, userID, challengeID uint, limit int) ([]*domain.Submission, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	var ss []*domain.Submission
	if err := r.db.WithContext(ctx).
		Where("user_id = ? AND challenge_id = ?", userID, challengeID).
		Order("created_at DESC").
		Limit(limit).
		Find(&ss).Error; err != nil {
		return nil, err
	}
	return ss, nil
}

func (r *submissionRepo) CountRecent(ctx context.Context, userID uint, since interface{}) (int64, error) {
	var count int64
	t, ok := since.(time.Time)
	if !ok {
		return 0, nil
	}
	if err := r.db.WithContext(ctx).
		Model(&domain.Submission{}).
		Where("user_id = ? AND created_at > ?", userID, t).
		Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}
