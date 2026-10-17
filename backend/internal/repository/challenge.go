package repository

import (
	"context"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
)

type challengeRepo struct {
	db *gorm.DB
}

func NewChallengeRepository(db *gorm.DB) domain.ChallengeRepository {
	return &challengeRepo{db: db}
}

func (r *challengeRepo) Create(ctx context.Context, c *domain.Challenge) error {
	return mapErr(r.db.WithContext(ctx).Create(c).Error)
}

func (r *challengeRepo) FindByID(ctx context.Context, id uint) (*domain.Challenge, error) {
	var c domain.Challenge
	if err := r.db.WithContext(ctx).
		Preload("Category").
		First(&c, id).Error; err != nil {
		return nil, mapErr(err)
	}
	return &c, nil
}

func (r *challengeRepo) List(ctx context.Context, filter domain.ChallengeFilter) ([]*domain.Challenge, int64, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.PageSize < 1 || filter.PageSize > 100 {
		filter.PageSize = 50
	}

	q := r.db.WithContext(ctx).Model(&domain.Challenge{})
	if filter.CategoryID > 0 {
		q = q.Where("category_id = ?", filter.CategoryID)
	}
	if filter.OnlyPublished {
		q = q.Where("is_published = ?", true)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var cs []*domain.Challenge
	if err := q.
		Preload("Category").
		Order("created_at DESC").
		Offset((filter.Page - 1) * filter.PageSize).
		Limit(filter.PageSize).
		Find(&cs).Error; err != nil {
		return nil, 0, err
	}
	return cs, total, nil
}

func (r *challengeRepo) Update(ctx context.Context, c *domain.Challenge) error {
	return mapErr(r.db.WithContext(ctx).Save(c).Error)
}

func (r *challengeRepo) Delete(ctx context.Context, id uint) error {
	tx := r.db.WithContext(ctx).Delete(&domain.Challenge{}, id)
	if tx.Error != nil {
		return mapErr(tx.Error)
	}
	if tx.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *challengeRepo) CountSolves(ctx context.Context, challengeID uint) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).
		Model(&domain.Solve{}).
		Where("challenge_id = ?", challengeID).
		Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}
