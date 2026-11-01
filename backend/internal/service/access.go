package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/ctf-oj/backend/internal/domain"
)

type ChallengeAccessService struct {
	repo  domain.ChallengeAccessRepository
	chals domain.ChallengeRepository
	comps domain.CompetitionRepository
	users domain.UserRepository
	teams domain.TeamRepository
}

func NewChallengeAccessService(
	repo domain.ChallengeAccessRepository,
	chals domain.ChallengeRepository,
	comps domain.CompetitionRepository,
	users domain.UserRepository,
	teams domain.TeamRepository,
) *ChallengeAccessService {
	return &ChallengeAccessService{repo: repo, chals: chals, comps: comps, users: users, teams: teams}
}

func (s *ChallengeAccessService) TeamIDForUser(ctx context.Context, userID uint) uint {
	if userID == 0 || s.teams == nil {
		return 0
	}
	m, err := s.teams.FindMembership(ctx, userID)
	if err != nil || m == nil {
		return 0
	}
	return m.TeamID
}

// CanView decides whether a viewer may see a challenge. Published challenges
// are public; hidden challenges require a direct user/team grant or membership
// in a granted group. Draft and archived challenges remain admin-only.
func (s *ChallengeAccessService) CanView(ctx context.Context, c *domain.Challenge, userID uint, isAdmin bool) (bool, error) {
	if isAdmin {
		return true, nil
	}
	if c.IsPublished && c.Status == domain.ChallengePublished {
		return true, nil
	}
	if c.Status != domain.ChallengeHidden {
		return false, nil
	}
	if s.competitionRevealsChallenge(ctx, c.ID) {
		return true, nil
	}
	if userID == 0 || s.repo == nil {
		return false, nil
	}
	return s.repo.HasAccess(ctx, c.ID, userID, s.TeamIDForUser(ctx, userID))
}

// competitionRevealsChallenge allows a hidden challenge to be read while its
// bound competition is live. The competition id comes from the request context
// so challenge subresources inherit the same visibility rule.
func (s *ChallengeAccessService) competitionRevealsChallenge(ctx context.Context, challengeID uint) bool {
	competitionID := domain.CompetitionIDFromContext(ctx)
	if competitionID == 0 || s.comps == nil {
		return false
	}
	c, err := s.comps.FindByID(ctx, competitionID)
	if err != nil || !competitionIsLive(c) {
		return false
	}
	return competitionBindsChallenge(c, challengeID)
}

// CanManageChallenge reports whether the viewer holds an explicit manage grant
// on the challenge. Global challenge managers are handled by the caller.
func (s *ChallengeAccessService) CanManageChallenge(ctx context.Context, challengeID, userID uint) (bool, error) {
	if userID == 0 || s.repo == nil {
		return false, nil
	}
	level, err := s.repo.AccessLevel(ctx, challengeID, userID, s.TeamIDForUser(ctx, userID))
	if err != nil {
		return false, err
	}
	return level == domain.AccessManage, nil
}

// CompetitionLevel resolves the highest grant level for a competition. Public,
// unarchived competitions are readable by everyone; explicit grants can add
// view access to private/archived competitions or manage access.
func (s *ChallengeAccessService) CompetitionLevel(ctx context.Context, c *domain.Competition, userID uint, isAdmin bool) (domain.AccessPermission, error) {
	if isAdmin {
		return domain.AccessManage, nil
	}
	if userID != 0 && s.repo != nil {
		level, err := s.repo.CompetitionAccessLevel(ctx, c.ID, userID, s.TeamIDForUser(ctx, userID))
		if err != nil {
			return "", err
		}
		if level != "" {
			return level, nil
		}
	}
	if c.Visibility == "public" && c.ArchivedAt == nil {
		return domain.AccessView, nil
	}
	return "", nil
}

func (s *ChallengeAccessService) CanViewCompetition(ctx context.Context, c *domain.Competition, userID uint, isAdmin bool) (bool, error) {
	level, err := s.CompetitionLevel(ctx, c, userID, isAdmin)
	return level != "", err
}

func (s *ChallengeAccessService) CanManageCompetition(ctx context.Context, competitionID, userID uint, isAdmin bool) (bool, error) {
	if isAdmin {
		return true, nil
	}
	if s.comps == nil {
		return false, nil
	}
	c, err := s.comps.FindByID(ctx, competitionID)
	if err != nil {
		return false, err
	}
	level, err := s.CompetitionLevel(ctx, c, userID, false)
	if err != nil {
		return false, err
	}
	return level == domain.AccessManage, nil
}

func (s *ChallengeAccessService) ManagedCompetitionIDs(ctx context.Context, userID uint) ([]uint, error) {
	if userID == 0 || s.repo == nil {
		return nil, nil
	}
	return s.repo.ManagedCompetitionIDs(ctx, userID, s.TeamIDForUser(ctx, userID))
}

