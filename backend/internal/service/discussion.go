package service

import (
	"context"
	"errors"
	"strings"

	"github.com/ctf-oj/backend/internal/domain"
)

type DiscussionService struct {
	discussions domain.DiscussionRepository
	likes       domain.DiscussionLikeRepository
	challenges  domain.ChallengeRepository
	notifier    NotificationDispatcher
}

func NewDiscussionService(
	d domain.DiscussionRepository,
	likes domain.DiscussionLikeRepository,
	c domain.ChallengeRepository,
	notifier NotificationDispatcher,
) *DiscussionService {
	return &DiscussionService{discussions: d, likes: likes, challenges: c, notifier: notifier}
}

type DiscussionInput struct {
	ContentMD string `json:"contentMd"`
	ParentID  *uint  `json:"parentId"`
}

const maxContentLen = 5_000

func (s *DiscussionService) List(ctx context.Context, challengeID uint, userID uint, page, pageSize int) ([]*domain.Discussion, int64, error) {
	topLevel, total, err := s.discussions.ListByChallenge(ctx, challengeID, page, pageSize)
	if err != nil {
		return nil, 0, err
	}
	// 收集所有顶层 ID，批量查 replies
	ids := make([]uint, 0, len(topLevel))
	for _, d := range topLevel {
		ids = append(ids, d.ID)
	}
	allReplies, err := s.fetchAllReplies(ctx, ids)
	if err != nil {
		return nil, 0, err
	}
	repliesByParent := make(map[uint][]*domain.Discussion, len(allReplies))
	for _, r := range allReplies {
		if r.ParentID == nil {
			continue
		}
		repliesByParent[*r.ParentID] = append(repliesByParent[*r.ParentID], r)
	}
	// 标记当前用户是否已点赞
	all := append([]*domain.Discussion{}, topLevel...)
	all = append(all, allReplies...)
	if userID > 0 {
		allIDs := make([]uint, 0, len(all))
		for _, d := range all {
			allIDs = append(allIDs, d.ID)
		}
		liked, _ := s.likes.HasLikedList(ctx, userID, allIDs)
		for _, d := range all {
			d.Liked = liked[d.ID]
		}
	}
	for _, d := range topLevel {
		d.Replies = repliesByParent[d.ID]
		if d.Replies == nil {
			d.Replies = []*domain.Discussion{}
		}
	}
	return topLevel, total, nil
}

func (s *DiscussionService) fetchAllReplies(ctx context.Context, parentIDs []uint) ([]*domain.Discussion, error) {
	if len(parentIDs) == 0 {
		return nil, nil
	}
	var all []*domain.Discussion
	// 单层嵌套：每个顶层最多查一轮回复
	for _, pid := range parentIDs {
		rs, err := s.discussions.ListReplies(ctx, pid)
		if err != nil {
			return nil, err
		}
		all = append(all, rs...)
	}
	return all, nil
}

func (s *DiscussionService) Create(ctx context.Context, userID, challengeID uint, in DiscussionInput) (*domain.Discussion, error) {
	in.ContentMD = strings.TrimSpace(in.ContentMD)
	if in.ContentMD == "" {
		return nil, errors.New("content required")
	}
	if len(in.ContentMD) > maxContentLen {
		return nil, errors.New("content too long")
	}
	if _, err := s.challenges.FindByID(ctx, challengeID); err != nil {
		return nil, err
	}
	var parent *domain.Discussion
	if in.ParentID != nil && *in.ParentID > 0 {
		p, err := s.discussions.FindByID(ctx, *in.ParentID)
		if err != nil {
			return nil, err
		}
		if p.ChallengeID != challengeID {
			return nil, errors.New("parent belongs to a different challenge")
		}
		if p.ParentID != nil {
			return nil, errors.New("only one level of reply is allowed")
		}
		parent = p
	}

	d := &domain.Discussion{
		ChallengeID: challengeID,
		UserID:      userID,
		ParentID:    in.ParentID,
		ContentMD:   in.ContentMD,
	}
	if err := s.discussions.Create(ctx, d); err != nil {
		return nil, err
	}
	// 加载用户信息返回前端
	if loaded, err := s.discussions.FindByID(ctx, d.ID); err == nil {
		d.User = loaded.User
	}

	// 派发通知给父评论作者
	if parent != nil && parent.UserID != userID && s.notifier != nil {
		chal, _ := s.challenges.FindByID(ctx, challengeID)
		title := "你的评论收到新回复"
		body := truncate(in.ContentMD, 120)
		link := ""
		if chal != nil {
			link = "/challenges/" + itoa(int(chal.ID))
		}
		_ = s.notifier.Dispatch(ctx, parent.UserID, domain.NotifyReply, title, body, link)
	}
	return d, nil
}

func (s *DiscussionService) Delete(ctx context.Context, userID uint, id uint, isAdmin bool) error {
	d, err := s.discussions.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if !isAdmin && d.UserID != userID {
		return domain.ErrForbidden
	}
	return s.discussions.Delete(ctx, id)
}

func (s *DiscussionService) ToggleLike(ctx context.Context, userID, discussionID uint) (bool, error) {
	return s.likes.Toggle(ctx, userID, discussionID)
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n]) + "…"
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var b [20]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}
