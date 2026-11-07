package service

import (
	"context"
	"strings"
	"unicode/utf8"

	"github.com/ctf-oj/backend/internal/domain"
)

const (
	maxSectionNameLen  = 64
	maxSectionBlurbLen = 255
	// Board guidelines share the topic body limit.
	maxSectionGuideLen = 5_000
)

// CommunitySectionService owns the board directory: the sections themselves,
// their per-section policy overrides, their copy and their grants. It reads the
// station-wide policy and grants through CommunityAccessService and never the
// other way round, so the two grant namespaces cannot be confused.
type CommunitySectionService struct {
	repo        domain.CommunitySectionRepository
	access      domain.CommunityAccessRepository
	discussions domain.DiscussionRepository
	community   *CommunityAccessService
}

func NewCommunitySectionService(
	repo domain.CommunitySectionRepository,
	access domain.CommunityAccessRepository,
	community *CommunityAccessService,
) *CommunitySectionService {
	return &CommunitySectionService{repo: repo, access: access, community: community}
}

// SetDiscussionRepository is optional: only the admin board list needs topic
// counts, and wiring it through the constructor would drag the discussion repo
// into every community request.
func (s *CommunitySectionService) SetDiscussionRepository(r domain.DiscussionRepository) {
	s.discussions = r
}

// CommunitySectionView is one board as a specific caller sees it. Visibility and
// Posting are the *effective* values, which is what the board UI badges; a
// caller who cannot view the board gets a stub — the name is not the secret, the
// fact that someone locked this board down is.
type CommunitySectionView struct {
	ID           uint   `json:"id"`
	Name         string `json:"name"`
	Blurb        string `json:"blurb,omitempty"`
	GuidelinesMD string `json:"guidelinesMd,omitempty"`
	Visibility   string `json:"visibility,omitempty"`
	Posting      string `json:"posting,omitempty"`
	CanView      bool   `json:"canView"`
	CanPost      bool   `json:"canPost"`
	CanManage    bool   `json:"canManage"`
}

// CommunitySectionAdmin is the editable row: it keeps the raw columns, so an
// empty policy still means "inherit the station policy" and the admin form can
// re-fill its selects without reverse-engineering an effective value.
type CommunitySectionAdmin struct {
	domain.CommunitySection
	TopicCount int64 `json:"topicCount"`
}

type CommunitySectionInput struct {
	Name         string `json:"name"`
	Blurb        string `json:"blurb"`
	GuidelinesMD string `json:"guidelinesMd"`
	Visibility   string `json:"visibility"`
	Posting      string `json:"posting"`
	SortOrder    int    `json:"sortOrder"`
}

// normalizeSectionInput enforces the column limits the migration declares, so a
// payload that would be rejected by Postgres is rejected as 400 instead of 500.
func normalizeSectionInput(in CommunitySectionInput) (*domain.CommunitySection, error) {
	s := &domain.CommunitySection{
		Name:         strings.TrimSpace(in.Name),
		Blurb:        strings.TrimSpace(in.Blurb),
		GuidelinesMD: strings.TrimSpace(in.GuidelinesMD),
		Visibility:   strings.TrimSpace(in.Visibility),
		Posting:      strings.TrimSpace(in.Posting),
		SortOrder:    in.SortOrder,
	}
	if s.Name == "" || utf8.RuneCountInString(s.Name) > maxSectionNameLen {
		return nil, domain.ErrInvalidArgument
	}
	if utf8.RuneCountInString(s.Blurb) > maxSectionBlurbLen {
		return nil, domain.ErrInvalidArgument
	}
	if utf8.RuneCountInString(s.GuidelinesMD) > maxSectionGuideLen {
		return nil, domain.ErrInvalidArgument
	}
	switch s.Visibility {
	case "", CommunityVisibilityPublic, CommunityVisibilityMembers, CommunityVisibilityRestricted:
	default:
		return nil, domain.ErrInvalidArgument
	}
	switch s.Posting {
	case "", CommunityPostingMembers, CommunityPostingRestricted:
	default:
		return nil, domain.ErrInvalidArgument
	}
	return s, nil
}

// resolveSectionPolicy layers a board's overrides on the station policy. An
// empty column inherits; a stored value outside the enum inherits too, so a bad
// write can never lock a board out of being read.
func resolveSectionPolicy(visibility, posting string, s *domain.CommunitySection) (string, string) {
	if s == nil {
		return visibility, posting
	}
	switch s.Visibility {
	case CommunityVisibilityPublic, CommunityVisibilityMembers, CommunityVisibilityRestricted:
		visibility = s.Visibility
	}
	switch s.Posting {
	case CommunityPostingMembers, CommunityPostingRestricted:
		posting = s.Posting
	}
	return visibility, posting
}

