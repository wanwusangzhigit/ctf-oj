package service

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/ctf-oj/backend/internal/domain"
)

// Team failures wrap a domain sentinel so the HTTP layer can pick a semantic
// status code instead of reporting a 500 for expected rejections.
var (
	ErrTeamNameTaken = fmt.Errorf("team name already taken: %w", domain.ErrConflict)
	ErrTeamSlugTaken = fmt.Errorf("team slug already taken: %w", domain.ErrConflict)
	ErrAlreadyInTeam = fmt.Errorf("user already in a team: %w", domain.ErrConflict)
	ErrNotInTeam     = fmt.Errorf("user not in team: %w", domain.ErrNotFound)
	ErrNotTeamOwner  = fmt.Errorf("only owner can perform this action: %w", domain.ErrForbidden)
	ErrTeamFull      = fmt.Errorf("team is full: %w", domain.ErrConflict)
)

const maxTeamMembers = 10

type TeamService struct {
	repos domain.TeamRepository
	users domain.UserRepository
}

func NewTeamService(r domain.TeamRepository, u domain.UserRepository) *TeamService {
	return &TeamService{repos: r, users: u}
}

type TeamInput struct {
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
}

func (s *TeamService) Create(ctx context.Context, ownerID uint, in TeamInput) (*domain.Team, error) {
	in.Name = strings.TrimSpace(in.Name)
	in.Slug = strings.TrimSpace(in.Slug)
	if in.Name == "" || in.Slug == "" {
		return nil, domain.ErrInvalidArgument
	}
	if len(in.Name) > 64 || len(in.Slug) > 64 {
		return nil, domain.ErrInvalidArgument
	}
	if existing, _ := s.repos.FindBySlug(ctx, in.Slug); existing != nil {
		return nil, ErrTeamSlugTaken
	}
	if existing, _ := s.repos.FindByName(ctx, in.Name); existing != nil {
		return nil, ErrTeamNameTaken
	}
	owner, err := s.users.FindByID(ctx, ownerID)
	if err != nil {
		return nil, err
	}
	if existing, _ := s.repos.FindMembership(ctx, ownerID); existing != nil {
		return nil, ErrAlreadyInTeam
	}
	t := &domain.Team{
		Name:        in.Name,
		Slug:        in.Slug,
		Description: in.Description,
		OwnerID:     ownerID,
		InviteCode:  generateInviteCode(),
	}
	if err := s.repos.Create(ctx, t); err != nil {
		return nil, err
	}
	if err := s.repos.AddMember(ctx, &domain.TeamMember{
		TeamID:   t.ID,
		UserID:   ownerID,
		JoinedAt: time.Now(),
	}); err != nil {
		_ = s.repos.Delete(ctx, t.ID)
		return nil, err
	}
	_ = owner
	return t, nil
}

func (s *TeamService) Get(ctx context.Context, id uint) (*domain.Team, error) {
	t, err := s.repos.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	s.refreshScore(ctx, t, nil)
	return t, nil
}

func (s *TeamService) GetBySlug(ctx context.Context, slug string) (*domain.Team, error) {
	t, err := s.repos.FindBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	s.refreshScore(ctx, t, nil)
	return t, nil
}

func (s *TeamService) List(ctx context.Context, page, pageSize int) ([]*domain.Team, int64, error) {
	ts, total, err := s.repos.List(ctx, page, pageSize)
	if err != nil {
		return nil, 0, err
	}
	for _, t := range ts {
		s.refreshScore(ctx, t, nil)
	}
	return ts, total, nil
}

func (s *TeamService) Scoreboard(ctx context.Context, page, pageSize int, cutoff *time.Time) ([]*domain.Team, int64, error) {
	// Scores are derived from member solves, so ordering must happen after
	// recalculation rather than trusting the stale persisted column.
	var all []*domain.Team
	for p := 1; ; p++ {
		ts, total, err := s.repos.List(ctx, p, 100)
		if err != nil {
			return nil, 0, err
		}
		all = append(all, ts...)
		if len(ts) == 0 || len(all) >= int(total) {
			break
		}
	}
	for _, t := range all {
		s.refreshScore(ctx, t, cutoff)
	}
	sort.SliceStable(all, func(i, j int) bool {
		if all[i].Score != all[j].Score {
			return all[i].Score > all[j].Score
		}
		return all[i].ID < all[j].ID
	})
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	start := (page - 1) * pageSize
	if start > len(all) {
		start = len(all)
	}
	end := start + pageSize
	if end > len(all) {
		end = len(all)
	}
	return all[start:end], int64(len(all)), nil
}

