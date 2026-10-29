package repository

import (
	"context"
	"time"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
)

type teamRepo struct {
	db *gorm.DB
}

func NewTeamRepository(db *gorm.DB) domain.TeamRepository {
	return &teamRepo{db: db}
}

func (r *teamRepo) Create(ctx context.Context, t *domain.Team) error {
	return mapErr(r.db.WithContext(ctx).Create(t).Error)
}

func (r *teamRepo) FindByID(ctx context.Context, id uint) (*domain.Team, error) {
	var t domain.Team
	if err := r.db.WithContext(ctx).
		Preload("Owner").
		Preload("Members.User").
		First(&t, id).Error; err != nil {
		return nil, mapErr(err)
	}
	return &t, nil
}

func (r *teamRepo) FindBySlug(ctx context.Context, slug string) (*domain.Team, error) {
	var t domain.Team
	if err := r.db.WithContext(ctx).
		Preload("Owner").
		Preload("Members.User").
		Where("slug = ?", slug).First(&t).Error; err != nil {
		return nil, mapErr(err)
	}
	return &t, nil
}

func (r *teamRepo) FindByInviteCode(ctx context.Context, code string) (*domain.Team, error) {
	var t domain.Team
	if err := r.db.WithContext(ctx).Where("invite_code = ?", code).First(&t).Error; err != nil {
		return nil, mapErr(err)
	}
	return &t, nil
}

func (r *teamRepo) List(ctx context.Context, page, pageSize int) ([]*domain.Team, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	var total int64
	if err := r.db.WithContext(ctx).Model(&domain.Team{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var ts []*domain.Team
	if err := r.db.WithContext(ctx).
		Preload("Owner").
		Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&ts).Error; err != nil {
		return nil, 0, err
	}
	return ts, total, nil
}

func (r *teamRepo) ListScoreboard(ctx context.Context, page, pageSize int) ([]*domain.Team, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	var total int64
	if err := r.db.WithContext(ctx).Model(&domain.Team{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var ts []*domain.Team
	if err := r.db.WithContext(ctx).
		Order("score DESC, id ASC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&ts).Error; err != nil {
		return nil, 0, err
	}
	return ts, total, nil
}

func (r *teamRepo) Update(ctx context.Context, t *domain.Team) error {
	return mapErr(r.db.WithContext(ctx).Save(t).Error)
}

func (r *teamRepo) Delete(ctx context.Context, id uint) error {
	tx := r.db.WithContext(ctx).Delete(&domain.Team{}, id)
	if tx.Error != nil {
		return mapErr(tx.Error)
	}
	if tx.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *teamRepo) AddMember(ctx context.Context, m *domain.TeamMember) error {
	return mapErr(r.db.WithContext(ctx).Create(m).Error)
}

func (r *teamRepo) RemoveMember(ctx context.Context, teamID, userID uint) error {
	tx := r.db.WithContext(ctx).
		Where("team_id = ? AND user_id = ?", teamID, userID).
		Delete(&domain.TeamMember{})
	if tx.Error != nil {
		return tx.Error
	}
	if tx.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *teamRepo) ListMembers(ctx context.Context, teamID uint) ([]*domain.TeamMember, error) {
	var ms []*domain.TeamMember
	if err := r.db.WithContext(ctx).
		Preload("User").
		Where("team_id = ?", teamID).
		Order("joined_at ASC").
		Find(&ms).Error; err != nil {
		return nil, err
	}
	return ms, nil
}

func (r *teamRepo) FindMembership(ctx context.Context, userID uint) (*domain.TeamMember, error) {
	var m domain.TeamMember
	if err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		First(&m).Error; err != nil {
		return nil, mapErr(err)
	}
	return &m, nil
}

// SumMemberScoresUntil sums each member's solves up to cutoff. Used by the
// frozen team scoreboard.
func (r *teamRepo) SumMemberScoresUntil(ctx context.Context, teamID uint, cutoff time.Time) (int, error) {
	var sum int
	err := r.db.WithContext(ctx).
		Table("users").
		Select(`COALESCE(SUM(users.score), 0) - COALESCE(SUM(
			(SELECT SUM(s.score) FROM solves s WHERE s.user_id = users.id AND s.solved_at > ?)
		), 0)`, cutoff).
		Joins("JOIN team_members tm ON tm.user_id = users.id").
		Where("tm.team_id = ? AND users.score_excluded = ?", teamID, false).
		Scan(&sum).Error
	return sum, err
}
