package repository

import (
	"context"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
)

type emailVerificationRepo struct{ db *gorm.DB }

func NewEmailVerificationRepository(db *gorm.DB) domain.EmailVerificationRepository {
	return &emailVerificationRepo{db: db}
}

func (r *emailVerificationRepo) Create(ctx context.Context, ev *domain.EmailVerification) error {
	return mapErr(r.db.WithContext(ctx).Create(ev).Error)
}

func (r *emailVerificationRepo) FindByToken(ctx context.Context, token string) (*domain.EmailVerification, error) {
	var ev domain.EmailVerification
	if err := r.db.WithContext(ctx).First(&ev, "token = ?", token).Error; err != nil {
		return nil, mapErr(err)
	}
	return &ev, nil
}

func (r *emailVerificationRepo) MarkUsed(ctx context.Context, id int64) error {
	return mapErr(r.db.WithContext(ctx).
		Model(&domain.EmailVerification{}).
		Where("id = ?", id).
		Update("used_at", gorm.Expr("now()")).Error)
}

type passwordResetRepo struct{ db *gorm.DB }

func NewPasswordResetRepository(db *gorm.DB) domain.PasswordResetRepository {
	return &passwordResetRepo{db: db}
}

func (r *passwordResetRepo) Create(ctx context.Context, pr *domain.PasswordReset) error {
	return mapErr(r.db.WithContext(ctx).Create(pr).Error)
}

func (r *passwordResetRepo) FindByToken(ctx context.Context, token string) (*domain.PasswordReset, error) {
	var pr domain.PasswordReset
	if err := r.db.WithContext(ctx).First(&pr, "token = ?", token).Error; err != nil {
		return nil, mapErr(err)
	}
	return &pr, nil
}

func (r *passwordResetRepo) MarkUsed(ctx context.Context, id int64) error {
	return mapErr(r.db.WithContext(ctx).
		Model(&domain.PasswordReset{}).
		Where("id = ?", id).
		Update("used_at", gorm.Expr("now()")).Error)
}
