package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/ctf-oj/backend/internal/domain"
)

type DiscussionService struct {
	discussions   domain.DiscussionRepository
	likes         domain.DiscussionLikeRepository
	challenges    domain.ChallengeRepository
	competitions  domain.CompetitionRepository
	registrations domain.CompetitionRegistrationRepository
	notifier      NotificationDispatcher
	access        *ChallengeAccessService
	teams         domain.TeamRepository
	community     *CommunityAccessService
}

func NewDiscussionService(
	d domain.DiscussionRepository,
	likes domain.DiscussionLikeRepository,
	c domain.ChallengeRepository,
	notifier NotificationDispatcher,
) *DiscussionService {
	return &DiscussionService{discussions: d, likes: likes, challenges: c, notifier: notifier}
}

func (s *DiscussionService) SetAccessService(a *ChallengeAccessService) { s.access = a }
func (s *DiscussionService) SetTeamRepository(t domain.TeamRepository)  { s.teams = t }
func (s *DiscussionService) SetCompetitionRepository(c domain.CompetitionRepository) {
	s.competitions = c
}
func (s *DiscussionService) SetRegistrationRepository(r domain.CompetitionRegistrationRepository) {
	s.registrations = r
}
func (s *DiscussionService) SetCommunityAccessService(c *CommunityAccessService) {
	s.community = c
}

type DiscussionTarget struct {
	Scope         domain.DiscussionScope
	ID            uint
	CompetitionID uint
}

type DiscussionInput struct {
	Title     string `json:"title"`
	ContentMD string `json:"contentMd"`
	ParentID  *uint  `json:"parentId"`
}

const maxContentLen = 5_000
const maxTitleLen = 160

func (s *DiscussionService) List(ctx context.Context, target DiscussionTarget, userID uint, opts domain.DiscussionListOptions, includeUnpublished bool, globalModerate bool) ([]*domain.Discussion, int64, error) {
	if err := s.ensureVisible(ctx, target, userID, includeUnpublished, globalModerate); err != nil {
		return nil, 0, err
	}
	topLevel, total, err := s.discussions.ListByScope(ctx, target.Scope, target.ID, opts)
	if err != nil {
		return nil, 0, err
	}
	for _, d := range topLevel {
		normalizeDiscussionStats(d)
		d.Replies = []*domain.Discussion{}
	}
	if opts.IncludeReplies {
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
		for _, d := range topLevel {
			d.Replies = repliesByParent[d.ID]
			if d.Replies == nil {
				d.Replies = []*domain.Discussion{}
			}
			d.ReplyCount = len(d.Replies)
			if len(d.Replies) > 0 {
				last := d.Replies[len(d.Replies)-1].CreatedAt
				d.LastReplyAt = &last
			}
		}
		if userID > 0 {
			allIDs := make([]uint, 0, len(topLevel)+len(allReplies))
			for _, d := range topLevel {
				allIDs = append(allIDs, d.ID)
			}
			for _, r := range allReplies {
				allIDs = append(allIDs, r.ID)
			}
			liked, _ := s.likes.HasLikedList(ctx, userID, allIDs)
			for _, d := range topLevel {
				d.Liked = liked[d.ID]
				for _, r := range d.Replies {
					r.Liked = liked[r.ID]
				}
			}
		}
	} else if userID > 0 {
		allIDs := make([]uint, 0, len(topLevel))
		for _, d := range topLevel {
			allIDs = append(allIDs, d.ID)
		}
		liked, _ := s.likes.HasLikedList(ctx, userID, allIDs)
		for _, d := range topLevel {
			d.Liked = liked[d.ID]
		}
	}
	return topLevel, total, nil
}

func (s *DiscussionService) Get(ctx context.Context, target DiscussionTarget, id, userID uint, includeUnpublished bool, globalModerate bool) (*domain.Discussion, error) {
	d, err := s.discussions.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if d.ParentID != nil || !sameDiscussionTarget(d, target) {
		return nil, domain.ErrNotFound
	}
	if err := s.ensureVisible(ctx, target, userID, includeUnpublished, globalModerate); err != nil {
		return nil, err
	}
	replies, err := s.discussions.ListReplies(ctx, d.ID)
	if err != nil {
		return nil, err
	}
	d.Replies = replies
	if d.Replies == nil {
		d.Replies = []*domain.Discussion{}
	}
	d.ReplyCount = len(d.Replies)
	if len(d.Replies) > 0 {
		last := d.Replies[len(d.Replies)-1].CreatedAt
		d.LastReplyAt = &last
	}
	normalizeDiscussionStats(d)
	if userID > 0 {
		ids := make([]uint, 0, 1+len(d.Replies))
		ids = append(ids, d.ID)
		for _, r := range d.Replies {
			ids = append(ids, r.ID)
		}
		liked, _ := s.likes.HasLikedList(ctx, userID, ids)
		d.Liked = liked[d.ID]
		for _, r := range d.Replies {
			r.Liked = liked[r.ID]
		}
	}
	if d.Scope == domain.DiscussionScopeCommunity || d.Scope == domain.DiscussionScopeCompetition {
		if err := s.discussions.IncrViewCount(ctx, d.ID); err == nil {
			d.ViewCount++
		}
	}
	return d, nil
}

