package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/ctf-oj/backend/internal/domain"
)

const (
	CommunityVisibilityPublic     = "public"
	CommunityVisibilityMembers    = "members"
	CommunityVisibilityRestricted = "restricted"
	CommunityPostingMembers       = "members"
	CommunityPostingRestricted    = "restricted"
)

type CommunityMeta struct {
	Visibility  string            `json:"visibility"`
	Posting     string            `json:"posting"`
	CanView     bool              `json:"canView"`
	CanPost     bool              `json:"canPost"`
	CanModerate bool              `json:"canModerate"`
	Copy        map[string]string `json:"copy,omitempty"`
	// Sections is filled by the handler from CommunitySectionService.Views: the
	// station service must not know about boards, only the other way round.
	Sections []CommunitySectionView `json:"sections"`
}

const SettingCommunityCopyPrefix = "community.copy."

// CommunityCopyKeys are the board strings an organiser may override. Values are
// never stored here: the frontend registry holds the defaults and an empty or
// absent setting means "use the default", so a fresh database renders the same
// copy as a partially configured one.
var CommunityCopyKeys = []string{
	SettingCommunityCopyPrefix + "title",
	SettingCommunityCopyPrefix + "subtitle",
	SettingCommunityCopyPrefix + "new_topic",
	SettingCommunityCopyPrefix + "visibility_public",
	SettingCommunityCopyPrefix + "visibility_members",
	SettingCommunityCopyPrefix + "visibility_restricted",
	SettingCommunityCopyPrefix + "posting_members",
	SettingCommunityCopyPrefix + "posting_restricted",
	SettingCommunityCopyPrefix + "guidelines_title",
	SettingCommunityCopyPrefix + "guidelines_body",
	SettingCommunityCopyPrefix + "policy_title",
	SettingCommunityCopyPrefix + "search_placeholder",
	SettingCommunityCopyPrefix + "empty_filtered",
	SettingCommunityCopyPrefix + "empty_board",
	SettingCommunityCopyPrefix + "load_failed",
	SettingCommunityCopyPrefix + "topic_title_placeholder",
	SettingCommunityCopyPrefix + "topic_content_placeholder",
	SettingCommunityCopyPrefix + "compose_hint",
	SettingCommunityCopyPrefix + "compose_submit",
	SettingCommunityCopyPrefix + "edit_submit",
	SettingCommunityCopyPrefix + "edit_hint",
	SettingCommunityCopyPrefix + "reply_placeholder",
	SettingCommunityCopyPrefix + "reply_hint",
	SettingCommunityCopyPrefix + "reply_submit",
	SettingCommunityCopyPrefix + "locked_notice",
	SettingCommunityCopyPrefix + "reply_denied_member",
	SettingCommunityCopyPrefix + "reply_denied_guest",
	SettingCommunityCopyPrefix + "no_replies",
	SettingCommunityCopyPrefix + "restricted_title",
	SettingCommunityCopyPrefix + "restricted_members",
	SettingCommunityCopyPrefix + "restricted_granted",
	SettingCommunityCopyPrefix + "history_title",
	SettingCommunityCopyPrefix + "history_denied",
	SettingCommunityCopyPrefix + "topic_fallback_title",
}

type CommunityAccessService struct {
	repo     domain.CommunityAccessRepository
	users    domain.UserRepository
	teams    domain.TeamRepository
	settings *SettingService
}

func NewCommunityAccessService(
	repo domain.CommunityAccessRepository,
	users domain.UserRepository,
	teams domain.TeamRepository,
	settings *SettingService,
) *CommunityAccessService {
	return &CommunityAccessService{repo: repo, users: users, teams: teams, settings: settings}
}

func (s *CommunityAccessService) Policy(ctx context.Context) (visibility, posting string) {
	visibility = CommunityVisibilityPublic
	posting = CommunityPostingMembers
	if s.settings != nil {
		visibility = s.settings.GetString(ctx, SettingCommunityVisibility, visibility)
		posting = s.settings.GetString(ctx, SettingCommunityPosting, posting)
	}
	switch visibility {
	case CommunityVisibilityPublic, CommunityVisibilityMembers, CommunityVisibilityRestricted:
	default:
		visibility = CommunityVisibilityPublic
	}
	if posting != CommunityPostingRestricted {
		posting = CommunityPostingMembers
	}
	return visibility, posting
}

