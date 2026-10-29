package repository

import (
	"context"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
)

type settingRepo struct{ db *gorm.DB }

func NewSettingRepository(db *gorm.DB) domain.SettingRepository {
	return &settingRepo{db: db}
}

func (r *settingRepo) List(ctx context.Context) ([]*domain.SiteSetting, error) {
	var out []*domain.SiteSetting
	if err := r.db.WithContext(ctx).Order("key ASC").Find(&out).Error; err != nil {
		return nil, err
	}
	return out, nil
}

func (r *settingRepo) Get(ctx context.Context, key string) (*domain.SiteSetting, error) {
	var s domain.SiteSetting
	if err := r.db.WithContext(ctx).First(&s, "key = ?", key).Error; err != nil {
		return nil, mapErr(err)
	}
	return &s, nil
}

func (r *settingRepo) GetMany(ctx context.Context, keys []string) ([]*domain.SiteSetting, error) {
	if len(keys) == 0 {
		return nil, nil
	}
	var out []*domain.SiteSetting
	if err := r.db.WithContext(ctx).Where("key IN ?", keys).Order("key ASC").Find(&out).Error; err != nil {
		return nil, err
	}
	return out, nil
}

func (r *settingRepo) Upsert(ctx context.Context, s *domain.SiteSetting) error {
	return r.db.WithContext(ctx).Save(s).Error
}

func (r *settingRepo) UpsertMany(ctx context.Context, settings []*domain.SiteSetting) error {
	if len(settings) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, s := range settings {
			if err := tx.Save(s).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