func normalizeDiscussionStats(d *domain.Discussion) {
	if d.LastReplyAt == nil {
		created := d.CreatedAt
		d.LastReplyAt = &created
	}
}

func (s *DiscussionService) ensureVisible(ctx context.Context, target DiscussionTarget, userID uint, includeUnpublished bool, globalModerate bool) error {
	switch target.Scope {
	case domain.DiscussionScopeChallenge:
		if target.ID == 0 {
			return domain.ErrInvalidArgument
		}
		c, err := s.challenges.FindByID(ctx, target.ID)
		if err != nil {
			return err
		}
		if s.access != nil {
			ok, err := s.access.CanView(ctx, c, userID, includeUnpublished)
			if err != nil {
				return err
			}
			if !ok {
				return domain.ErrNotFound
			}
		} else if !c.IsPublished && !includeUnpublished {
			return domain.ErrNotFound
		}
		if !globalModerate {
			if err := s.blockedByCompetition(ctx, target); err != nil {
				return err
			}
		}
		return nil
	case domain.DiscussionScopeCompetition:
		if target.ID == 0 {
			return domain.ErrInvalidArgument
		}
		c, err := s.competitionForTarget(ctx, target.ID)
		if err != nil {
			return err
		}
		if s.access != nil {
			ok, err := s.access.CanViewCompetition(ctx, c, userID, includeUnpublished || globalModerate)
			if err != nil {
				return err
			}
			if !ok {
				return domain.ErrNotFound
			}
			return nil
		}
		if c.Visibility == "private" || (c.ArchivedAt != nil && !globalModerate) {
			return domain.ErrNotFound
		}
		return nil
	case domain.DiscussionScopeCommunity:
		if s.community == nil {
			return domain.ErrForbidden
		}
		ok, err := s.community.CanView(ctx, userID, globalModerate)
		if err != nil {
			return err
		}
		if !ok {
			return domain.ErrForbidden
		}
		return nil
	case domain.DiscussionScopeTeam:
		if target.ID == 0 {
			return domain.ErrInvalidArgument
		}
		ok, err := s.isTeamMember(ctx, target.ID, userID)
		if err != nil {
			return err
		}
		if !ok {
			return domain.ErrForbidden
		}
		return nil
	default:
		return domain.ErrInvalidArgument
	}
}

func (s *DiscussionService) blockedByCompetition(ctx context.Context, target DiscussionTarget) error {
	if target.Scope != domain.DiscussionScopeChallenge || target.CompetitionID == 0 || s.competitions == nil {
		return nil
	}
	c, err := s.competitions.FindByID(ctx, target.CompetitionID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil
		}
		return err
	}
	if competitionIsLive(c) && competitionCoversChallenge(c, target.ID) {
		return fmt.Errorf("%w: challenge discussions unavailable during competition", domain.ErrForbidden)
	}
	return nil
}

func (s *DiscussionService) canPost(ctx context.Context, target DiscussionTarget, userID uint, includeUnpublished bool, globalModerate bool) error {
	if userID == 0 {
		return domain.ErrUnauthorized
	}
	if target.Scope == domain.DiscussionScopeCompetition {
		if err := s.ensureVisible(ctx, target, userID, includeUnpublished, globalModerate); err != nil {
			return err
		}
		c, err := s.competitionForTarget(ctx, target.ID)
		if err != nil {
			return err
		}
		if globalModerate {
			return nil
		}
		if s.access != nil {
			ok, err := s.access.CanManageCompetition(ctx, c.ID, userID, false)
			if err != nil {
				return err
			}
			if ok {
				return nil
			}
		}
		if !c.RegistrationRequired {
			return nil
		}
		if s.registrations == nil {
			return domain.ErrForbidden
		}
		reg, err := s.registrations.Find(ctx, c.ID, userID)
		if err != nil {
			if errors.Is(err, domain.ErrNotFound) {
				return fmt.Errorf("%w: competition registration required", domain.ErrForbidden)
			}
			return err
		}
		if reg.ScoreExcluded {
			return fmt.Errorf("%w: competition score excluded", domain.ErrForbidden)
		}
		return nil
	}
	if target.Scope == domain.DiscussionScopeCommunity {
		if s.community == nil {
			return domain.ErrForbidden
		}
		ok, err := s.community.CanPost(ctx, userID, globalModerate)
		if err != nil {
			return err
		}
		if !ok {
			return domain.ErrForbidden
		}
		return nil
	}
	return s.ensureVisible(ctx, target, userID, includeUnpublished, globalModerate)
}

