package repository

import (
	"context"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/ctf-oj/backend/internal/domain"
)

type competitionRepo struct{ db *gorm.DB }

func NewCompetitionRepository(db *gorm.DB) domain.CompetitionRepository {
	return &competitionRepo{db: db}
}

func (r *competitionRepo) Create(ctx context.Context, c *domain.Competition) error {
	return mapErr(r.db.WithContext(ctx).Create(c).Error)
}

func (r *competitionRepo) FindByID(ctx context.Context, id uint) (*domain.Competition, error) {
	var c domain.Competition
	if err := r.db.WithContext(ctx).Preload("Challenges").First(&c, "id = ?", id).Error; err != nil {
		return nil, mapErr(err)
	}
	return &c, nil
}

func (r *competitionRepo) FindActive(ctx context.Context) (*domain.Competition, error) {
	var c domain.Competition
	if err := r.db.WithContext(ctx).
		Preload("Challenges").
		Where("is_active = ?", true).
		Order("id DESC").
		First(&c).Error; err != nil {
		return nil, mapErr(err)
	}
	return &c, nil
}

func (r *competitionRepo) List(ctx context.Context, page, pageSize int) ([]*domain.Competition, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 200 {
		pageSize = 50
	}
	var total int64
	if err := r.db.WithContext(ctx).Model(&domain.Competition{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var out []*domain.Competition
	if err := r.db.WithContext(ctx).
		Preload("Challenges").
		Order("id DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&out).Error; err != nil {
		return nil, 0, err
	}
	return out, total, nil
}

func (r *competitionRepo) Update(ctx context.Context, c *domain.Competition) error {
	return mapErr(r.db.WithContext(ctx).Save(c).Error)
}

func (r *competitionRepo) Delete(ctx context.Context, id uint) error {
	return mapErr(r.db.WithContext(ctx).Delete(&domain.Competition{}, "id = ?", id).Error)
}

// DeactivateAll is used before activating a new competition to enforce
// the "at most one active competition" invariant at the data layer.
func (r *competitionRepo) DeactivateAll(ctx context.Context) error {
	return r.db.WithContext(ctx).
		Model(&domain.Competition{}).
		Where("is_active = ?", true).
		Update("is_active", false).Error
}

func (r *competitionRepo) SetChallenges(ctx context.Context, competitionID uint, challengeIDs []uint) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("DELETE FROM competition_challenges WHERE competition_id = ?", competitionID).Error; err != nil {
			return err
		}
		if len(challengeIDs) == 0 {
			return nil
		}
		rows := make([]map[string]interface{}, 0, len(challengeIDs))
		for i, id := range challengeIDs {
			rows = append(rows, map[string]interface{}{
				"competition_id": competitionID,
				"challenge_id":   id,
				"sort_order":     i,
			})
		}
		return tx.Table("competition_challenges").
			Clauses(clause.OnConflict{DoNothing: true}).
			Create(rows).Error
	})
}

func (r *competitionRepo) Scoreboard(ctx context.Context, competitionID uint, start, end time.Time, cutoff *time.Time, page, pageSize int) ([]*domain.User, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	compCutoff := ""
	legacyCutoff := ""
	if cutoff != nil {
		compCutoff = " AND cs.solved_at <= ?"
		legacyCutoff = " AND s.solved_at <= ?"
	}
	entries := `WITH entries AS (
		SELECT cs.user_id, cs.challenge_id, cs.score, cs.solved_at, cs.id
		FROM competition_solves cs
		WHERE cs.competition_id = ?` + compCutoff + `
		  AND NOT EXISTS (
		      SELECT 1 FROM competition_registrations cr
		      WHERE cr.competition_id = ? AND cr.user_id = cs.user_id AND cr.score_excluded = true
		  )
		UNION ALL
		SELECT s.user_id, s.challenge_id, s.score, s.solved_at, s.id
		FROM solves s
		WHERE s.solved_at >= ? AND s.solved_at <= ?` + legacyCutoff + `
		  AND (NOT EXISTS (SELECT 1 FROM competition_challenges cc WHERE cc.competition_id = ?)
		       OR s.challenge_id IN (SELECT cc.challenge_id FROM competition_challenges cc WHERE cc.competition_id = ?))
		  AND NOT EXISTS (
		      SELECT 1 FROM competition_solves cs2
		      WHERE cs2.competition_id = ? AND cs2.user_id = s.user_id AND cs2.challenge_id = s.challenge_id
		  )
		  AND NOT EXISTS (
		      SELECT 1 FROM competition_registrations cr
		      WHERE cr.competition_id = ? AND cr.user_id = s.user_id AND cr.score_excluded = true
		  )
	)`
	args := []interface{}{competitionID}
	if cutoff != nil {
		args = append(args, *cutoff)
	}
	args = append(args, competitionID, start, end)
	if cutoff != nil {
		args = append(args, *cutoff)
	}
	args = append(args, competitionID, competitionID, competitionID, competitionID)

	var total int64
	if err := r.db.WithContext(ctx).Raw(entries+`
		SELECT COUNT(DISTINCT e.user_id)
		FROM entries e
		JOIN users u ON u.id = e.user_id
		WHERE u.score_excluded = false`, args...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}

	var users []*domain.User
	err := r.db.WithContext(ctx).Raw(entries+`
		SELECT u.id, u.username, u.bio, u.role, u.created_at, u.updated_at,
		       COALESCE(SUM(e.score), 0) AS score
		FROM entries e
		JOIN users u ON u.id = e.user_id
		WHERE u.score_excluded = false
		GROUP BY u.id
		ORDER BY score DESC, u.id ASC
		LIMIT ? OFFSET ?`, append(args, pageSize, (page-1)*pageSize)...).Scan(&users).Error
	if err != nil {
		return nil, 0, err
	}
	return users, total, nil
}

