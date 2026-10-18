package repository

import (
	"context"
	"time"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
)

type instanceRepo struct {
	db *gorm.DB
}

func NewInstanceRepository(db *gorm.DB) domain.InstanceRepository {
	return &instanceRepo{db: db}
}

func (r *instanceRepo) Create(ctx context.Context, i *domain.Instance) error {
	return mapErr(r.db.WithContext(ctx).Create(i).Error)
}

func (r *instanceRepo) FindByID(ctx context.Context, id uint) (*domain.Instance, error) {
	var i domain.Instance
	if err := r.db.WithContext(ctx).
		Preload("Challenge").
		First(&i, id).Error; err != nil {
		return nil, mapErr(err)
	}
	return &i, nil
}

func (r *instanceRepo) FindByUserAndChallenge(ctx context.Context, userID, challengeID uint) (*domain.Instance, error) {
	var i domain.Instance
	if err := r.db.WithContext(ctx).
		Where("user_id = ? AND challenge_id = ?", userID, challengeID).
		Order("created_at DESC").
		First(&i).Error; err != nil {
		return nil, mapErr(err)
	}
	return &i, nil
}

func (r *instanceRepo) FindActiveByUserAndChallenge(ctx context.Context, userID, challengeID uint) (*domain.Instance, error) {
	var i domain.Instance
	if err := r.db.WithContext(ctx).
		Where("user_id = ? AND challenge_id = ? AND status = ? AND expires_at > ?",
			userID, challengeID, domain.InstanceRunning, time.Now()).
		Order("expires_at DESC").
		First(&i).Error; err != nil {
		return nil, mapErr(err)
	}
	return &i, nil
}

func (r *instanceRepo) ListByUser(ctx context.Context, userID uint) ([]*domain.Instance, error) {
	var is []*domain.Instance
	if err := r.db.WithContext(ctx).
		Preload("Challenge").
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&is).Error; err != nil {
		return nil, err
	}
	return is, nil
}

func (r *instanceRepo) ListExpired(ctx context.Context, now time.Time) ([]*domain.Instance, error) {
	var is []*domain.Instance
	if err := r.db.WithContext(ctx).
		Where("status = ? AND expires_at <= ?", domain.InstanceRunning, now).
		Order("expires_at ASC").
		Limit(500).
		Find(&is).Error; err != nil {
		return nil, err
	}
	return is, nil
}

func (r *instanceRepo) ListActive(ctx context.Context) ([]*domain.Instance, error) {
	var is []*domain.Instance
	if err := r.db.WithContext(ctx).
		Where("status = ?", domain.InstanceRunning).
		Find(&is).Error; err != nil {
		return nil, err
	}
	return is, nil
}

func (r *instanceRepo) Update(ctx context.Context, i *domain.Instance) error {
	return mapErr(r.db.WithContext(ctx).Save(i).Error)
}

func (r *instanceRepo) UpdateStatus(ctx context.Context, id uint, status domain.InstanceStatus, errMsg string) error {
	return r.db.WithContext(ctx).
		Model(&domain.Instance{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"status":        status,
			"error_message": errMsg,
			"stopped_at":    time.Now(),
		}).Error
}

func (r *instanceRepo) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&domain.Instance{}, id).Error
}

func (r *instanceRepo) CountActiveByUser(ctx context.Context, userID uint) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).
		Model(&domain.Instance{}).
		Where("user_id = ? AND status = ?", userID, domain.InstanceRunning).
		Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}
