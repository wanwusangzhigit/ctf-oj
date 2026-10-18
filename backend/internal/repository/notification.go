package repository

import (
	"context"
	"time"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
)

type notificationRepo struct {
	db *gorm.DB
}

func NewNotificationRepository(db *gorm.DB) domain.NotificationRepository {
	return &notificationRepo{db: db}
}

func (r *notificationRepo) Create(ctx context.Context, n *domain.Notification) error {
	return mapErr(r.db.WithContext(ctx).Create(n).Error)
}

func (r *notificationRepo) ListByUser(ctx context.Context, userID uint, page, pageSize int) ([]*domain.Notification, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	q := r.db.WithContext(ctx).Model(&domain.Notification{}).Where("user_id = ?", userID)
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var ns []*domain.Notification
	if err := q.
		Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&ns).Error; err != nil {
		return nil, 0, err
	}
	return ns, total, nil
}

func (r *notificationRepo) UnreadCount(ctx context.Context, userID uint) (int64, error) {
	var n int64
	if err := r.db.WithContext(ctx).
		Model(&domain.Notification{}).
		Where("user_id = ? AND read_at IS NULL", userID).
		Count(&n).Error; err != nil {
		return 0, err
	}
	return n, nil
}

func (r *notificationRepo) MarkRead(ctx context.Context, id uint, userID uint) error {
	tx := r.db.WithContext(ctx).
		Model(&domain.Notification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("read_at", time.Now())
	if tx.Error != nil {
		return tx.Error
	}
	if tx.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *notificationRepo) MarkAllRead(ctx context.Context, userID uint) error {
	return r.db.WithContext(ctx).
		Model(&domain.Notification{}).
		Where("user_id = ? AND read_at IS NULL", userID).
		Update("read_at", time.Now()).Error
}