func (r *competitionRepo) TeamScoreboard(ctx context.Context, competitionID uint, start, end time.Time, cutoff *time.Time, page, pageSize int) ([]*domain.TeamScore, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	compCutoff := ""
	legacyCutoff := ""
	if cutoff != nil {
		compCutoff = " AND cs.solved_at <= ?"
		legacyCutoff = " AND s.solved_at <= ?"
	}
	entries := `WITH entries AS (
		SELECT cs.user_id, cs.challenge_id, cs.score, cs.solved_at, cs.id
		FROM competition_solves cs
		WHERE cs.competition_id = ?` + compCutoff + `
		  AND NOT EXISTS (
		      SELECT 1 FROM competition_registrations cr
		      WHERE cr.competition_id = ? AND cr.user_id = cs.user_id AND cr.score_excluded = true
		  )
		UNION ALL
		SELECT s.user_id, s.challenge_id, s.score, s.solved_at, s.id
		FROM solves s
		WHERE s.solved_at >= ? AND s.solved_at <= ?` + legacyCutoff + `
		  AND (NOT EXISTS (SELECT 1 FROM competition_challenges cc WHERE cc.competition_id = ?)
		       OR s.challenge_id IN (SELECT cc.challenge_id FROM competition_challenges cc WHERE cc.competition_id = ?))
		  AND NOT EXISTS (
		      SELECT 1 FROM competition_solves cs2
		      WHERE cs2.competition_id = ? AND cs2.user_id = s.user_id AND cs2.challenge_id = s.challenge_id
		  )
		  AND NOT EXISTS (
		      SELECT 1 FROM competition_registrations cr
		      WHERE cr.competition_id = ? AND cr.user_id = s.user_id AND cr.score_excluded = true
		  )
	)`
	args := []interface{}{competitionID}
	if cutoff != nil {
		args = append(args, *cutoff)
	}
	args = append(args, competitionID, start, end)
	if cutoff != nil {
		args = append(args, *cutoff)
	}
	args = append(args, competitionID, competitionID, competitionID, competitionID)

	var total int64
	if err := r.db.WithContext(ctx).Raw(entries+`
		SELECT COUNT(DISTINCT t.id)
		FROM entries e
		JOIN users u ON u.id = e.user_id
		JOIN team_members tm ON tm.user_id = e.user_id
		JOIN teams t ON t.id = tm.team_id
		WHERE u.score_excluded = false`, args...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}

	var out []*domain.TeamScore
	err := r.db.WithContext(ctx).Raw(entries+`
		SELECT t.id, t.name, t.slug, COALESCE(SUM(e.score), 0) AS score
		FROM entries e
		JOIN users u ON u.id = e.user_id
		JOIN team_members tm ON tm.user_id = e.user_id
		JOIN teams t ON t.id = tm.team_id
		WHERE u.score_excluded = false
		GROUP BY t.id
		ORDER BY score DESC, t.id ASC
		LIMIT ? OFFSET ?`, append(args, pageSize, (page-1)*pageSize)...).Scan(&out).Error
	if err != nil {
		return nil, 0, err
	}
	return out, total, nil
}
