package repository

import (
	"context"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
)

type categoryRepo struct {
	db *gorm.DB
}

func NewCategoryRepository(db *gorm.DB) domain.CategoryRepository {
	return &categoryRepo{db: db}
}

func (r *categoryRepo) Create(ctx context.Context, c *domain.Category) error {
	return mapErr(r.db.WithContext(ctx).Create(c).Error)
}

func (r *categoryRepo) FindByID(ctx context.Context, id uint) (*domain.Category, error) {
	var c domain.Category
	if err := r.db.WithContext(ctx).First(&c, id).Error; err != nil {
		return nil, mapErr(err)
	}
	return &c, nil
}

func (r *categoryRepo) FindBySlug(ctx context.Context, slug string) (*domain.Category, error) {
	var c domain.Category
	if err := r.db.WithContext(ctx).Where("slug = ?", slug).First(&c).Error; err != nil {
		return nil, mapErr(err)
	}
	return &c, nil
}

func (r *categoryRepo) List(ctx context.Context) ([]*domain.Category, error) {
	var cs []*domain.Category
	if err := r.db.WithContext(ctx).
		Order("sort_order ASC, id ASC").
		Find(&cs).Error; err != nil {
		return nil, err
	}
	return cs, nil
}

func (r *categoryRepo) Update(ctx context.Context, c *domain.Category) error {
	return mapErr(r.db.WithContext(ctx).Save(c).Error)
}

func (r *categoryRepo) Delete(ctx context.Context, id uint) error {
	tx := r.db.WithContext(ctx).Delete(&domain.Category{}, id)
	if tx.Error != nil {
		return mapErr(tx.Error)
	}
	if tx.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}