func (s *CommunityAccessService) TeamIDForUser(ctx context.Context, userID uint) uint {
	if userID == 0 || s.teams == nil {
		return 0
	}
	m, err := s.teams.FindMembership(ctx, userID)
	if err != nil || m == nil {
		return 0
	}
	return m.TeamID
}

func (s *CommunityAccessService) Level(ctx context.Context, userID uint) (domain.AccessPermission, error) {
	return s.levelWithTeam(ctx, userID, s.TeamIDForUser(ctx, userID))
}

// levelWithTeam exists so a caller that already resolved the team can read both
// grant tables without looking the membership up twice.
func (s *CommunityAccessService) levelWithTeam(ctx context.Context, userID, teamID uint) (domain.AccessPermission, error) {
	if userID == 0 || s.repo == nil {
		return "", nil
	}
	return s.repo.CommunityAccessLevel(ctx, userID, teamID)
}

func (s *CommunityAccessService) Meta(ctx context.Context, userID uint, globalModerate bool) (CommunityMeta, error) {
	visibility, posting := s.Policy(ctx)
	level, err := s.Level(ctx, userID)
	if err != nil {
		return CommunityMeta{}, err
	}
	canView, canPost, canModerate := decideStationAccess(globalModerate, userID, level, visibility, posting)
	return CommunityMeta{
		Visibility:  visibility,
		Posting:     posting,
		CanView:     canView,
		CanPost:     canPost,
		CanModerate: canModerate,
		Copy:        s.copyOverrides(ctx),
		Sections:    []CommunitySectionView{},
	}, nil
}

// decideStationAccess is the station-wide half of the community permission
// lattice, with no I/O. With an empty board grant and the station policy,
// decideAccess must agree with it bit for bit; TestSectionAccessReducesToStationMeta
// keeps the two formulas from drifting apart.
func decideStationAccess(globalModerate bool, userID uint, station domain.AccessPermission, visibility, posting string) (canView, canPost, canModerate bool) {
	canView = globalModerate || visibility == CommunityVisibilityPublic ||
		(visibility == CommunityVisibilityMembers && userID > 0) ||
		(visibility == CommunityVisibilityRestricted && station != "")
	canPost = globalModerate || (canView && userID > 0 && (posting == CommunityPostingMembers || station == domain.AccessManage))
	canModerate = globalModerate || station == domain.AccessManage
	return canView, canPost, canModerate
}

func (s *CommunityAccessService) copyOverrides(ctx context.Context) map[string]string {
	if s.settings == nil {
		return nil
	}
	var out map[string]string
	for _, key := range CommunityCopyKeys {
		value := strings.TrimSpace(s.settings.GetString(ctx, key, ""))
		if value == "" {
			continue
		}
		if out == nil {
			out = map[string]string{}
		}
		out[key] = value
	}
	return out
}

func (s *CommunityAccessService) CanView(ctx context.Context, userID uint, globalModerate bool) (bool, error) {
	meta, err := s.Meta(ctx, userID, globalModerate)
	return meta.CanView, err
}

func (s *CommunityAccessService) CanPost(ctx context.Context, userID uint, globalModerate bool) (bool, error) {
	meta, err := s.Meta(ctx, userID, globalModerate)
	return meta.CanPost, err
}

func (s *CommunityAccessService) CanModerate(ctx context.Context, userID uint, globalModerate bool) (bool, error) {
	meta, err := s.Meta(ctx, userID, globalModerate)
	return meta.CanModerate, err
}

func (s *CommunityAccessService) UpdatePolicy(ctx context.Context, visibility, posting string, updatedBy uint) error {
	visibility = strings.TrimSpace(visibility)
	posting = strings.TrimSpace(posting)
	switch visibility {
	case CommunityVisibilityPublic, CommunityVisibilityMembers, CommunityVisibilityRestricted:
	default:
		return domain.ErrInvalidArgument
	}
	switch posting {
	case CommunityPostingMembers, CommunityPostingRestricted:
	default:
		return domain.ErrInvalidArgument
	}
	if s.settings == nil {
		return domain.ErrInvalidArgument
	}
	return s.settings.UpdateMany(ctx, map[string]string{
		SettingCommunityVisibility: visibility,
		SettingCommunityPosting:    posting,
	}, updatedBy)
}