type sectionAccess struct {
	canView   bool
	canPost   bool
	canManage bool
}

// decideAccess is the whole permission lattice for one board, with no I/O.
// station and section are the caller's grants on the station and on this board
// ("" meaning none). Passing the station policy with station == section reduces
// to the formulas CommunityAccessService.Meta has always used.
func decideAccess(
	globalModerate bool,
	userID uint,
	station, section domain.AccessPermission,
	visibility, posting string,
) sectionAccess {
	// manage implies view without a term of its own: a resolved grant needs a
	// logged-in user, and for one of those the members clause already holds,
	// while the restricted clause accepts any grant at all.
	canView := globalModerate ||
		visibility == CommunityVisibilityPublic ||
		(visibility == CommunityVisibilityMembers && userID > 0) ||
		(visibility == CommunityVisibilityRestricted && (station != "" || section != ""))
	canPost := globalModerate || (canView && userID > 0 &&
		(posting == CommunityPostingMembers || station == domain.AccessManage || section == domain.AccessManage))
	canManage := globalModerate || station == domain.AccessManage || section == domain.AccessManage
	return sectionAccess{canView: canView, canPost: canPost, canManage: canManage}
}

// Views resolves every board for one caller in a constant number of queries:
// the directory, the station policy, the station grant and one batched grant
// lookup. Never loop View over sections.
func (s *CommunitySectionService) Views(ctx context.Context, userID uint, globalModerate bool) ([]CommunitySectionView, error) {
	if s.repo == nil || s.access == nil || s.community == nil {
		return []CommunitySectionView{}, nil
	}
	sections, err := s.repo.List(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]CommunitySectionView, 0, len(sections))
	if len(sections) == 0 {
		return out, nil
	}
	stationVisibility, stationPosting := s.community.Policy(ctx)
	teamID := s.community.TeamIDForUser(ctx, userID)
	stationLevel, err := s.community.levelWithTeam(ctx, userID, teamID)
	if err != nil {
		return nil, err
	}
	levels, err := s.access.SectionGrantLevels(ctx, userID, teamID)
	if err != nil {
		return nil, err
	}
	for _, section := range sections {
		visibility, posting := resolveSectionPolicy(stationVisibility, stationPosting, section)
		decision := decideAccess(globalModerate, userID, stationLevel, levels[section.ID], visibility, posting)
		view := CommunitySectionView{ID: section.ID, Name: section.Name, CanView: decision.canView, CanPost: decision.canPost, CanManage: decision.canManage}
		if decision.canView {
			view.Blurb = section.Blurb
			view.GuidelinesMD = section.GuidelinesMD
			view.Visibility = visibility
			view.Posting = posting
		}
		out = append(out, view)
	}
	return out, nil
}

// CanViewSection / CanPostSection / CanManageSection are what the discussion
// service consults, one board at a time.
func (s *CommunitySectionService) CanViewSection(ctx context.Context, sectionID, userID uint, globalModerate bool) (bool, error) {
	access, err := s.accessFor(ctx, sectionID, userID, globalModerate)
	return access.canView, err
}

func (s *CommunitySectionService) CanPostSection(ctx context.Context, sectionID, userID uint, globalModerate bool) (bool, error) {
	access, err := s.accessFor(ctx, sectionID, userID, globalModerate)
	return access.canPost, err
}

func (s *CommunitySectionService) CanManageSection(ctx context.Context, sectionID, userID uint, globalModerate bool) (bool, error) {
	access, err := s.accessFor(ctx, sectionID, userID, globalModerate)
	return access.canManage, err
}

func (s *CommunitySectionService) accessFor(ctx context.Context, sectionID, userID uint, globalModerate bool) (sectionAccess, error) {
	if s == nil || s.community == nil {
		return sectionAccess{}, domain.ErrForbidden
	}
	if sectionID == 0 {
		return sectionAccess{}, domain.ErrInvalidArgument
	}
	if s.repo == nil || s.access == nil {
		return sectionAccess{}, domain.ErrNotFound
	}
	section, err := s.repo.FindByID(ctx, sectionID)
	if err != nil {
		return sectionAccess{}, err
	}
	visibility, posting := s.effectivePolicy(ctx, section)
	teamID := s.community.TeamIDForUser(ctx, userID)
	stationLevel, err := s.community.levelWithTeam(ctx, userID, teamID)
	if err != nil {
		return sectionAccess{}, err
	}
	sectionLevel, err := s.access.CommunitySectionAccessLevel(ctx, sectionID, userID, teamID)
	if err != nil {
		return sectionAccess{}, err
	}
	return decideAccess(globalModerate, userID, stationLevel, sectionLevel, visibility, posting), nil
}