func (s *ChallengeAccessService) ListDelegations(ctx context.Context, userID uint) ([]domain.Delegation, error) {
	if userID == 0 || s.repo == nil {
		return nil, nil
	}
	return s.repo.ListDelegations(ctx, userID, s.TeamIDForUser(ctx, userID))
}

type ChallengeGroupInput struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Members     []domain.AccessSubject `json:"members"`
}

func (s *ChallengeAccessService) ListGroups(ctx context.Context) ([]domain.ChallengeGroupView, error) {
	gs, err := s.repo.ListGroups(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]domain.ChallengeGroupView, 0, len(gs))
	for _, g := range gs {
		out = append(out, s.groupView(ctx, g))
	}
	return out, nil
}

func (s *ChallengeAccessService) CreateGroup(ctx context.Context, in ChallengeGroupInput) (*domain.ChallengeGroupView, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, errors.New("name required")
	}
	if len(name) > 64 {
		return nil, errors.New("name too long")
	}
	if _, err := s.repo.FindGroupByName(ctx, name); err == nil {
		return nil, domain.ErrAlreadyExists
	} else if !errors.Is(err, domain.ErrNotFound) {
		return nil, err
	}
	members, err := s.normalizeMembers(ctx, in.Members)
	if err != nil {
		return nil, err
	}
	g := &domain.ChallengeGroup{Name: name, Description: strings.TrimSpace(in.Description)}
	if err := s.repo.CreateGroup(ctx, g); err != nil {
		return nil, err
	}
	if err := s.repo.ReplaceGroupMembers(ctx, g.ID, members); err != nil {
		return nil, err
	}
	saved, err := s.repo.FindGroupByID(ctx, g.ID)
	if err != nil {
		return nil, err
	}
	v := s.groupView(ctx, saved)
	return &v, nil
}

func (s *ChallengeAccessService) UpdateGroup(ctx context.Context, id uint, in ChallengeGroupInput) (*domain.ChallengeGroupView, error) {
	g, err := s.repo.FindGroupByID(ctx, id)
	if err != nil {
		return nil, err
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, errors.New("name required")
	}
	if other, err := s.repo.FindGroupByName(ctx, name); err == nil && other.ID != id {
		return nil, domain.ErrAlreadyExists
	} else if err != nil && !errors.Is(err, domain.ErrNotFound) {
		return nil, err
	}
	members, err := s.normalizeMembers(ctx, in.Members)
	if err != nil {
		return nil, err
	}
	g.Name = name
	g.Description = strings.TrimSpace(in.Description)
	if err := s.repo.UpdateGroup(ctx, g); err != nil {
		return nil, err
	}
	if err := s.repo.ReplaceGroupMembers(ctx, id, members); err != nil {
		return nil, err
	}
	saved, err := s.repo.FindGroupByID(ctx, id)
	if err != nil {
		return nil, err
	}
	v := s.groupView(ctx, saved)
	return &v, nil
}

func (s *ChallengeAccessService) DeleteGroup(ctx context.Context, id uint) error {
	return s.repo.DeleteGroup(ctx, id)
}

