package repository

import (
	"context"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
)

type announcementRepo struct {
	db *gorm.DB
}

func NewAnnouncementRepository(db *gorm.DB) domain.AnnouncementRepository {
	return &announcementRepo{db: db}
}

func (r *announcementRepo) Create(ctx context.Context, a *domain.Announcement) error {
	return mapErr(r.db.WithContext(ctx).Create(a).Error)
}

func (r *announcementRepo) FindByID(ctx context.Context, id uint) (*domain.Announcement, error) {
	var a domain.Announcement
	if err := r.db.WithContext(ctx).First(&a, id).Error; err != nil {
		return nil, mapErr(err)
	}
	return &a, nil
}

func (r *announcementRepo) List(ctx context.Context, onlyPublished bool, page, pageSize int) ([]*domain.Announcement, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	q := r.db.WithContext(ctx).Model(&domain.Announcement{})
	if onlyPublished {
		q = q.Where("is_published = ?", true)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var as []*domain.Announcement
	if err := q.
		Order("is_pinned DESC, COALESCE(published_at, created_at) DESC, id DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&as).Error; err != nil {
		return nil, 0, err
	}
	return as, total, nil
}

func (r *announcementRepo) Update(ctx context.Context, a *domain.Announcement) error {
	return mapErr(r.db.WithContext(ctx).Save(a).Error)
}

func (r *announcementRepo) Delete(ctx context.Context, id uint) error {
	tx := r.db.WithContext(ctx).Delete(&domain.Announcement{}, id)
	if tx.Error != nil {
		return mapErr(tx.Error)
	}
	if tx.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}
