package repository

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
)

type CompetitionAnnouncementRepo struct {
	db *gorm.DB
}

func NewCompetitionAnnouncementRepo(db *gorm.DB) *CompetitionAnnouncementRepo {
	return &CompetitionAnnouncementRepo{db: db}
}

func (r *CompetitionAnnouncementRepo) Create(ctx context.Context, a *domain.CompetitionAnnouncement) error {
	return r.db.WithContext(ctx).Create(a).Error
}

func (r *CompetitionAnnouncementRepo) FindByID(ctx context.Context, id uint) (*domain.CompetitionAnnouncement, error) {
	var a domain.CompetitionAnnouncement
	err := r.db.WithContext(ctx).First(&a, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *CompetitionAnnouncementRepo) ListByCompetition(ctx context.Context, competitionID uint, publishedOnly bool, page, pageSize int) ([]*domain.CompetitionAnnouncement, int64, error) {
	q := r.db.WithContext(ctx).
		Model(&domain.CompetitionAnnouncement{}).
		Where("competition_id = ?", competitionID)
	if publishedOnly {
		q = q.Where("is_published = true")
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []*domain.CompetitionAnnouncement
	err := q.
		Order("created_at DESC, id DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&rows).Error
	return rows, total, err
}

func (r *CompetitionAnnouncementRepo) Update(ctx context.Context, a *domain.CompetitionAnnouncement) error {
	return r.db.WithContext(ctx).Save(a).Error
}

func (r *CompetitionAnnouncementRepo) Delete(ctx context.Context, id uint) error {
	res := r.db.WithContext(ctx).Delete(&domain.CompetitionAnnouncement{}, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}
