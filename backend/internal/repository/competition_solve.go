package repository

import (
	"context"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
)

type competitionSolveRepo struct{ db *gorm.DB }

func NewCompetitionSolveRepository(db *gorm.DB) domain.CompetitionSolveRepository {
	return &competitionSolveRepo{db: db}
}

func (r *competitionSolveRepo) Create(ctx context.Context, s *domain.CompetitionSolve) error {
	return mapErr(r.db.WithContext(ctx).Create(s).Error)
}

func (r *competitionSolveRepo) FindByUserAndChallenge(ctx context.Context, competitionID, userID, challengeID uint) (*domain.CompetitionSolve, error) {
	var s domain.CompetitionSolve
	if err := r.db.WithContext(ctx).
		Where("competition_id = ? AND user_id = ? AND challenge_id = ?", competitionID, userID, challengeID).
		First(&s).Error; err != nil {
		return nil, mapErr(err)
	}
	return &s, nil
}

func (r *competitionSolveRepo) CountByCompetitionChallenge(ctx context.Context, competitionID, challengeID uint) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).
		Model(&domain.CompetitionSolve{}).
		Where("competition_id = ? AND challenge_id = ?", competitionID, challengeID).
		Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}
