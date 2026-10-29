package repository

import (
	"context"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
)

type userRepo struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) domain.UserRepository {
	return &userRepo{db: db}
}

func (r *userRepo) Create(ctx context.Context, u *domain.User) error {
	if err := r.db.WithContext(ctx).Create(u).Error; err != nil {
		return mapErr(err)
	}
	return nil
}

func (r *userRepo) FindByID(ctx context.Context, id uint) (*domain.User, error) {
	var u domain.User
	if err := r.db.WithContext(ctx).First(&u, id).Error; err != nil {
		return nil, mapErr(err)
	}
	return &u, nil
}

func (r *userRepo) FindByUsername(ctx context.Context, username string) (*domain.User, error) {
	var u domain.User
	if err := r.db.WithContext(ctx).Where("username = ?", username).First(&u).Error; err != nil {
		return nil, mapErr(err)
	}
	return &u, nil
}

func (r *userRepo) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
	var u domain.User
	if err := r.db.WithContext(ctx).Where("email = ?", email).First(&u).Error; err != nil {
		return nil, mapErr(err)
	}
	return &u, nil
}

func (r *userRepo) Update(ctx context.Context, u *domain.User) error {
	if err := r.db.WithContext(ctx).Save(u).Error; err != nil {
		return mapErr(err)
	}
	return nil
}

func (r *userRepo) List(ctx context.Context, page, pageSize int) ([]*domain.User, int64, error) {
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
	if err := r.db.WithContext(ctx).Model(&domain.User{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := r.db.WithContext(ctx).
		Order("score DESC, id ASC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&users).Error; err != nil {
		return nil, 0, err
	}
	return users, total, nil
}

func (r *userRepo) Search(ctx context.Context, filter domain.UserFilter, page, pageSize int) ([]*domain.User, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	q := r.db.WithContext(ctx).Model(&domain.User{})
	if filter.Query != "" {
		like := "%" + strings.ToLower(strings.TrimSpace(filter.Query)) + "%"
		q = q.Where("LOWER(username) LIKE ? OR LOWER(email) LIKE ?", like, like)
	}
	if filter.Role != "" {
		q = q.Where("role = ?", filter.Role)
	}
	if filter.Banned != nil {
		q = q.Where("is_banned = ?", *filter.Banned)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var us []*domain.User
	if err := q.Order("id ASC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&us).Error; err != nil {
		return nil, 0, err
	}
	return us, total, nil
}

func (r *userRepo) UpdateScore(ctx context.Context, userID uint, delta int) error {
	tx := r.db.WithContext(ctx).
		Model(&domain.User{}).
		Where("id = ?", userID).
		UpdateColumn("score", gorm.Expr("score + ?", delta))
	if tx.Error != nil {
		return tx.Error
	}
	if tx.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *userRepo) SetBanned(ctx context.Context, id uint, banned bool, reason string) error {
	values := map[string]any{
		"is_banned":     banned,
		"banned_reason": reason,
	}
	if banned {
		values["banned_at"] = time.Now()
	} else {
		values["banned_at"] = nil
	}
	tx := r.db.WithContext(ctx).
		Model(&domain.User{}).
		Where("id = ?", id).
		Updates(values)
	if tx.Error != nil {
		return tx.Error
	}
	if tx.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *userRepo) SetRole(ctx context.Context, id uint, role domain.Role) error {
	tx := r.db.WithContext(ctx).
		Model(&domain.User{}).
		Where("id = ?", id).
		Update("role", string(role))
	if tx.Error != nil {
		return tx.Error
	}
	if tx.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func mapErr(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.ErrNotFound
	}
	msg := err.Error()
	if strings.Contains(msg, "SQLSTATE 23503") || strings.Contains(msg, "SQLSTATE 23505") {
		return domain.ErrConflict
	}
	return err
}

func (r *userRepo) SetScoreExcluded(ctx context.Context, id uint, excluded bool) error {
	res := r.db.WithContext(ctx).
		Model(&domain.User{}).
		Where("id = ?", id).
		Update("score_excluded", excluded)
	if res.Error != nil {
		return mapErr(res.Error)
	}
	if res.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}
