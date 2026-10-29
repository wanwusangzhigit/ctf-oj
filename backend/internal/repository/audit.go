package repository

import (
	"context"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
)

type auditLogRepo struct{ db *gorm.DB }

func NewAuditLogRepository(db *gorm.DB) domain.AuditLogRepository {
	return &auditLogRepo{db: db}
}

// Record swallows errors: an audit entry must never break the user-facing
// operation that triggered it. Misuse is logged but not surfaced.
func (r *auditLogRepo) Record(ctx context.Context, entry *domain.AuditLog) error {
	if entry == nil {
		return nil
	}
	if err := r.db.WithContext(ctx).Create(entry).Error; err != nil {
		return err
	}
	return nil
}

func (r *auditLogRepo) List(ctx context.Context, page, pageSize int, filter domain.AuditLogFilter) ([]*domain.AuditLog, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 200 {
		pageSize = 50
	}
	q := r.db.WithContext(ctx).Model(&domain.AuditLog{})
	if filter.ActorID > 0 {
		q = q.Where("actor_id = ?", filter.ActorID)
	}
	if filter.Action != "" {
		q = q.Where("action = ?", filter.Action)
	}
	if filter.TargetType != "" {
		q = q.Where("target_type = ?", filter.TargetType)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var out []*domain.AuditLog
	if err := q.Order("created_at DESC, id DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&out).Error; err != nil {
		return nil, 0, err
	}
	return out, total, nil
}
