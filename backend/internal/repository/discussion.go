package repository

import (
	"context"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
)

type discussionRepo struct {
	db *gorm.DB
}

func NewDiscussionRepository(db *gorm.DB) domain.DiscussionRepository {
	return &discussionRepo{db: db}
}

func (r *discussionRepo) Create(ctx context.Context, d *domain.Discussion) error {
	return mapErr(r.db.WithContext(ctx).Create(d).Error)
}

func (r *discussionRepo) FindByID(ctx context.Context, id uint) (*domain.Discussion, error) {
	var d domain.Discussion
	if err := r.db.WithContext(ctx).Preload("User").First(&d, id).Error; err != nil {
		return nil, mapErr(err)
	}
	return &d, nil
}

func (r *discussionRepo) ListByChallenge(ctx context.Context, challengeID uint, page, pageSize int) ([]*domain.Discussion, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 50
	}
	q := r.db.WithContext(ctx).
		Model(&domain.Discussion{}).
		Where("challenge_id = ? AND parent_id IS NULL", challengeID)
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var ds []*domain.Discussion
	if err := q.
		Preload("User").
		Order("created_at ASC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&ds).Error; err != nil {
		return nil, 0, err
	}
	return ds, total, nil
}

func (r *discussionRepo) ListReplies(ctx context.Context, parentID uint) ([]*domain.Discussion, error) {
	var ds []*domain.Discussion
	if err := r.db.WithContext(ctx).
		Preload("User").
		Where("parent_id = ?", parentID).
		Order("created_at ASC").
		Find(&ds).Error; err != nil {
		return nil, err
	}
	return ds, nil
}

func (r *discussionRepo) ListByUser(ctx context.Context, userID uint, limit int) ([]*domain.Discussion, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	var ds []*domain.Discussion
	if err := r.db.WithContext(ctx).
		Preload("User").
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Find(&ds).Error; err != nil {
		return nil, err
	}
	return ds, nil
}

func (r *discussionRepo) Update(ctx context.Context, d *domain.Discussion) error {
	return mapErr(r.db.WithContext(ctx).Save(d).Error)
}

func (r *discussionRepo) Delete(ctx context.Context, id uint) error {
	tx := r.db.WithContext(ctx).Delete(&domain.Discussion{}, id)
	if tx.Error != nil {
		return mapErr(tx.Error)
	}
	if tx.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *discussionRepo) IncrLikeCount(ctx context.Context, id uint, delta int) error {
	return r.db.WithContext(ctx).
		Model(&domain.Discussion{}).
		Where("id = ?", id).
		UpdateColumn("like_count", gorm.Expr("GREATEST(like_count + ?, 0)", delta)).Error
}

func (r *discussionRepo) CountReplies(ctx context.Context, parentID uint) (int64, error) {
	var n int64
	if err := r.db.WithContext(ctx).
		Model(&domain.Discussion{}).
		Where("parent_id = ?", parentID).
		Count(&n).Error; err != nil {
		return 0, err
	}
	return n, nil
}
