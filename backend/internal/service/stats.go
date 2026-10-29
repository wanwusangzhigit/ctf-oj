package service

import (
	"context"
	"time"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
)

type StatsService struct {
	db *gorm.DB
}

func NewStatsService(db *gorm.DB) *StatsService {
	return &StatsService{db: db}
}

type Overview struct {
	TotalUsers       int64 `json:"totalUsers"`
	ActiveUsers      int64 `json:"activeUsers"`
	TotalChallenges  int64 `json:"totalChallenges"`
	PublishedCount   int64 `json:"publishedCount"`
	TotalSolves      int64 `json:"totalSolves"`
	TotalSubmissions int64 `json:"totalSubmissions"`
	RunningInstances int64 `json:"runningInstances"`
	TotalTeams       int64 `json:"totalTeams"`
}

func (s *StatsService) Overview(ctx context.Context) (*Overview, error) {
	o := &Overview{}
	if err := s.db.WithContext(ctx).Model(&domain.User{}).Count(&o.TotalUsers).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&domain.User{}).Where("is_banned = ?", false).Count(&o.ActiveUsers).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&domain.Challenge{}).Count(&o.TotalChallenges).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&domain.Challenge{}).Where("is_published = ?", true).Count(&o.PublishedCount).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&domain.Solve{}).Count(&o.TotalSolves).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&domain.Submission{}).Count(&o.TotalSubmissions).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&domain.Instance{}).Where("status = ?", domain.InstanceRunning).Count(&o.RunningInstances).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&domain.Team{}).Count(&o.TotalTeams).Error; err != nil {
		return nil, err
	}
	return o, nil
}

type CategoryStat struct {
	CategoryID   uint   `json:"categoryId"`
	CategoryName string `json:"categoryName"`
	Slug         string `json:"slug"`
	Count        int64  `json:"count"`
	Solves       int64  `json:"solves"`
}

func (s *StatsService) ByCategory(ctx context.Context) ([]*CategoryStat, error) {
	var out []*CategoryStat
	err := s.db.WithContext(ctx).Raw(`
		SELECT c.id AS category_id,
		       c.name AS category_name,
		       c.slug AS slug,
		       COUNT(DISTINCT ch.id) AS count,
		       COUNT(DISTINCT sol.id) AS solves
		FROM categories c
		LEFT JOIN challenges ch ON ch.category_id = c.id AND ch.is_published = true
		LEFT JOIN solves sol ON sol.challenge_id = ch.id
		GROUP BY c.id, c.name, c.slug
		ORDER BY c.sort_order ASC, c.id ASC
	`).Scan(&out).Error
	if err != nil {
		return nil, err
	}
	return out, nil
}

type TrendPoint struct {
	Date   string `json:"date"`
	Solves int64  `json:"solves"`
}

func (s *StatsService) SolveTrend(ctx context.Context, days int) ([]*TrendPoint, error) {
	if days <= 0 || days > 365 {
		days = 30
	}
	start := time.Now().AddDate(0, 0, -days).Truncate(24 * time.Hour)
	var out []*TrendPoint
	err := s.db.WithContext(ctx).Raw(`
		SELECT to_char(date_trunc('day', solved_at), 'YYYY-MM-DD') AS date,
		       COUNT(*) AS solves
		FROM solves
		WHERE solved_at >= ?
		GROUP BY date_trunc('day', solved_at)
		ORDER BY date ASC
	`, start).Scan(&out).Error
	if err != nil {
		return nil, err
	}
	return out, nil
}

type RecentSolve struct {
	Username      string    `json:"username"`
	ChallengeID   uint      `json:"challengeId"`
	ChallengeName string    `json:"challengeName"`
	Score         int       `json:"score"`
	IsFirstBlood  bool      `json:"isFirstBlood"`
	SolvedAt      time.Time `json:"solvedAt"`
}

func (s *StatsService) RecentSolves(ctx context.Context, limit int) ([]*RecentSolve, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	var out []*RecentSolve
	err := s.db.WithContext(ctx).Raw(`
		SELECT u.username AS username,
		       c.id AS challenge_id,
		       c.title AS challenge_name,
		       sol.score AS score,
		       sol.is_first_blood AS is_first_blood,
		       sol.solved_at AS solved_at
		FROM solves sol
		JOIN users u ON u.id = sol.user_id
		JOIN challenges c ON c.id = sol.challenge_id
		ORDER BY sol.solved_at DESC
		LIMIT ?
	`, limit).Scan(&out).Error
	if err != nil {
		return nil, err
	}
	return out, nil
}

type SubmissionTrendPoint struct {
	Date        string `json:"date"`
	Submissions int64  `json:"submissions"`
}

func (s *StatsService) SubmissionTrend(ctx context.Context, days int) ([]*SubmissionTrendPoint, error) {
	if days <= 0 || days > 365 {
		days = 30
	}
	start := time.Now().AddDate(0, 0, -days).Truncate(24 * time.Hour)
	var out []*SubmissionTrendPoint
	err := s.db.WithContext(ctx).Raw(`
		SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date,
		       COUNT(*) AS submissions
		FROM submissions
		WHERE created_at >= ?
		GROUP BY date_trunc('day', created_at)
		ORDER BY date ASC
	`, start).Scan(&out).Error
	if err != nil {
		return nil, err
	}
	return out, nil
}

