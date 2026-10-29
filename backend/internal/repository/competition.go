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

func (r *competitionRepo) Scoreboard(ctx context.Context, competitionID uint, start, end time.Time, mode string, page, pageSize int) ([]*domain.User, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	entries := `WITH entries AS (
		SELECT cs.user_id, cs.challenge_id, cs.score, cs.solved_at, cs.id
		FROM competition_solves cs
		WHERE cs.competition_id = ?
		UNION ALL
		SELECT s.user_id, s.challenge_id, s.score, s.solved_at, s.id
		FROM solves s
		WHERE s.solved_at >= ? AND s.solved_at <= ?
		  AND (NOT EXISTS (SELECT 1 FROM competition_challenges cc WHERE cc.competition_id = ?)
		       OR s.challenge_id IN (SELECT cc.challenge_id FROM competition_challenges cc WHERE cc.competition_id = ?))
		  AND NOT EXISTS (
		      SELECT 1 FROM competition_solves cs2
		      WHERE cs2.competition_id = ? AND cs2.user_id = s.user_id AND cs2.challenge_id = s.challenge_id
		  )
	)`
	entryArgs := []interface{}{competitionID, start, end, competitionID, competitionID, competitionID}

	var total int64
	if err := r.db.WithContext(ctx).Raw(entries+`
		SELECT COUNT(DISTINCT e.user_id)
		FROM entries e
		JOIN users u ON u.id = e.user_id
		WHERE u.score_excluded = false`, entryArgs...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}

	var users []*domain.User
	var err error
	switch mode {
	case "fixed":
		err = r.db.WithContext(ctx).Raw(entries+`
			SELECT u.id, u.username, u.bio, u.role, u.created_at, u.updated_at,
			       COALESCE(SUM(c.base_score), 0) AS score
			FROM entries e
			JOIN users u ON u.id = e.user_id
			JOIN challenges c ON c.id = e.challenge_id
			WHERE u.score_excluded = false
			GROUP BY u.id
			ORDER BY score DESC, u.id ASC
			LIMIT ? OFFSET ?`, append(entryArgs, pageSize, (page-1)*pageSize)...).Scan(&users).Error
	case "three_blood":
		err = r.db.WithContext(ctx).Raw(entries+`, ranked AS (
			SELECT e.*, ROW_NUMBER() OVER (PARTITION BY e.challenge_id ORDER BY e.solved_at ASC, e.id ASC) AS rn
			FROM entries e
		)
			SELECT u.id, u.username, u.bio, u.role, u.created_at, u.updated_at,
			       COALESCE(SUM(c.base_score + CASE r.rn
			           WHEN 1 THEN c.base_score * 10 / 100
			           WHEN 2 THEN c.base_score * 5 / 100
			           WHEN 3 THEN c.base_score * 2 / 100
			           ELSE 0 END), 0) AS score
			FROM ranked r
			JOIN users u ON u.id = r.user_id
			JOIN challenges c ON c.id = r.challenge_id
			WHERE u.score_excluded = false
			GROUP BY u.id
			ORDER BY score DESC, u.id ASC
			LIMIT ? OFFSET ?`, append(entryArgs, pageSize, (page-1)*pageSize)...).Scan(&users).Error
	default:
		err = r.db.WithContext(ctx).Raw(entries+`
			SELECT u.id, u.username, u.bio, u.role, u.created_at, u.updated_at,
			       COALESCE(SUM(e.score), 0) AS score
			FROM entries e
			JOIN users u ON u.id = e.user_id
			WHERE u.score_excluded = false
			GROUP BY u.id
			ORDER BY score DESC, u.id ASC
			LIMIT ? OFFSET ?`, append(entryArgs, pageSize, (page-1)*pageSize)...).Scan(&users).Error
	}
	if err != nil {
		return nil, 0, err
	}
	return users, total, nil
}