func (s *DiscussionService) fetchAllReplies(ctx context.Context, parentIDs []uint) ([]*domain.Discussion, error) {
	if len(parentIDs) == 0 {
		return nil, nil
	}
	var all []*domain.Discussion
	for _, pid := range parentIDs {
		rs, err := s.discussions.ListReplies(ctx, pid)
		if err != nil {
			return nil, err
		}
		all = append(all, rs...)
	}
	return all, nil
}

func (s *DiscussionService) Create(ctx context.Context, userID uint, target DiscussionTarget, in DiscussionInput, includeUnpublished bool, globalModerate bool) (*domain.Discussion, error) {
	in.Title = strings.TrimSpace(in.Title)
	in.ContentMD = strings.TrimSpace(in.ContentMD)
	if in.ContentMD == "" {
		return nil, errors.New("content required")
	}
	if len(in.ContentMD) > maxContentLen {
		return nil, errors.New("content too long")
	}
	if err := s.canPost(ctx, target, userID, includeUnpublished, globalModerate); err != nil {
		return nil, err
	}
	var parent *domain.Discussion
	if in.ParentID != nil && *in.ParentID > 0 {
		p, err := s.discussions.FindByID(ctx, *in.ParentID)
		if err != nil {
			return nil, err
		}
		if !sameDiscussionTarget(p, target) {
			return nil, errors.New("parent belongs to a different discussion")
		}
		if p.ParentID != nil {
			return nil, errors.New("only one level of reply is allowed")
		}
		if p.IsLocked {
			return nil, domain.ErrForbidden
		}
		parent = p
	} else if target.Scope == domain.DiscussionScopeCommunity || target.Scope == domain.DiscussionScopeCompetition {
		if in.Title == "" {
			return nil, errors.New("title required")
		}
		if len(in.Title) > maxTitleLen {
			return nil, errors.New("title too long")
		}
	}
	if parent != nil {
		in.Title = ""
	}

	title := ""
	if (target.Scope == domain.DiscussionScopeCommunity || target.Scope == domain.DiscussionScopeCompetition) && parent == nil {
		title = in.Title
	}
	now := time.Now()
	d := &domain.Discussion{
		Scope:     target.Scope,
		UserID:    userID,
		ParentID:  in.ParentID,
		Title:     title,
		ContentMD: in.ContentMD,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if parent == nil {
		d.LastReplyAt = &now
	}
	switch target.Scope {
	case domain.DiscussionScopeChallenge:
		id := target.ID
		d.ChallengeID = &id
	case domain.DiscussionScopeTeam:
		id := target.ID
		d.TeamID = &id
	case domain.DiscussionScopeCompetition:
		id := target.ID
		d.CompetitionID = &id
	}
	if err := s.discussions.Create(ctx, d); err != nil {
		return nil, err
	}
	if parent != nil {
		_ = s.discussions.TouchReply(ctx, parent.ID, d.CreatedAt)
	}
	if loaded, err := s.discussions.FindByID(ctx, d.ID); err == nil {
		d.User = loaded.User
	}

	if parent != nil && parent.UserID != userID && s.notifier != nil {
		title := "你的讨论收到新回复"
		body := truncate(in.ContentMD, 120)
		_ = s.notifier.Dispatch(ctx, parent.UserID, domain.NotifyReply, title, body, discussionLink(target, parent.ID))
	}
	return d, nil
}

func (s *DiscussionService) Delete(ctx context.Context, userID uint, id uint, globalModerate bool) error {
	d, err := s.discussions.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if d.UserID != userID {
		ok, err := s.canModerateDiscussion(ctx, d, userID, globalModerate)
		if err != nil {
			return err
		}
		if !ok {
			return domain.ErrForbidden
		}
	}
	if err := s.discussions.Delete(ctx, id); err != nil {
		return err
	}
	if d.ParentID != nil {
		return s.discussions.RefreshReplyStats(ctx, *d.ParentID)
	}
	return nil
}

func (s *DiscussionService) ToggleLike(ctx context.Context, userID, discussionID uint, globalModerate bool) (bool, error) {
	d, err := s.discussions.FindByID(ctx, discussionID)
	if err != nil {
		return false, err
	}
	if err := s.ensureVisible(ctx, targetOf(d), userID, false, globalModerate); err != nil {
		return false, err
	}
	return s.likes.Toggle(ctx, userID, discussionID)
}

func (s *DiscussionService) Moderate(ctx context.Context, userID, id uint, in ModerationInput, globalModerate bool) (*domain.Discussion, error) {
	d, err := s.discussions.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	ok, err := s.canModerateDiscussion(ctx, d, userID, globalModerate)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, domain.ErrForbidden
	}
	if in.IsPinned != nil {
		d.IsPinned = *in.IsPinned
	}
	if in.IsLocked != nil {
		d.IsLocked = *in.IsLocked
	}
	if in.Tags != nil {
		d.Tags = strings.TrimSpace(*in.Tags)
	}
	if err := s.discussions.Update(ctx, d); err != nil {
		return nil, err
	}
	return d, nil
}

