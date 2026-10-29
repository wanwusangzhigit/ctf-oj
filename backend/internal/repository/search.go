package repository

import (
	"context"
	"strings"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
)

type searchRepo struct{ db *gorm.DB }

func NewSearchRepository(db *gorm.DB) domain.SearchRepository {
	return &searchRepo{db: db}
}

func (r *searchRepo) Search(ctx context.Context, q string, limit int) ([]*domain.SearchHit, error) {
	like := "%" + strings.ToLower(strings.TrimSpace(q)) + "%"
	if limit < 1 || limit > 20 {
		limit = 5
	}
	var out []*domain.SearchHit

	var challenges []struct {
		ID    uint
		Title string
		Tags  string
	}
	if err := r.db.WithContext(ctx).Raw(`
		SELECT id, title, tags FROM challenges
		WHERE is_published = TRUE AND (LOWER(title) LIKE ? OR LOWER(tags) LIKE ?)
		ORDER BY id DESC LIMIT ?`, like, like, limit).Scan(&challenges).Error; err != nil {
		return nil, err
	}
	for _, c := range challenges {
		out = append(out, &domain.SearchHit{Type: "challenge", ID: c.ID, Title: c.Title, Subtitle: c.Tags})
	}

	var users []struct {
		ID       uint
		Username string
		Bio      string
	}
	if err := r.db.WithContext(ctx).Raw(`
		SELECT id, username, bio FROM users
		WHERE is_banned = FALSE AND LOWER(username) LIKE ?
		ORDER BY score DESC, id ASC LIMIT ?`, like, limit).Scan(&users).Error; err != nil {
		return nil, err
	}
	for _, u := range users {
		out = append(out, &domain.SearchHit{Type: "user", ID: u.ID, Title: u.Username, Subtitle: u.Bio})
	}

	var teams []struct {
		ID   uint
		Name string
		Slug string
	}
	if err := r.db.WithContext(ctx).Raw(`
		SELECT id, name, slug FROM teams
		WHERE LOWER(name) LIKE ? OR LOWER(slug) LIKE ?
		ORDER BY score DESC, id ASC LIMIT ?`, like, like, limit).Scan(&teams).Error; err != nil {
		return nil, err
	}
	for _, t := range teams {
		out = append(out, &domain.SearchHit{Type: "team", ID: t.ID, Title: t.Name, Subtitle: "@" + t.Slug})
	}

	var anns []struct {
		ID    uint
		Title string
	}
	if err := r.db.WithContext(ctx).Raw(`
		SELECT id, title FROM announcements
		WHERE is_published = TRUE AND LOWER(title) LIKE ?
		ORDER BY created_at DESC LIMIT ?`, like, limit).Scan(&anns).Error; err != nil {
		return nil, err
	}
	for _, a := range anns {
		out = append(out, &domain.SearchHit{Type: "announcement", ID: a.ID, Title: a.Title})
	}
	return out, nil
}
