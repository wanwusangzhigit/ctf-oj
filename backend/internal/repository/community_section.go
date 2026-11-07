package repository

import (
	"context"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
)

type communitySectionRepo struct {
	db *gorm.DB
}

func NewCommunitySectionRepository(db *gorm.DB) domain.CommunitySectionRepository {
	return &communitySectionRepo{db: db}
}

func (r *communitySectionRepo) Create(ctx context.Context, s *domain.CommunitySection) error {
	return mapErr(r.db.WithContext(ctx).Create(s).Error)
}

func (r *communitySectionRepo) FindByID(ctx context.Context, id uint) (*domain.CommunitySection, error) {
	var s domain.CommunitySection
	if err := r.db.WithContext(ctx).First(&s, id).Error; err != nil {
		return nil, mapErr(err)
	}
	return &s, nil
}

func (r *communitySectionRepo) List(ctx context.Context) ([]*domain.CommunitySection, error) {
	var ss []*domain.CommunitySection
	if err := r.db.WithContext(ctx).
		Order("sort_order ASC, id ASC").
		Find(&ss).Error; err != nil {
		return nil, err
	}
	return ss, nil
}

func (r *communitySectionRepo) Update(ctx context.Context, s *domain.CommunitySection) error {
	return mapErr(r.db.WithContext(ctx).Save(s).Error)
}

func (r *communitySectionRepo) Delete(ctx context.Context, id uint) error {
	tx := r.db.WithContext(ctx).Delete(&domain.CommunitySection{}, id)
	if tx.Error != nil {
		return mapErr(tx.Error)
	}
	if tx.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}
