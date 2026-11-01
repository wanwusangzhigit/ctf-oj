package repository

import (
	"context"
	"strings"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
)

type challengeRepo struct {
	db *gorm.DB
}

func NewChallengeRepository(db *gorm.DB) domain.ChallengeRepository {
	return &challengeRepo{db: db}
}

func (r *challengeRepo) Create(ctx context.Context, c *domain.Challenge) error {
	return mapErr(r.db.WithContext(ctx).Create(c).Error)
}

func (r *challengeRepo) FindByID(ctx context.Context, id uint) (*domain.Challenge, error) {
	var c domain.Challenge
	if err := r.db.WithContext(ctx).
		Preload("Category").
		First(&c, id).Error; err != nil {
		return nil, mapErr(err)
	}
	return &c, nil
}

func (r *challengeRepo) List(ctx context.Context, filter domain.ChallengeFilter) ([]*domain.Challenge, int64, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.PageSize < 1 || filter.PageSize > 100 {
		filter.PageSize = 50
	}

	q := r.db.WithContext(ctx).Model(&domain.Challenge{})
	if filter.CategoryID > 0 {
		q = q.Where("category_id = ?", filter.CategoryID)
	}
	if filter.OnlyPublished {
		parts := []string{"is_published = true"}
		args := []any{}
		if filter.AccessUserID > 0 {
			parts = append(parts, `(status = 'hidden' AND EXISTS (
				SELECT 1 FROM challenge_access_grants g
				WHERE g.challenge_id = challenges.id AND (
					(g.subject_type = 'user' AND g.subject_id = ?)
					OR (g.subject_type = 'team' AND g.subject_id = ?)
					OR (g.subject_type = 'group' AND g.subject_id IN (
						SELECT m.group_id FROM challenge_group_members m
						WHERE (m.subject_type = 'user' AND m.subject_id = ?)
						   OR (m.subject_type = 'team' AND m.subject_id = ?)
					))
				)
			))`)
			args = append(args, filter.AccessUserID, filter.AccessTeamID, filter.AccessUserID, filter.AccessTeamID)
		}
		if filter.CompetitionID > 0 {
			parts = append(parts, `(status = 'hidden' AND EXISTS (
				SELECT 1 FROM competition_challenges cc
				JOIN competitions comp ON comp.id = cc.competition_id
				WHERE cc.competition_id = ? AND cc.challenge_id = challenges.id
				  AND comp.archived_at IS NULL
				  AND (comp.start_at IS NULL OR comp.start_at <= NOW())
				  AND (comp.end_at IS NULL OR comp.end_at >= NOW())
			))`)
			args = append(args, filter.CompetitionID)
		}
		q = q.Where("("+strings.Join(parts, " OR ")+")", args...)
	}
	if v := strings.TrimSpace(filter.Status); v != "" {
		q = q.Where("status = ?", v)
	}
	if v := strings.TrimSpace(filter.Query); v != "" {
		like := "%" + strings.ToLower(v) + "%"
		q = q.Where("(LOWER(title) LIKE ? OR LOWER(tags) LIKE ?)", like, like)
	}
	if filter.Difficulty > 0 {
		q = q.Where("difficulty = ?", filter.Difficulty)
	}
	if filter.IsDynamic != nil {
		q = q.Where("is_dynamic = ?", *filter.IsDynamic)
	}
	if filter.ManagedByUserID > 0 {
		q = q.Where(`EXISTS (
			SELECT 1 FROM challenge_access_grants g
			WHERE g.challenge_id = challenges.id AND g.permission = 'manage' AND (
				(g.subject_type = 'user' AND g.subject_id = ?)
				OR (g.subject_type = 'team' AND g.subject_id = ?)
				OR (g.subject_type = 'group' AND g.subject_id IN (
					SELECT m.group_id FROM challenge_group_members m
					WHERE (m.subject_type = 'user' AND m.subject_id = ?)
					   OR (m.subject_type = 'team' AND m.subject_id = ?)
				))
			)
		)`, filter.ManagedByUserID, filter.ManagedByTeamID, filter.ManagedByUserID, filter.ManagedByTeamID)
	}
	if filter.SolvedBy > 0 && filter.Solved != nil {
		exists := "EXISTS (SELECT 1 FROM solves s WHERE s.challenge_id = challenges.id AND s.user_id = ?)"
		if *filter.Solved {
			q = q.Where(exists, filter.SolvedBy)
		} else {
			q = q.Where("NOT "+exists, filter.SolvedBy)
		}
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var cs []*domain.Challenge
	if err := q.
		Preload("Category").
		Order("created_at DESC").
		Offset((filter.Page - 1) * filter.PageSize).
		Limit(filter.PageSize).
		Find(&cs).Error; err != nil {
		return nil, 0, err
	}
	return cs, total, nil
}

func (r *challengeRepo) Update(ctx context.Context, c *domain.Challenge) error {
	return mapErr(r.db.WithContext(ctx).Save(c).Error)
}

func (r *challengeRepo) Delete(ctx context.Context, id uint) error {
	tx := r.db.WithContext(ctx).Delete(&domain.Challenge{}, id)
	if tx.Error != nil {
		return mapErr(tx.Error)
	}
	if tx.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *challengeRepo) CountSolves(ctx context.Context, challengeID uint) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).
		Model(&domain.Solve{}).
		Where("challenge_id = ?", challengeID).
		Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}
