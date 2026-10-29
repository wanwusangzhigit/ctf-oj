package service

import (
	"context"
	"strings"

	"github.com/ctf-oj/backend/internal/domain"
)

type SearchService struct{ repo domain.SearchRepository }

func NewSearchService(repo domain.SearchRepository) *SearchService {
	return &SearchService{repo: repo}
}

func (s *SearchService) Search(ctx context.Context, query string, limit int) ([]*domain.SearchHit, error) {
	query = strings.TrimSpace(query)
	if len(query) < 1 {
		return []*domain.SearchHit{}, nil
	}
	if len(query) > 64 {
		query = query[:64]
	}
	if limit < 1 || limit > 20 {
		limit = 5
	}
	return s.repo.Search(ctx, query, limit)
}
