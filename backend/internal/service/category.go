package service

import (
	"context"

	"github.com/ctf-oj/backend/internal/domain"
)

type CategoryService struct {
	categories domain.CategoryRepository
}

func NewCategoryService(c domain.CategoryRepository) *CategoryService {
	return &CategoryService{categories: c}
}

func (s *CategoryService) Create(ctx context.Context, c *domain.Category) error {
	return s.categories.Create(ctx, c)
}

func (s *CategoryService) Update(ctx context.Context, c *domain.Category) error {
	return s.categories.Update(ctx, c)
}

func (s *CategoryService) Delete(ctx context.Context, id uint) error {
	return s.categories.Delete(ctx, id)
}

func (s *CategoryService) List(ctx context.Context) ([]*domain.Category, error) {
	return s.categories.List(ctx)
}

func (s *CategoryService) Find(ctx context.Context, id uint) (*domain.Category, error) {
	return s.categories.FindByID(ctx, id)
}