func (s *TeamService) JoinByInviteCode(ctx context.Context, userID uint, code string) (*domain.Team, error) {
	if code == "" {
		return nil, domain.ErrInvalidArgument
	}
	if existing, _ := s.repos.FindMembership(ctx, userID); existing != nil {
		return nil, ErrAlreadyInTeam
	}
	t, err := s.repos.FindByInviteCode(ctx, code)
	if err != nil {
		return nil, err
	}
	members, err := s.repos.ListMembers(ctx, t.ID)
	if err != nil {
		return nil, err
	}
	if len(members) >= maxTeamMembers {
		return nil, ErrTeamFull
	}
	if err := s.repos.AddMember(ctx, &domain.TeamMember{
		TeamID:   t.ID,
		UserID:   userID,
		JoinedAt: time.Now(),
	}); err != nil {
		return nil, err
	}
	return t, nil
}

func (s *TeamService) Leave(ctx context.Context, userID uint) error {
	m, err := s.repos.FindMembership(ctx, userID)
	if err != nil {
		return ErrNotInTeam
	}
	t, err := s.repos.FindByID(ctx, m.TeamID)
	if err != nil {
		return err
	}
	if t.OwnerID == userID {
		return fmt.Errorf("owner cannot leave; transfer or disband first: %w", domain.ErrForbidden)
	}
	return s.repos.RemoveMember(ctx, m.TeamID, userID)
}

// TransferOwner hands ownership of the team to another existing member.
// The new owner must already be a member of the team.
// RotateInviteCode regenerates the team invite code. Owner only.
func (s *TeamService) RotateInviteCode(ctx context.Context, ownerID, teamID uint) (*domain.Team, error) {
	t, err := s.repos.FindByID(ctx, teamID)
	if err != nil {
		return nil, err
	}
	if t.OwnerID != ownerID {
		return nil, domain.ErrForbidden
	}
	t.InviteCode = generateInviteCode()
	if err := s.repos.Update(ctx, t); err != nil {
		return nil, err
	}
	return t, nil
}

func (s *TeamService) TransferOwner(ctx context.Context, ownerID, teamID, newOwnerID uint) (*domain.Team, error) {
	t, err := s.repos.FindByID(ctx, teamID)
	if err != nil {
		return nil, err
	}
	if t.OwnerID != ownerID {
		return nil, domain.ErrForbidden
	}
	if newOwnerID == ownerID {
		return nil, domain.ErrInvalidArgument
	}
	members, err := s.repos.ListMembers(ctx, teamID)
	if err != nil {
		return nil, err
	}
	found := false
	for _, m := range members {
		if m.UserID == newOwnerID {
			found = true
			break
		}
	}
	if !found {
		return nil, domain.ErrInvalidArgument
	}
	t.OwnerID = newOwnerID
	if err := s.repos.Update(ctx, t); err != nil {
		return nil, err
	}
	return t, nil
}

func (s *TeamService) Disband(ctx context.Context, ownerID, id uint) error {
	t, err := s.repos.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if t.OwnerID != ownerID {
		return ErrNotTeamOwner
	}
	return s.repos.Delete(ctx, id)
}

func (s *TeamService) RemoveMember(ctx context.Context, ownerID, teamID, memberUserID uint) error {
	t, err := s.repos.FindByID(ctx, teamID)
	if err != nil {
		return err
	}
	if t.OwnerID != ownerID {
		return ErrNotTeamOwner
	}
	if ownerID == memberUserID {
		return fmt.Errorf("cannot remove yourself; disband instead: %w", domain.ErrInvalidArgument)
	}
	return s.repos.RemoveMember(ctx, teamID, memberUserID)
}

func (s *TeamService) MyMembership(ctx context.Context, userID uint) (*domain.Team, error) {
	m, err := s.repos.FindMembership(ctx, userID)
	if err != nil {
		return nil, ErrNotInTeam
	}
	t, err := s.repos.FindByID(ctx, m.TeamID)
	if err != nil {
		return nil, err
	}
	s.refreshScore(ctx, t, nil)
	return t, nil
}

func (s *TeamService) RefreshAllScores(ctx context.Context) error {
	ts, _, err := s.repos.List(ctx, 1, 1000)
	if err != nil {
		return err
	}
	for _, t := range ts {
		s.refreshScore(ctx, t, nil)
		_ = s.repos.Update(ctx, t)
	}
	return nil
}

func (s *TeamService) refreshScore(ctx context.Context, t *domain.Team, cutoff *time.Time) {
	members, err := s.repos.ListMembers(ctx, t.ID)
	if err != nil {
		return
	}
	sum := 0
	if cutoff != nil {
		v, err := s.repos.SumMemberScoresUntil(ctx, t.ID, *cutoff)
		if err == nil {
			t.Score = v
		}
		return
	}
	for _, m := range members {
		if m.User != nil {
			if !m.User.ScoreExcluded {
				sum += m.User.Score
			}
		} else if u, err := s.users.FindByID(ctx, m.UserID); err == nil && !u.ScoreExcluded {
			sum += u.Score
		}
	}
	t.Score = sum
}

func generateInviteCode() string {
	return fmt.Sprintf("T-%s", strings.ReplaceAll(uuid.NewString(), "-", "")[:12])
}
