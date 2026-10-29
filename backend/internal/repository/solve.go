package repository

import (
	"context"
	"time"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
)

type solveRepo struct {
	db *gorm.DB
}

func NewSolveRepository(db *gorm.DB) domain.SolveRepository {
	return &solveRepo{db: db}
}

func (r *solveRepo) Create(ctx context.Context, s *domain.Solve) error {
	return mapErr(r.db.WithContext(ctx).Create(s).Error)
}

func (r *solveRepo) FindByUserAndChallenge(ctx context.Context, userID, challengeID uint) (*domain.Solve, error) {
	var s domain.Solve
	if err := r.db.WithContext(ctx).
		Where("user_id = ? AND challenge_id = ?", userID, challengeID).
		First(&s).Error; err != nil {
		return nil, mapErr(err)
	}
	return &s, nil
}

func (r *solveRepo) CountByChallenge(ctx context.Context, challengeID uint) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).
		Model(&domain.Solve{}).
		Where("challenge_id = ?", challengeID).
		Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func (r *solveRepo) ListByChallenge(ctx context.Context, challengeID uint, page, pageSize int) ([]*domain.Solve, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	var (
		total int64
		ss    []*domain.Solve
	)
	q := r.db.WithContext(ctx).Model(&domain.Solve{}).Where("challenge_id = ?", challengeID)
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := q.
		Preload("User").
		Order("solved_at ASC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&ss).Error; err != nil {
		return nil, 0, err
	}
	return ss, total, nil
}

func (r *solveRepo) ListByUser(ctx context.Context, userID uint) ([]*domain.Solve, error) {
	var ss []*domain.Solve
	if err := r.db.WithContext(ctx).
		Preload("Challenge").
		Where("user_id = ?", userID).
		Order("solved_at DESC").
		Find(&ss).Error; err != nil {
		return nil, err
	}
	return ss, nil
}

func (r *solveRepo) ListTop(ctx context.Context, limit int) ([]*domain.Solve, error) {
	if limit <= 0 || limit > 50 {
		limit = 10
	}
	var ss []*domain.Solve
	if err := r.db.WithContext(ctx).
		Preload("User").
		Preload("Challenge").
		Order("solved_at DESC").
		Limit(limit).
		Find(&ss).Error; err != nil {
		return nil, err
	}
	return ss, nil
}

func (r *solveRepo) ListScoreboard(ctx context.Context, page, pageSize int) ([]*domain.User, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	var (
		total int64
		users []*domain.User
	)
	if err := r.db.WithContext(ctx).Model(&domain.User{}).
		Where("score_excluded = ?", false).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := r.db.WithContext(ctx).
		Where("score_excluded = ?", false).
		Order("score DESC, id ASC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&users).Error; err != nil {
		return nil, 0, err
	}
	return users, total, nil
}

// ListScoreboardAt returns the ranking as it stood at cutoff: each user's
// score is recomputed from solves solved at or before that instant. Used to
// honour a competition's freeze window.
func (r *solveRepo) ListScoreboardAt(ctx context.Context, cutoff time.Time, page, pageSize int) ([]*domain.User, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	var total int64
	if err := r.db.WithContext(ctx).Model(&domain.User{}).
		Where("score_excluded = ?", false).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var users []*domain.User
	err := r.db.WithContext(ctx).
		Model(&domain.User{}).
		Where("score_excluded = ?", false).
		Select(`users.id, users.username, users.bio, users.role, users.created_at, users.updated_at,
			users.score - COALESCE((SELECT SUM(s.score) FROM solves s WHERE s.user_id = users.id AND s.solved_at > ?), 0) AS score`, cutoff).
		Order("score DESC, users.id ASC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&users).Error
	if err != nil {
		return nil, 0, err
	}
	return users, total, nil
}

func (r *solveRepo) SumScoreByUserUntil(ctx context.Context, userID uint, cutoff time.Time) (int, error) {
	var sum int
	err := r.db.WithContext(ctx).
		Model(&domain.Solve{}).
		Select("COALESCE(SUM(score), 0)").
		Where("user_id = ? AND solved_at <= ?", userID, cutoff).
		Scan(&sum).Error
	return sum, err
}