// effectivePolicy is the station policy with one board's override applied.
func (s *CommunitySectionService) effectivePolicy(ctx context.Context, section *domain.CommunitySection) (string, string) {
	visibility, posting := s.community.Policy(ctx)
	return resolveSectionPolicy(visibility, posting, section)
}

func (s *CommunitySectionService) ListAdmin(ctx context.Context) ([]CommunitySectionAdmin, error) {
	if s.repo == nil {
		return []CommunitySectionAdmin{}, nil
	}
	sections, err := s.repo.List(ctx)
	if err != nil {
		return nil, err
	}
	counts := map[uint]int64{}
	if s.discussions != nil {
		if counts, err = s.discussions.CountTopicsBySection(ctx); err != nil {
			return nil, err
		}
	}
	out := make([]CommunitySectionAdmin, 0, len(sections))
	for _, section := range sections {
		out = append(out, CommunitySectionAdmin{CommunitySection: *section, TopicCount: counts[section.ID]})
	}
	return out, nil
}

func (s *CommunitySectionService) Create(ctx context.Context, in CommunitySectionInput) (*domain.CommunitySection, error) {
	if s.repo == nil {
		return nil, domain.ErrInvalidArgument
	}
	section, err := normalizeSectionInput(in)
	if err != nil {
		return nil, err
	}
	if err := s.repo.Create(ctx, section); err != nil {
		return nil, err
	}
	return section, nil
}

// Update writes the admin-owned fields, policy overrides and ordering included.
func (s *CommunitySectionService) Update(ctx context.Context, id uint, in CommunitySectionInput) (*domain.CommunitySection, error) {
	section, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	next, err := normalizeSectionInput(in)
	if err != nil {
		return nil, err
	}
	section.Name = next.Name
	section.Blurb = next.Blurb
	section.GuidelinesMD = next.GuidelinesMD
	section.Visibility = next.Visibility
	section.Posting = next.Posting
	section.SortOrder = next.SortOrder
	if err := s.repo.Update(ctx, section); err != nil {
		return nil, err
	}
	return section, nil
}

// UpdateCopy writes only the board's own text, which is what a board manager may
// touch: the policy and the ordering stay with the station administrator.
func (s *CommunitySectionService) UpdateCopy(ctx context.Context, id uint, in CommunitySectionInput) (*domain.CommunitySection, error) {
	section, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	next, err := normalizeSectionInput(CommunitySectionInput{
		Name:         in.Name,
		Blurb:        in.Blurb,
		GuidelinesMD: in.GuidelinesMD,
	})
	if err != nil {
		return nil, err
	}
	section.Name = next.Name
	section.Blurb = next.Blurb
	section.GuidelinesMD = next.GuidelinesMD
	if err := s.repo.Update(ctx, section); err != nil {
		return nil, err
	}
	return section, nil
}

// Delete is refused while the board still holds topics: the foreign key is
// RESTRICT, and mapErr turns that into a 409.
func (s *CommunitySectionService) Delete(ctx context.Context, id uint) error {
	if s.repo == nil {
		return domain.ErrInvalidArgument
	}
	return s.repo.Delete(ctx, id)
}

func (s *CommunitySectionService) ListGrants(ctx context.Context, sectionID uint) ([]domain.AccessSubject, error) {
	if s.access == nil || s.community == nil {
		return []domain.AccessSubject{}, nil
	}
	if _, err := s.repo.FindByID(ctx, sectionID); err != nil {
		return nil, err
	}
	gs, err := s.access.ListCommunitySectionGrants(ctx, sectionID)
	if err != nil {
		return nil, err
	}
	out := make([]domain.AccessSubject, 0, len(gs))
	for _, g := range gs {
		sub := s.community.resolveSubject(ctx, g.SubjectType, g.SubjectID)
		sub.Permission = g.Permission
		out = append(out, sub)
	}
	return out, nil
}

func (s *CommunitySectionService) SetGrants(ctx context.Context, sectionID uint, subjects []domain.AccessSubject) error {
	if s.access == nil || s.community == nil {
		return domain.ErrInvalidArgument
	}
	if _, err := s.repo.FindByID(ctx, sectionID); err != nil {
		return err
	}
	normalized, err := s.community.normalizeSubjects(ctx, subjects)
	if err != nil {
		return err
	}
	grants := make([]domain.CommunitySectionAccessGrant, 0, len(normalized))
	for _, sub := range normalized {
		grants = append(grants, domain.CommunitySectionAccessGrant{
			SectionID:   sectionID,
			SubjectType: domain.AccessSubjectType(sub.Type),
			SubjectID:   sub.ID,
			Permission:  sub.Permission,
		})
	}
	return s.access.ReplaceCommunitySectionGrants(ctx, sectionID, grants)
}
