package repository

import (
	"context"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/ctf-oj/backend/internal/domain"
)

type followRepo struct{ db *gorm.DB }

func NewFollowRepository(db *gorm.DB) domain.FollowRepository {
	return &followRepo{db: db}
}

type followRow struct {
	FollowerID uint
	FolloweeID uint
}

func (r *followRepo) Follow(ctx context.Context, followerID, followeeID uint) error {
	if followerID == followeeID {
		return domain.ErrInvalidArgument
	}
	row := followRow{FollowerID: followerID, FolloweeID: followeeID}
	return r.db.WithContext(ctx).
		Table("user_follows").
		Clauses(clause.OnConflict{DoNothing: true}).
		Create(&row).Error
}

func (r *followRepo) Unfollow(ctx context.Context, followerID, followeeID uint) error {
	return r.db.WithContext(ctx).
		Table("user_follows").
		Where("follower_id = ? AND followee_id = ?", followerID, followeeID).
		Delete(nil).Error
}

func (r *followRepo) IsFollowing(ctx context.Context, followerID, followeeID uint) (bool, error) {
	var n int64
	if err := r.db.WithContext(ctx).
		Table("user_follows").
		Where("follower_id = ? AND followee_id = ?", followerID, followeeID).
		Count(&n).Error; err != nil {
		return false, err
	}
	return n > 0, nil
}

func (r *followRepo) CountFollowers(ctx context.Context, userID uint) (int64, error) {
	var n int64
	err := r.db.WithContext(ctx).
		Table("user_follows").
		Where("followee_id = ?", userID).
		Count(&n).Error
	return n, err
}

func (r *followRepo) CountFollowing(ctx context.Context, userID uint) (int64, error) {
	var n int64
	err := r.db.WithContext(ctx).
		Table("user_follows").
		Where("follower_id = ?", userID).
		Count(&n).Error
	return n, err
}

func (r *followRepo) list(ctx context.Context, column string, userID uint, page, pageSize int) ([]*domain.User, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	other := "followee_id"
	if column == "followee_id" {
		other = "follower_id"
	}
	var total int64
	if err := r.db.WithContext(ctx).
		Table("user_follows").
		Where(column+" = ?", userID).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var us []*domain.User
	if err := r.db.WithContext(ctx).
		Model(&domain.User{}).
		Joins("JOIN user_follows f ON f."+other+" = users.id").
		Where("f."+column+" = ?", userID).
		Order("f.created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&us).Error; err != nil {
		return nil, 0, err
	}
	return us, total, nil
}

func (r *followRepo) ListFollowers(ctx context.Context, userID uint, page, pageSize int) ([]*domain.User, int64, error) {
	return r.list(ctx, "followee_id", userID, page, pageSize)
}

func (r *followRepo) ListFollowing(ctx context.Context, userID uint, page, pageSize int) ([]*domain.User, int64, error) {
	return r.list(ctx, "follower_id", userID, page, pageSize)
}

func (r *followRepo) Feed(ctx context.Context, userID uint, limit int) ([]*domain.FeedItem, error) {
	if limit < 1 || limit > 100 {
		limit = 30
	}
	const q = `
SELECT 'solve' AS kind, s.user_id, u.username, s.challenge_id,
       c.title AS challenge_title, '' AS title, s.solved_at AS created_at
  FROM solves s
  JOIN users u ON u.id = s.user_id
  JOIN challenges c ON c.id = s.challenge_id
 WHERE s.user_id IN (SELECT followee_id FROM user_follows WHERE follower_id = ?)
   AND c.is_published = TRUE
UNION ALL
SELECT 'writeup' AS kind, w.user_id, u.username, w.challenge_id,
       c.title AS challenge_title, w.title, w.created_at
  FROM writeups w
  JOIN users u ON u.id = w.user_id
  JOIN challenges c ON c.id = w.challenge_id
 WHERE w.user_id IN (SELECT followee_id FROM user_follows WHERE follower_id = ?)
   AND w.is_published = TRUE AND c.is_published = TRUE
 ORDER BY created_at DESC
 LIMIT ?`
	var items []*domain.FeedItem
	if err := r.db.WithContext(ctx).Raw(q, userID, userID, limit).Scan(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}
