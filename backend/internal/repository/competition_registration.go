package repository

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
)

type CompetitionRegistrationRepo struct {
	db *gorm.DB
}

func NewCompetitionRegistrationRepo(db *gorm.DB) *CompetitionRegistrationRepo {
	return &CompetitionRegistrationRepo{db: db}
}

func (r *CompetitionRegistrationRepo) Create(ctx context.Context, reg *domain.CompetitionRegistration) error {
	return r.db.WithContext(ctx).Create(reg).Error
}

func (r *CompetitionRegistrationRepo) Find(ctx context.Context, competitionID, userID uint) (*domain.CompetitionRegistration, error) {
	var reg domain.CompetitionRegistration
	err := r.db.WithContext(ctx).
		Preload("User").
		Where("competition_id = ? AND user_id = ?", competitionID, userID).
		First(&reg).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &reg, nil
}

func (r *CompetitionRegistrationRepo) Delete(ctx context.Context, competitionID, userID uint) error {
	res := r.db.WithContext(ctx).
		Where("competition_id = ? AND user_id = ?", competitionID, userID).
		Delete(&domain.CompetitionRegistration{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *CompetitionRegistrationRepo) CountByCompetition(ctx context.Context, competitionID uint) (int64, error) {
	var total int64
	err := r.db.WithContext(ctx).
		Model(&domain.CompetitionRegistration{}).
		Where("competition_id = ?", competitionID).
		Count(&total).Error
	return total, err
}

func (r *CompetitionRegistrationRepo) ListByCompetition(ctx context.Context, competitionID uint, page, pageSize int) ([]*domain.CompetitionRegistration, int64, error) {
	var total int64
	if err := r.db.WithContext(ctx).
		Model(&domain.CompetitionRegistration{}).
		Where("competition_id = ?", competitionID).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []*domain.CompetitionRegistration
	err := r.db.WithContext(ctx).
		Preload("User").
		Where("competition_id = ?", competitionID).
		Order("score_excluded DESC, created_at ASC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&rows).Error
	return rows, total, err
}

func (r *CompetitionRegistrationRepo) SetScoreExcluded(ctx context.Context, competitionID, userID uint, excluded bool, reason string, actorID uint) (*domain.CompetitionRegistration, error) {
	updates := map[string]any{
		"score_excluded":  excluded,
		"excluded_reason": "",
		"excluded_at":     nil,
		"excluded_by":     nil,
	}
	if excluded {
		now := time.Now().UTC()
		updates["excluded_reason"] = reason
		updates["excluded_at"] = &now
		updates["excluded_by"] = &actorID
	}
	res := r.db.WithContext(ctx).
		Model(&domain.CompetitionRegistration{}).
		Where("competition_id = ? AND user_id = ?", competitionID, userID).
		Updates(updates)
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		reg := &domain.CompetitionRegistration{
			CompetitionID: competitionID,
			UserID:        userID,
		}
		if excluded {
			now := time.Now().UTC()
			reg.ScoreExcluded = true
			reg.ExcludedReason = reason
			reg.ExcludedAt = &now
			reg.ExcludedBy = &actorID
		}
		if err := r.db.WithContext(ctx).Create(reg).Error; err != nil {
			return nil, err
		}
	}
	return r.Find(ctx, competitionID, userID)
}