type PodiumEntry struct {
	Rank     int       `json:"rank"`
	Username string    `json:"username"`
	UserID   uint      `json:"userId"`
	Score    int       `json:"score"`
	SolvedAt time.Time `json:"solvedAt"`
}

// Podium returns the first three solvers of a challenge, ranked by time.
func (s *StatsService) Podium(ctx context.Context, challengeID uint) ([]*PodiumEntry, error) {
	var out []*PodiumEntry
	err := s.db.WithContext(ctx).Raw(`
		SELECT ROW_NUMBER() OVER (ORDER BY sol.solved_at ASC, sol.id ASC) AS rank,
		       u.username AS username,
		       u.id AS user_id,
		       sol.score AS score,
		       sol.solved_at AS solved_at
		FROM solves sol
		JOIN users u ON u.id = sol.user_id
		WHERE sol.challenge_id = ?
		ORDER BY sol.solved_at ASC, sol.id ASC
		LIMIT 3
	`, challengeID).Scan(&out).Error
	if err != nil {
		return nil, err
	}
	return out, nil
}

// FirstBloods lists the most recent first-blood solves across all challenges.
func (s *StatsService) FirstBloods(ctx context.Context, limit int) ([]*RecentSolve, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	var out []*RecentSolve
	err := s.db.WithContext(ctx).Raw(`
		SELECT u.username AS username,
		       c.id AS challenge_id,
		       c.title AS challenge_name,
		       sol.score AS score,
		       sol.is_first_blood AS is_first_blood,
		       sol.solved_at AS solved_at
		FROM solves sol
		JOIN users u ON u.id = sol.user_id
		JOIN challenges c ON c.id = sol.challenge_id
		WHERE sol.is_first_blood = true
		ORDER BY sol.solved_at DESC
		LIMIT ?
	`, limit).Scan(&out).Error
	if err != nil {
		return nil, err
	}
	return out, nil
}

type ActivityDay struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

// UserActivity returns daily solve counts for the last N days.
func (s *StatsService) UserActivity(ctx context.Context, userID uint, days int) ([]*ActivityDay, error) {
	if days <= 0 || days > 366 {
		days = 365
	}
	start := time.Now().AddDate(0, 0, -days).Truncate(24 * time.Hour)
	var out []*ActivityDay
	err := s.db.WithContext(ctx).Raw(`
		SELECT to_char(date_trunc('day', solved_at), 'YYYY-MM-DD') AS date,
		       COUNT(*) AS count
		FROM solves
		WHERE user_id = ? AND solved_at >= ?
		GROUP BY date_trunc('day', solved_at)
		ORDER BY date ASC
	`, userID, start).Scan(&out).Error
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (s *StatsService) IsProfilePrivate(ctx context.Context, userID uint) (bool, error) {
	var visibility string
	err := s.db.WithContext(ctx).
		Model(&domain.User{}).
		Select("profile_visibility").
		Where("id = ?", userID).
		Scan(&visibility).Error
	if err != nil {
		return false, err
	}
	return visibility == "private", nil
}

type Achievement struct {
	Key         string `json:"key"`
	Label       string `json:"label"`
	Description string `json:"description"`
	Progress    int64  `json:"progress"`
	Target      int64  `json:"target"`
	Earned      bool   `json:"earned"`
}

// UserAchievements derives badges from existing activity — no extra table.
func (s *StatsService) UserAchievements(ctx context.Context, userID uint) ([]*Achievement, error) {
	var solves, firstBloods, writeups, discussions int64
	db := s.db.WithContext(ctx)
	if err := db.Model(&domain.Solve{}).Where("user_id = ?", userID).Count(&solves).Error; err != nil {
		return nil, err
	}
	if err := db.Model(&domain.Solve{}).Where("user_id = ? AND is_first_blood = ?", userID, true).Count(&firstBloods).Error; err != nil {
		return nil, err
	}
	if err := db.Model(&domain.Writeup{}).Where("user_id = ?", userID).Count(&writeups).Error; err != nil {
		return nil, err
	}
	if err := db.Model(&domain.Discussion{}).Where("user_id = ?", userID).Count(&discussions).Error; err != nil {
		return nil, err
	}
	specs := []struct {
		key, label, desc string
		progress, target int64
	}{
		{"first_solve", "初次破题", "解出第一道题", solves, 1},
		{"solver_10", "稳定输出", "累计解出 10 道题", solves, 10},
		{"solver_50", "百炼成钢", "累计解出 50 道题", solves, 50},
		{"first_blood", "一血", "拿到一次首解", firstBloods, 1},
		{"writer", "记录者", "发布一篇 Writeup", writeups, 1},
		{"voice", "发声", "发表一条讨论", discussions, 1},
	}
	out := make([]*Achievement, 0, len(specs))
	for _, sp := range specs {
		out = append(out, &Achievement{
			Key: sp.key, Label: sp.label, Description: sp.desc,
			Progress: sp.progress, Target: sp.target, Earned: sp.progress >= sp.target,
		})
	}
	return out, nil
}