func (s *CommunityAccessService) ListGrants(ctx context.Context) ([]domain.AccessSubject, error) {
	if s.repo == nil {
		return []domain.AccessSubject{}, nil
	}
	gs, err := s.repo.ListCommunityGrants(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]domain.AccessSubject, 0, len(gs))
	for _, g := range gs {
		sub := s.resolveSubject(ctx, g.SubjectType, g.SubjectID)
		sub.Permission = g.Permission
		out = append(out, sub)
	}
	return out, nil
}

func (s *CommunityAccessService) SetGrants(ctx context.Context, subjects []domain.AccessSubject) error {
	if s.repo == nil {
		return domain.ErrInvalidArgument
	}
	normalized, err := s.normalizeSubjects(ctx, subjects)
	if err != nil {
		return err
	}
	grants := make([]domain.CommunityAccessGrant, 0, len(normalized))
	for _, sub := range normalized {
		grants = append(grants, domain.CommunityAccessGrant{
			SubjectType: domain.AccessSubjectType(sub.Type),
			SubjectID:   sub.ID,
			Permission:  sub.Permission,
		})
	}
	return s.repo.ReplaceCommunityGrants(ctx, grants)
}

// normalizeSubjects validates and de-duplicates a grant list. Station grants and
// board grants share it: the subject space (user/team/group) is identical, only
// the resource being granted differs.
func (s *CommunityAccessService) normalizeSubjects(ctx context.Context, subjects []domain.AccessSubject) ([]domain.AccessSubject, error) {
	out := make([]domain.AccessSubject, 0, len(subjects))
	seen := make(map[string]bool, len(subjects))
	for _, sub := range subjects {
		t := domain.AccessSubjectType(strings.TrimSpace(sub.Type))
		if t != domain.SubjectUser && t != domain.SubjectTeam && t != domain.SubjectGroup {
			return nil, domain.ErrInvalidArgument
		}
		if sub.ID == 0 {
			return nil, domain.ErrInvalidArgument
		}
		key := fmt.Sprintf("%s:%d", t, sub.ID)
		if seen[key] {
			continue
		}
		seen[key] = true
		if err := s.validateSubject(ctx, t, sub.ID); err != nil {
			return nil, err
		}
		perm, err := normalizeAccessPermission(sub.Permission)
		if err != nil {
			return nil, err
		}
		sub.Type, sub.Permission = string(t), perm
		out = append(out, sub)
	}
	return out, nil
}

func (s *CommunityAccessService) validateSubject(ctx context.Context, t domain.AccessSubjectType, id uint) error {
	switch t {
	case domain.SubjectUser:
		if s.users == nil {
			return domain.ErrInvalidArgument
		}
		_, err := s.users.FindByID(ctx, id)
		return err
	case domain.SubjectTeam:
		if s.teams == nil {
			return domain.ErrInvalidArgument
		}
		_, err := s.teams.FindByID(ctx, id)
		return err
	case domain.SubjectGroup:
		if s.repo == nil {
			return domain.ErrInvalidArgument
		}
		_, err := s.repo.FindGroupByID(ctx, id)
		return err
	default:
		return domain.ErrInvalidArgument
	}
}

func (s *CommunityAccessService) resolveSubject(ctx context.Context, t domain.AccessSubjectType, id uint) domain.AccessSubject {
	out := domain.AccessSubject{Type: string(t), ID: id}
	switch t {
	case domain.SubjectUser:
		if s.users != nil {
			if u, err := s.users.FindByID(ctx, id); err == nil && u != nil {
				out.Name = u.Username
			}
		}
	case domain.SubjectTeam:
		if s.teams != nil {
			if tm, err := s.teams.FindByID(ctx, id); err == nil && tm != nil {
				out.Name = tm.Name
			}
		}
	case domain.SubjectGroup:
		if g, err := s.findGroup(ctx, id); err == nil && g != nil {
			out.Name = g.Name
		}
	}
	if out.Name == "" {
		out.Name = fmt.Sprintf("#%d", id)
	}
	return out
}

func (s *CommunityAccessService) findGroup(ctx context.Context, id uint) (*domain.ChallengeGroup, error) {
	if s.repo == nil {
		return nil, domain.ErrNotFound
	}
	return s.repo.FindGroupByID(ctx, id)
}
