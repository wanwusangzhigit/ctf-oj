package repository

import (
	"context"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
)

type writeupRepo struct{ db *gorm.DB }

func NewWriteupRepository(db *gorm.DB) domain.WriteupRepository {
	return &writeupRepo{db: db}
}

func (r *writeupRepo) Create(ctx context.Context, w *domain.Writeup) error {
	return mapErr(r.db.WithContext(ctx).Create(w).Error)
}

func (r *writeupRepo) FindByID(ctx context.Context, id uint) (*domain.Writeup, error) {
	var w domain.Writeup
	if err := r.db.WithContext(ctx).Preload("User").First(&w, id).Error; err != nil {
		return nil, mapErr(err)
	}
	return &w, nil
}

func (r *writeupRepo) ListByChallenge(ctx context.Context, challengeID uint, publishedOnly bool) ([]*domain.Writeup, error) {
	q := r.db.WithContext(ctx).
		Preload("User").
		Where("challenge_id = ?", challengeID)
	if publishedOnly {
		q = q.Where("is_published = ?", true)
	}
	var out []*domain.Writeup
	if err := q.Order("created_at DESC").Find(&out).Error; err != nil {
		return nil, err
	}
	return out, nil
}

func (r *writeupRepo) ListByUser(ctx context.Context, userID uint) ([]*domain.Writeup, error) {
	var out []*domain.Writeup
	if err := r.db.WithContext(ctx).
		Preload("Challenge").
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&out).Error; err != nil {
		return nil, err
	}
	return out, nil
}

func (r *writeupRepo) Update(ctx context.Context, w *domain.Writeup) error {
	return mapErr(r.db.WithContext(ctx).Save(w).Error)
}

func (r *writeupRepo) Delete(ctx context.Context, id uint) error {
	res := r.db.WithContext(ctx).Delete(&domain.Writeup{}, id)
	if res.Error != nil {
		return mapErr(res.Error)
	}
	if res.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}