func (s *ChallengeAccessService) ListGrants(ctx context.Context, challengeID uint) ([]domain.AccessSubject, error) {
	if _, err := s.chals.FindByID(ctx, challengeID); err != nil {
		return nil, err
	}
	gs, err := s.repo.ListGrants(ctx, challengeID)
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

func (s *ChallengeAccessService) SetGrants(ctx context.Context, challengeID uint, subjects []domain.AccessSubject) error {
	if _, err := s.chals.FindByID(ctx, challengeID); err != nil {
		return err
	}
	seen := make(map[string]bool, len(subjects))
	grants := make([]domain.ChallengeAccessGrant, 0, len(subjects))
	for _, sub := range subjects {
		t := domain.AccessSubjectType(strings.TrimSpace(sub.Type))
		if t != domain.SubjectUser && t != domain.SubjectTeam && t != domain.SubjectGroup {
			return domain.ErrInvalidArgument
		}
		if sub.ID == 0 {
			return domain.ErrInvalidArgument
		}
		key := fmt.Sprintf("%s:%d", t, sub.ID)
		if seen[key] {
			continue
		}
		seen[key] = true
		if err := s.validateSubject(ctx, t, sub.ID); err != nil {
			return err
		}
		perm, err := normalizeAccessPermission(sub.Permission)
		if err != nil {
			return err
		}
		grants = append(grants, domain.ChallengeAccessGrant{SubjectType: t, SubjectID: sub.ID, Permission: perm})
	}
	return s.repo.ReplaceGrants(ctx, challengeID, grants)
}

func (s *ChallengeAccessService) ListCompetitionGrants(ctx context.Context, competitionID uint) ([]domain.AccessSubject, error) {
	if s.comps == nil {
		return nil, domain.ErrNotFound
	}
	if _, err := s.comps.FindByID(ctx, competitionID); err != nil {
		return nil, err
	}
	gs, err := s.repo.ListCompetitionGrants(ctx, competitionID)
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

func (s *ChallengeAccessService) SetCompetitionGrants(ctx context.Context, competitionID uint, subjects []domain.AccessSubject) error {
	if s.comps == nil {
		return domain.ErrNotFound
	}
	if _, err := s.comps.FindByID(ctx, competitionID); err != nil {
		return err
	}
	seen := make(map[string]bool, len(subjects))
	grants := make([]domain.CompetitionAccessGrant, 0, len(subjects))
	for _, sub := range subjects {
		t := domain.AccessSubjectType(strings.TrimSpace(sub.Type))
		if t != domain.SubjectUser && t != domain.SubjectTeam && t != domain.SubjectGroup {
			return domain.ErrInvalidArgument
		}
		if sub.ID == 0 {
			return domain.ErrInvalidArgument
		}
		key := fmt.Sprintf("%s:%d", t, sub.ID)
		if seen[key] {
			continue
		}
		seen[key] = true
		if err := s.validateSubject(ctx, t, sub.ID); err != nil {
			return err
		}
		perm, err := normalizeAccessPermission(sub.Permission)
		if err != nil {
			return err
		}
		grants = append(grants, domain.CompetitionAccessGrant{SubjectType: t, SubjectID: sub.ID, Permission: perm})
	}
	return s.repo.ReplaceCompetitionGrants(ctx, competitionID, grants)
}

func normalizeAccessPermission(p domain.AccessPermission) (domain.AccessPermission, error) {
	switch p {
	case "", domain.AccessView:
		return domain.AccessView, nil
	case domain.AccessManage:
		return domain.AccessManage, nil
	default:
		return "", domain.ErrInvalidArgument
	}
}

func (s *ChallengeAccessService) SearchSubjects(ctx context.Context, subjectType string, query string) ([]domain.AccessSubject, error) {
	t := domain.AccessSubjectType(strings.TrimSpace(subjectType))
	if t != domain.SubjectUser && t != domain.SubjectTeam {
		return nil, domain.ErrInvalidArgument
	}
	return s.repo.SearchSubjects(ctx, t, query, 20)
}

func (s *ChallengeAccessService) normalizeMembers(ctx context.Context, in []domain.AccessSubject) ([]domain.ChallengeGroupMember, error) {
	seen := make(map[string]bool, len(in))
	out := make([]domain.ChallengeGroupMember, 0, len(in))
	for _, sub := range in {
		t := domain.AccessSubjectType(strings.TrimSpace(sub.Type))
		if t != domain.SubjectUser && t != domain.SubjectTeam {
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
		out = append(out, domain.ChallengeGroupMember{SubjectType: t, SubjectID: sub.ID})
	}
	return out, nil
}

func (s *ChallengeAccessService) validateSubject(ctx context.Context, t domain.AccessSubjectType, id uint) error {
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
		_, err := s.repo.FindGroupByID(ctx, id)
		return err
	default:
		return domain.ErrInvalidArgument
	}
}

func (s *ChallengeAccessService) resolveSubject(ctx context.Context, t domain.AccessSubjectType, id uint) domain.AccessSubject {
	out := domain.AccessSubject{Type: string(t), ID: id}
	switch t {
	case domain.SubjectUser:
		if u, err := s.users.FindByID(ctx, id); err == nil && u != nil {
			out.Name = u.Username
		}
	case domain.SubjectTeam:
		if tm, err := s.teams.FindByID(ctx, id); err == nil && tm != nil {
			out.Name = tm.Name
		}
	case domain.SubjectGroup:
		if g, err := s.repo.FindGroupByID(ctx, id); err == nil && g != nil {
			out.Name = g.Name
		}
	}
	if out.Name == "" {
		out.Name = fmt.Sprintf("#%d", id)
	}
	return out
}

func (s *ChallengeAccessService) groupView(ctx context.Context, g *domain.ChallengeGroup) domain.ChallengeGroupView {
	v := domain.ChallengeGroupView{
		ID:          g.ID,
		Name:        g.Name,
		Description: g.Description,
		CreatedAt:   g.CreatedAt,
		UpdatedAt:   g.UpdatedAt,
		Members:     make([]domain.AccessSubject, 0, len(g.Members)),
	}
	for _, m := range g.Members {
		v.Members = append(v.Members, s.resolveSubject(ctx, m.SubjectType, m.SubjectID))
	}
	return v
}