func (s *DiscussionService) canModerateDiscussion(ctx context.Context, d *domain.Discussion, userID uint, globalModerate bool) (bool, error) {
	switch d.Scope {
	case domain.DiscussionScopeChallenge:
		return globalModerate, nil
	case domain.DiscussionScopeCompetition:
		if globalModerate {
			return true, nil
		}
		if s.access == nil || d.CompetitionID == nil {
			return false, nil
		}
		return s.access.CanManageCompetition(ctx, *d.CompetitionID, userID, false)
	case domain.DiscussionScopeCommunity:
		if globalModerate {
			return true, nil
		}
		if s.community == nil {
			return false, nil
		}
		return s.community.CanModerate(ctx, userID, false)
	case domain.DiscussionScopeTeam:
		if d.TeamID == nil || s.teams == nil {
			return false, nil
		}
		t, err := s.teams.FindByID(ctx, *d.TeamID)
		if err != nil {
			return false, err
		}
		return t.OwnerID == userID, nil
	default:
		return false, nil
	}
}

func (s *DiscussionService) competitionForTarget(ctx context.Context, id uint) (*domain.Competition, error) {
	if s.competitions == nil {
		return nil, domain.ErrNotFound
	}
	return s.competitions.FindByID(ctx, id)
}

func (s *DiscussionService) isTeamMember(ctx context.Context, teamID, userID uint) (bool, error) {
	if userID == 0 || teamID == 0 || s.teams == nil {
		return false, nil
	}
	m, err := s.teams.FindMembership(ctx, userID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return false, nil
		}
		return false, err
	}
	return m.TeamID == teamID, nil
}

func sameDiscussionTarget(d *domain.Discussion, target DiscussionTarget) bool {
	if d.Scope != target.Scope {
		return false
	}
	switch target.Scope {
	case domain.DiscussionScopeChallenge:
		return d.ChallengeID != nil && *d.ChallengeID == target.ID
	case domain.DiscussionScopeTeam:
		return d.TeamID != nil && *d.TeamID == target.ID
	case domain.DiscussionScopeCompetition:
		return d.CompetitionID != nil && *d.CompetitionID == target.ID
	case domain.DiscussionScopeCommunity:
		return true
	default:
		return false
	}
}

func targetOf(d *domain.Discussion) DiscussionTarget {
	switch d.Scope {
	case domain.DiscussionScopeChallenge:
		if d.ChallengeID != nil {
			return DiscussionTarget{Scope: d.Scope, ID: *d.ChallengeID}
		}
	case domain.DiscussionScopeTeam:
		if d.TeamID != nil {
			return DiscussionTarget{Scope: d.Scope, ID: *d.TeamID}
		}
	case domain.DiscussionScopeCompetition:
		if d.CompetitionID != nil {
			return DiscussionTarget{Scope: d.Scope, ID: *d.CompetitionID}
		}
	}
	return DiscussionTarget{Scope: d.Scope}
}

func discussionLink(target DiscussionTarget, topicID uint) string {
	switch target.Scope {
	case domain.DiscussionScopeChallenge:
		return "/challenges/" + itoa(int(target.ID))
	case domain.DiscussionScopeTeam:
		return "/teams/" + itoa(int(target.ID))
	case domain.DiscussionScopeCompetition:
		return "/competitions/" + itoa(int(target.ID))
	case domain.DiscussionScopeCommunity:
		return "/community/" + itoa(int(topicID))
	default:
		return "/"
	}
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

type ModerationInput struct {
	IsPinned *bool   `json:"isPinned"`
	IsLocked *bool   `json:"isLocked"`
	Tags     *string `json:"tags"`
}
