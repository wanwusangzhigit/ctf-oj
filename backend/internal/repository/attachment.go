package repository

import (
	"context"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
)

type attachmentRepo struct {
	db *gorm.DB
}

func NewAttachmentRepository(db *gorm.DB) domain.AttachmentRepository {
	return &attachmentRepo{db: db}
}

func (r *attachmentRepo) Create(ctx context.Context, a *domain.Attachment) error {
	return mapErr(r.db.WithContext(ctx).Create(a).Error)
}

func (r *attachmentRepo) FindByID(ctx context.Context, id uint) (*domain.Attachment, error) {
	var a domain.Attachment
	if err := r.db.WithContext(ctx).First(&a, id).Error; err != nil {
		return nil, mapErr(err)
	}
	return &a, nil
}

func (r *attachmentRepo) ListByChallengeID(ctx context.Context, challengeID uint) ([]*domain.Attachment, error) {
	var as []*domain.Attachment
	if err := r.db.WithContext(ctx).
		Where("challenge_id = ?", challengeID).
		Order("created_at ASC").
		Find(&as).Error; err != nil {
		return nil, err
	}
	return as, nil
}

func (r *attachmentRepo) Delete(ctx context.Context, id uint) error {
	tx := r.db.WithContext(ctx).Delete(&domain.Attachment{}, id)
	if tx.Error != nil {
		return mapErr(tx.Error)
	}
	if tx.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}
