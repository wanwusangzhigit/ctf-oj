package repository

import (
	"context"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
)

type discussionRepo struct {
	db *gorm.DB
}

func NewDiscussionRepository(db *gorm.DB) domain.DiscussionRepository {
	return &discussionRepo{db: db}
}

func (r *discussionRepo) Create(ctx context.Context, d *domain.Discussion) error {
	return mapErr(r.db.WithContext(ctx).Create(d).Error)
}

func (r *discussionRepo) FindByID(ctx context.Context, id uint) (*domain.Discussion, error) {
	var d domain.Discussion
	if err := r.db.WithContext(ctx).Preload("User").First(&d, id).Error; err != nil {
		return nil, mapErr(err)
	}
	return &d, nil
}

func (r *discussionRepo) ListByChallenge(ctx context.Context, challengeID uint, page, pageSize int) ([]*domain.Discussion, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 50
	}
	q := r.db.WithContext(ctx).
		Model(&domain.Discussion{}).
		Where("challenge_id = ? AND parent_id IS NULL", challengeID)
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var ds []*domain.Discussion
	if err := q.
		Preload("User").
		Order("is_pinned DESC").
		Order("created_at ASC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&ds).Error; err != nil {
		return nil, 0, err
	}
	return ds, total, nil
}

func (r *discussionRepo) ListByScope(ctx context.Context, scope domain.DiscussionScope, targetID uint, opts domain.DiscussionListOptions) ([]*domain.Discussion, int64, error) {
	if opts.Page < 1 {
		opts.Page = 1
	}
	if opts.PageSize < 1 || opts.PageSize > 100 {
		opts.PageSize = 50
	}
	q := r.db.WithContext(ctx).
		Model(&domain.Discussion{}).
		Where("scope = ? AND parent_id IS NULL", scope)
	switch scope {
	case domain.DiscussionScopeChallenge:
		q = q.Where("challenge_id = ?", targetID)
	case domain.DiscussionScopeTeam:
		q = q.Where("team_id = ?", targetID)
	case domain.DiscussionScopeCompetition:
		q = q.Where("competition_id = ?", targetID)
	}
	if tag := strings.TrimSpace(opts.Tag); tag != "" {
		q = q.Where("tags ILIKE ?", "%"+tag+"%")
	}
	if query := strings.TrimSpace(opts.Query); query != "" {
		like := "%" + query + "%"
		q = q.Where("(title ILIKE ? OR content_md ILIKE ?)", like, like)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	q = q.Preload("User")
	switch opts.Sort {
	case "newest":
		q = q.Order("is_pinned DESC").Order("created_at DESC")
	case "oldest":
		q = q.Order("is_pinned DESC").Order("created_at ASC")
	default:
		q = q.Order("is_pinned DESC").
			Order("last_reply_at DESC NULLS LAST").
			Order("created_at DESC")
	}
	var ds []*domain.Discussion
	if err := q.
		Offset((opts.Page - 1) * opts.PageSize).
		Limit(opts.PageSize).
		Find(&ds).Error; err != nil {
		return nil, 0, err
	}
	return ds, total, nil
}

func (r *discussionRepo) ListReplies(ctx context.Context, parentID uint) ([]*domain.Discussion, error) {
	var ds []*domain.Discussion
	if err := r.db.WithContext(ctx).
		Preload("User").
		Where("parent_id = ?", parentID).
		Order("created_at ASC").
		Find(&ds).Error; err != nil {
		return nil, err
	}
	return ds, nil
}

func (r *discussionRepo) ListByUser(ctx context.Context, userID uint, limit int) ([]*domain.Discussion, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	var ds []*domain.Discussion
	if err := r.db.WithContext(ctx).
		Preload("User").
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Find(&ds).Error; err != nil {
		return nil, err
	}
	return ds, nil
}

func (r *discussionRepo) Update(ctx context.Context, d *domain.Discussion) error {
	return mapErr(r.db.WithContext(ctx).Save(d).Error)
}

func (r *discussionRepo) Delete(ctx context.Context, id uint) error {
	tx := r.db.WithContext(ctx).Delete(&domain.Discussion{}, id)
	if tx.Error != nil {
		return mapErr(tx.Error)
	}
	if tx.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *discussionRepo) IncrLikeCount(ctx context.Context, id uint, delta int) error {
	return r.db.WithContext(ctx).
		Model(&domain.Discussion{}).
		Where("id = ?", id).
		UpdateColumn("like_count", gorm.Expr("GREATEST(like_count + ?, 0)", delta)).Error
}

func (r *discussionRepo) IncrViewCount(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).
		Model(&domain.Discussion{}).
		Where("id = ?", id).
		UpdateColumn("view_count", gorm.Expr("view_count + 1")).Error
}

func (r *discussionRepo) TouchReply(ctx context.Context, parentID uint, at time.Time) error {
	return r.db.WithContext(ctx).
		Model(&domain.Discussion{}).
		Where("id = ?", parentID).
		Updates(map[string]any{
			"reply_count":   gorm.Expr("reply_count + 1"),
			"last_reply_at": at,
		}).Error
}

func (r *discussionRepo) RefreshReplyStats(ctx context.Context, parentID uint) error {
	return r.db.WithContext(ctx).Exec(`
		UPDATE discussions d
		SET reply_count = stats.cnt,
		    last_reply_at = COALESCE(stats.last_reply, d.created_at)
		FROM (
			SELECT COUNT(*)::INTEGER AS cnt, MAX(created_at) AS last_reply
			FROM discussions
			WHERE parent_id = ?
		) stats
		WHERE d.id = ?`, parentID, parentID).Error
}

func (r *discussionRepo) CountReplies(ctx context.Context, parentID uint) (int64, error) {
	var n int64
	if err := r.db.WithContext(ctx).
		Model(&domain.Discussion{}).
		Where("parent_id = ?", parentID).
		Count(&n).Error; err != nil {
		return 0, err
	}
	return n, nil
}
