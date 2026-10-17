package repository

import (
	"context"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
)

type flagRepo struct {
	db *gorm.DB
}

func NewFlagRepository(db *gorm.DB) domain.FlagRepository {
	return &flagRepo{db: db}
}

func (r *flagRepo) Create(ctx context.Context, f *domain.Flag) error {
	return mapErr(r.db.WithContext(ctx).Create(f).Error)
}

func (r *flagRepo) FindByChallengeID(ctx context.Context, challengeID uint) ([]*domain.Flag, error) {
	var fs []*domain.Flag
	if err := r.db.WithContext(ctx).
		Where("challenge_id = ?", challengeID).
		Find(&fs).Error; err != nil {
		return nil, err
	}
	return fs, nil
}

func (r *flagRepo) DeleteByChallengeID(ctx context.Context, challengeID uint) error {
	return r.db.WithContext(ctx).
		Where("challenge_id = ?", challengeID).
		Delete(&domain.Flag{}).Error
}