func (r *competitionRepo) TeamScoreboard(ctx context.Context, competitionID uint, start, end time.Time, mode string, page, pageSize int) ([]*domain.TeamScore, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	entries := `WITH entries AS (
		SELECT cs.user_id, cs.challenge_id, cs.score, cs.solved_at, cs.id
		FROM competition_solves cs
		WHERE cs.competition_id = ?
		UNION ALL
		SELECT s.user_id, s.challenge_id, s.score, s.solved_at, s.id
		FROM solves s
		WHERE s.solved_at >= ? AND s.solved_at <= ?
		  AND (NOT EXISTS (SELECT 1 FROM competition_challenges cc WHERE cc.competition_id = ?)
		       OR s.challenge_id IN (SELECT cc.challenge_id FROM competition_challenges cc WHERE cc.competition_id = ?))
		  AND NOT EXISTS (
		      SELECT 1 FROM competition_solves cs2
		      WHERE cs2.competition_id = ? AND cs2.user_id = s.user_id AND cs2.challenge_id = s.challenge_id
		  )
	)`
	entryArgs := []interface{}{competitionID, start, end, competitionID, competitionID, competitionID}

	var total int64
	if err := r.db.WithContext(ctx).Raw(entries+`
		SELECT COUNT(DISTINCT t.id)
		FROM entries e
		JOIN users u ON u.id = e.user_id
		JOIN team_members tm ON tm.user_id = e.user_id
		JOIN teams t ON t.id = tm.team_id
		WHERE u.score_excluded = false`, entryArgs...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}

	var out []*domain.TeamScore
	var err error
	switch mode {
	case "fixed":
		err = r.db.WithContext(ctx).Raw(entries+`
			SELECT t.id, t.name, t.slug, COALESCE(SUM(c.base_score), 0) AS score
			FROM entries e
			JOIN users u ON u.id = e.user_id
			JOIN team_members tm ON tm.user_id = e.user_id
			JOIN teams t ON t.id = tm.team_id
			JOIN challenges c ON c.id = e.challenge_id
			WHERE u.score_excluded = false
			GROUP BY t.id
			ORDER BY score DESC, t.id ASC
			LIMIT ? OFFSET ?`, append(entryArgs, pageSize, (page-1)*pageSize)...).Scan(&out).Error
	case "three_blood":
		err = r.db.WithContext(ctx).Raw(entries+`, ranked AS (
			SELECT e.*, ROW_NUMBER() OVER (PARTITION BY e.challenge_id ORDER BY e.solved_at ASC, e.id ASC) AS rn
			FROM entries e
		)
			SELECT t.id, t.name, t.slug,
			       COALESCE(SUM(c.base_score + CASE r.rn
			           WHEN 1 THEN c.base_score * 10 / 100
			           WHEN 2 THEN c.base_score * 5 / 100
			           WHEN 3 THEN c.base_score * 2 / 100
			           ELSE 0 END), 0) AS score
			FROM ranked r
			JOIN users u ON u.id = r.user_id
			JOIN team_members tm ON tm.user_id = r.user_id
			JOIN teams t ON t.id = tm.team_id
			JOIN challenges c ON c.id = r.challenge_id
			WHERE u.score_excluded = false
			GROUP BY t.id
			ORDER BY score DESC, t.id ASC
			LIMIT ? OFFSET ?`, append(entryArgs, pageSize, (page-1)*pageSize)...).Scan(&out).Error
	default:
		err = r.db.WithContext(ctx).Raw(entries+`
			SELECT t.id, t.name, t.slug, COALESCE(SUM(e.score), 0) AS score
			FROM entries e
			JOIN users u ON u.id = e.user_id
			JOIN team_members tm ON tm.user_id = e.user_id
			JOIN teams t ON t.id = tm.team_id
			WHERE u.score_excluded = false
			GROUP BY t.id
			ORDER BY score DESC, t.id ASC
			LIMIT ? OFFSET ?`, append(entryArgs, pageSize, (page-1)*pageSize)...).Scan(&out).Error
	}
	if err != nil {
		return nil, 0, err
	}
	return out, total, nil
}
