package repository

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
)

type discussionLikeRepo struct {
	db *gorm.DB
}

func NewDiscussionLikeRepository(db *gorm.DB) domain.DiscussionLikeRepository {
	return &discussionLikeRepo{db: db}
}

func (r *discussionLikeRepo) Toggle(ctx context.Context, userID, discussionID uint) (bool, error) {
	var liked bool
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var existing domain.DiscussionLike
		err := tx.Where("user_id = ? AND discussion_id = ?", userID, discussionID).First(&existing).Error
		if err == nil {
			if err := tx.Delete(&existing).Error; err != nil {
				return err
			}
			if err := tx.Model(&domain.Discussion{}).
				Where("id = ?", discussionID).
				UpdateColumn("like_count", gorm.Expr("GREATEST(like_count - 1, 0)")).Error; err != nil {
				return err
			}
			liked = false
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		like := &domain.DiscussionLike{UserID: userID, DiscussionID: discussionID}
		if err := tx.Create(like).Error; err != nil {
			return err
		}
		if err := tx.Model(&domain.Discussion{}).
			Where("id = ?", discussionID).
			UpdateColumn("like_count", gorm.Expr("like_count + 1")).Error; err != nil {
			return err
		}
		liked = true
		return nil
	})
	return liked, err
}

func (r *discussionLikeRepo) HasLiked(ctx context.Context, userID, discussionID uint) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&domain.DiscussionLike{}).
		Where("user_id = ? AND discussion_id = ?", userID, discussionID).
		Count(&count).Error
	return count > 0, err
}

func (r *discussionLikeRepo) HasLikedList(ctx context.Context, userID uint, ids []uint) (map[uint]bool, error) {
	out := make(map[uint]bool, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	var likes []domain.DiscussionLike
	if err := r.db.WithContext(ctx).
		Select("discussion_id").
		Where("user_id = ? AND discussion_id IN ?", userID, ids).
		Find(&likes).Error; err != nil {
		return nil, err
	}
	for _, l := range likes {
		out[l.DiscussionID] = true
	}
	return out, nil
}
