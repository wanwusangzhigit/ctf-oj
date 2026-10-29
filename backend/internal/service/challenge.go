package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"strings"
	"time"

	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/infrastructure/metrics"
	"github.com/ctf-oj/backend/internal/infrastructure/storage"
	"github.com/ctf-oj/backend/internal/pkg/crypto"
)

type ChallengeService struct {
	challenges        domain.ChallengeRepository
	categories        domain.CategoryRepository
	flags             domain.FlagRepository
	attachments       domain.AttachmentRepository
	submissions       domain.SubmissionRepository
	solves            domain.SolveRepository
	competitionSolves domain.CompetitionSolveRepository
	competitions      domain.CompetitionRepository
	users             domain.UserRepository
	instances         *InstanceService
	notifier          NotificationDispatcher
	publisher         EventPublisher
	sources           *storage.ChallengeSources
	hints             *HintService // optional — nil keeps backward compat
	access            *ChallengeAccessService
}

type EventPublisher interface {
	PublishSolve(challengeID uint, challengeTitle, username string, score int, firstBlood bool)
}

// Event used for realtime broadcast.
type SolveEvent struct {
	ChallengeID    uint   `json:"challengeId"`
	ChallengeTitle string `json:"challengeTitle"`
	Username       string `json:"username"`
	Score          int    `json:"score"`
	IsFirstBlood   bool   `json:"isFirstBlood"`
}

func NewChallengeService(
	challenges domain.ChallengeRepository,
	categories domain.CategoryRepository,
	flags domain.FlagRepository,
	attachments domain.AttachmentRepository,
	submissions domain.SubmissionRepository,
	solves domain.SolveRepository,
	users domain.UserRepository,
	instances *InstanceService,
	notifier NotificationDispatcher,
	publisher EventPublisher,
	sources *storage.ChallengeSources,
	hints *HintService,
) *ChallengeService {
	return &ChallengeService{
		challenges:  challenges,
		categories:  categories,
		flags:       flags,
		attachments: attachments,
		submissions: submissions,
		solves:      solves,
		users:       users,
		instances:   instances,
		notifier:    notifier,
		publisher:   publisher,
		sources:     sources,
		hints:       hints,
	}
}

type ChallengeAdminInput struct {
	CategoryID     uint                    `json:"categoryId"`
	Title          string                  `json:"title"`
	Description    string                  `json:"description"`
	EditorialMD    string                  `json:"editorial"`
	BaseScore      int                     `json:"baseScore"`
	MinScore       int                     `json:"minScore"`
	Decay          int                     `json:"decay"`
	Difficulty     int                     `json:"difficulty"`
	Status         string                  `json:"status"`
	IsPublished    bool                    `json:"isPublished"`
	ConnectionInfo string                  `json:"connectionInfo"`
	Tags           string                  `json:"tags"`
	Flags          []FlagInput             `json:"flags"`
	IsDynamic      bool                    `json:"isDynamic"`
	Image          string                  `json:"image"`
	InternalPort   int                     `json:"internalPort"`
	Protocol       string                  `json:"protocol"`
	SourceType     string                  `json:"sourceType"`
	BuildContext   string                  `json:"buildContext"`
	DefaultTTL     int                     `json:"defaultTtl"`
	MemoryLimitMB  int                     `json:"memoryLimitMb"`
	CPULimit       int                     `json:"cpuLimit"`
	PidsLimit      int                     `json:"pidsLimit"`
	AccessGrants   *[]domain.AccessSubject `json:"accessGrants"`
}

func normalizeStatus(in *ChallengeAdminInput) error {
	in.Status = strings.TrimSpace(in.Status)
	if in.Status == "" {
		if in.IsPublished {
			in.Status = string(domain.ChallengePublished)
		} else {
			in.Status = string(domain.ChallengeDraft)
		}
	}
	switch domain.ChallengeStatus(in.Status) {
	case domain.ChallengeDraft, domain.ChallengeHidden, domain.ChallengePublished, domain.ChallengeArchived:
	default:
		return errors.New("invalid status")
	}
	in.IsPublished = in.Status == string(domain.ChallengePublished)
	return nil
}

type FlagInput struct {
	Type          string `json:"type"`
	Content       string `json:"content"`
	CaseSensitive bool   `json:"caseSensitive"`
}

func (s *ChallengeService) Create(ctx context.Context, in ChallengeAdminInput, creatorID uint) (*domain.Challenge, error) {
	if err := normalizeStatus(&in); err != nil {
		return nil, err
	}
	in.Title = strings.TrimSpace(in.Title)
	if in.Title == "" {
		return nil, errors.New("title required")
	}
	if in.CategoryID == 0 {
		return nil, errors.New("categoryId required")
	}
	if _, err := s.categories.FindByID(ctx, in.CategoryID); err != nil {
		return nil, fmt.Errorf("category: %w", err)
	}
	if in.IsDynamic {
		if in.InternalPort <= 0 {
			return nil, errors.New("internalPort required for dynamic challenge")
		}
		switch normalizeSourceType(in.SourceType) {
		case domain.SourceImage:
			if strings.TrimSpace(in.Image) == "" {
				return nil, errors.New("image required for image-source challenge")
			}
		case domain.SourceDockerfile, domain.SourceCompose:
			// source files uploaded separately; nothing to validate at create time
		}
	}
	if !in.IsDynamic && len(in.Flags) == 0 {
		return nil, errors.New("at least one flag required for static challenge")
	}
	for _, f := range in.Flags {
		if strings.TrimSpace(f.Content) == "" {
			return nil, errors.New("flag content required")
		}
		if f.Type != string(domain.FlagStatic) && f.Type != string(domain.FlagRegex) {
			return nil, fmt.Errorf("invalid flag type: %s", f.Type)
		}
	}

	proto := normalizeProtocol(in.Protocol)
	sourceType := normalizeSourceType(in.SourceType)

	normalize(&in.BaseScore, &in.MinScore, &in.Decay, &in.Difficulty)

	c := &domain.Challenge{
		CategoryID:     in.CategoryID,
		Title:          in.Title,
		Description:    in.Description,
		EditorialMD:    in.EditorialMD,
		BaseScore:      in.BaseScore,
		MinScore:       in.MinScore,
		Decay:          in.Decay,
		Difficulty:     in.Difficulty,
		Status:         domain.ChallengeStatus(in.Status),
		IsPublished:    in.IsPublished,
		ConnectionInfo: in.ConnectionInfo,
		Tags:           in.Tags,
		IsDynamic:      in.IsDynamic,
		Image:          strings.TrimSpace(in.Image),
		InternalPort:   in.InternalPort,
		Protocol:       proto,
		SourceType:     sourceType,
		BuildContext:   strings.TrimSpace(in.BuildContext),
		DefaultTTL:     in.DefaultTTL,
		MemoryLimitMB:  in.MemoryLimitMB,
		CPULimit:       in.CPULimit,
		PidsLimit:      in.PidsLimit,
		CreatedBy:      creatorID,
	}
	if err := s.challenges.Create(ctx, c); err != nil {
		return nil, err
	}
	for _, f := range in.Flags {
		flag := &domain.Flag{
			ChallengeID:   c.ID,
			Type:          domain.FlagType(f.Type),
			Content:       strings.TrimSpace(f.Content),
			CaseSensitive: f.CaseSensitive,
		}
		if err := s.flags.Create(ctx, flag); err != nil {
			_ = s.challenges.Delete(ctx, c.ID)
			return nil, err
		}
	}
	if in.AccessGrants != nil && s.access != nil {
		if err := s.access.SetGrants(ctx, c.ID, *in.AccessGrants); err != nil {
			return nil, err
		}
	}
	return c, nil
}

func (s *ChallengeService) Update(ctx context.Context, id uint, in ChallengeAdminInput) (*domain.Challenge, error) {
	c, err := s.challenges.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	in.Title = strings.TrimSpace(in.Title)
	if in.Title != "" {
		c.Title = in.Title
	}
	if in.CategoryID > 0 {
		if _, err := s.categories.FindByID(ctx, in.CategoryID); err != nil {
			return nil, fmt.Errorf("category: %w", err)
		}
		c.CategoryID = in.CategoryID
	}
	c.Description = in.Description
	c.EditorialMD = in.EditorialMD
	c.BaseScore = in.BaseScore
	c.MinScore = in.MinScore
	c.Decay = in.Decay
	c.Difficulty = in.Difficulty
	if err := normalizeStatus(&in); err != nil {
		return nil, err
	}
	c.Status = domain.ChallengeStatus(in.Status)
	c.IsPublished = in.IsPublished
	c.ConnectionInfo = in.ConnectionInfo
	c.Tags = in.Tags
	c.IsDynamic = in.IsDynamic
	c.Image = strings.TrimSpace(in.Image)
	c.InternalPort = in.InternalPort
	c.Protocol = normalizeProtocol(in.Protocol)
	if c.IsDynamic {
		c.SourceType = normalizeSourceType(in.SourceType)
		c.BuildContext = strings.TrimSpace(in.BuildContext)
	}
	c.DefaultTTL = in.DefaultTTL
	c.MemoryLimitMB = in.MemoryLimitMB
	c.CPULimit = in.CPULimit
	c.PidsLimit = in.PidsLimit
	normalize(&c.BaseScore, &c.MinScore, &c.Decay, &c.Difficulty)

	if err := s.challenges.Update(ctx, c); err != nil {
		return nil, err
	}

	if len(in.Flags) > 0 {
		if err := s.flags.DeleteByChallengeID(ctx, c.ID); err != nil {
			return nil, err
		}
		for _, f := range in.Flags {
			flag := &domain.Flag{
				ChallengeID:   c.ID,
				Type:          domain.FlagType(f.Type),
				Content:       strings.TrimSpace(f.Content),
				CaseSensitive: f.CaseSensitive,
			}
			if err := s.flags.Create(ctx, flag); err != nil {
				return nil, err
			}
		}
	}
	if in.AccessGrants != nil && s.access != nil {
		if err := s.access.SetGrants(ctx, c.ID, *in.AccessGrants); err != nil {
			return nil, err
		}
	}
	return c, nil
}

func (s *ChallengeService) Delete(ctx context.Context, id uint) error {
	if err := s.flags.DeleteByChallengeID(ctx, id); err != nil {
		return err
	}
	return s.challenges.Delete(ctx, id)
}

type ChallengeView struct {
	*domain.Challenge
	SolveCount        int64                  `json:"solveCount"`
	UserScore         int                    `json:"userScore"`
	Solved            bool                   `json:"solved"`
	CompetitionID     *uint                  `json:"competitionId,omitempty"`
	CompetitionSolved bool                   `json:"competitionSolved"`
	CompetitionScore  int                    `json:"competitionScore"`
	Editorial         string                 `json:"editorial,omitempty"`
	Attachments       []*domain.Attachment   `json:"attachments"`
	Flags             []AdminFlag            `json:"flags,omitempty"`
	AccessGrants      []domain.AccessSubject `json:"accessGrants,omitempty"`
}

func (s *ChallengeService) SetAccessService(a *ChallengeAccessService) { s.access = a }

// SetCompetitionRepositories wires contest solve tracking. Without it the
// service keeps the legacy practice-only behavior.
func (s *ChallengeService) SetCompetitionRepositories(comps domain.CompetitionRepository, solves domain.CompetitionSolveRepository) {
	s.competitions = comps
	s.competitionSolves = solves
}

// CanManage reports whether the viewer holds a manage grant on the challenge.
func (s *ChallengeService) CanManage(ctx context.Context, challengeID, userID uint) (bool, error) {
	if s.access == nil {
		return false, nil
	}
	return s.access.CanManageChallenge(ctx, challengeID, userID)
}

// AdminFlag exposes flag content for admin editing only.
type AdminFlag struct {
	ID            uint   `json:"id"`
	Type          string `json:"type"`
	Content       string `json:"content"`
	CaseSensitive bool   `json:"caseSensitive"`
}

// GetForAdmin returns the challenge with flags and attachments for admin editing.
func (s *ChallengeService) GetForAdmin(ctx context.Context, id uint) (*ChallengeView, error) {
	c, err := s.challenges.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	view := &ChallengeView{Challenge: c}
	view.Attachments, _ = s.attachments.ListByChallengeID(ctx, c.ID)
	rawFlags, _ := s.flags.FindByChallengeID(ctx, c.ID)
	view.Flags = make([]AdminFlag, 0, len(rawFlags))
	for _, f := range rawFlags {
		view.Flags = append(view.Flags, AdminFlag{
			ID:            f.ID,
			Type:          string(f.Type),
			Content:       f.Content,
			CaseSensitive: f.CaseSensitive,
		})
	}
	view.SolveCount, _ = s.solves.CountByChallenge(ctx, c.ID)
	if s.access != nil {
		view.AccessGrants, _ = s.access.ListGrants(ctx, c.ID)
	}
	return view, nil
}

// EnsureVisible loads a challenge and rejects unpublished ones unless the
// caller is an admin. Used by every public route that resolves a challenge by
// id (detail, attachments, hints, discussions, submissions).
func (s *ChallengeService) EnsureVisible(ctx context.Context, id uint, allowUnpublished bool) (*domain.Challenge, error) {
	c, err := s.challenges.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !c.IsPublished && !allowUnpublished {
		return nil, domain.ErrNotFound
	}
	return c, nil
}

func (s *ChallengeService) GetForUser(ctx context.Context, id, userID uint, includeUnpublished bool, competitionID uint) (*ChallengeView, error) {
	c, err := s.challenges.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if s.access != nil {
		ok, err := s.access.CanView(ctx, c, userID, includeUnpublished)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, domain.ErrNotFound
		}
	} else if !c.IsPublished && !includeUnpublished {
		return nil, domain.ErrNotFound
	}
	view := &ChallengeView{Challenge: c}
	view.Attachments, _ = s.attachments.ListByChallengeID(ctx, c.ID)
	view.SolveCount, _ = s.solves.CountByChallenge(ctx, c.ID)
	if userID > 0 {
		if sol, err := s.solves.FindByUserAndChallenge(ctx, userID, c.ID); err == nil && sol != nil {
			view.Solved = true
			view.UserScore = sol.Score
		}
		if competitionID > 0 && s.competitionSolves != nil {
			if sol, err := s.competitionSolves.FindByUserAndChallenge(ctx, competitionID, userID, c.ID); err == nil && sol != nil {
				view.CompetitionID = &competitionID
				view.CompetitionSolved = true
				view.CompetitionScore = sol.Score
			}
		}
	}
	if view.Solved {
		view.Editorial = c.EditorialMD
	}
	return view, nil
}

func (s *ChallengeService) ListForUser(ctx context.Context, filter domain.ChallengeFilter, userID uint) ([]*ChallengeView, int64, error) {
	filter.OnlyPublished = true
	filter.AccessUserID = userID
	if s.access != nil {
		filter.AccessTeamID = s.access.TeamIDForUser(ctx, userID)
	}
	cs, total, err := s.challenges.List(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	out := make([]*ChallengeView, 0, len(cs))
	competitionID := filter.CompetitionID
	for _, c := range cs {
		v := &ChallengeView{Challenge: c}
		v.SolveCount, _ = s.solves.CountByChallenge(ctx, c.ID)
		if userID > 0 {
			if sol, err := s.solves.FindByUserAndChallenge(ctx, userID, c.ID); err == nil && sol != nil {
				v.Solved = true
				v.UserScore = sol.Score
			}
			if competitionID > 0 && s.competitionSolves != nil {
				v.CompetitionID = &competitionID
				if sol, err := s.competitionSolves.FindByUserAndChallenge(ctx, competitionID, userID, c.ID); err == nil && sol != nil {
					v.CompetitionSolved = true
					v.CompetitionScore = sol.Score
				}
			}
		}
		out = append(out, v)
	}
	return out, total, nil
}

func (s *ChallengeService) ListAll(ctx context.Context, filter domain.ChallengeFilter) ([]*domain.Challenge, int64, error) {
	return s.challenges.List(ctx, filter)
}

func (s *ChallengeService) ListManagedFor(ctx context.Context, filter domain.ChallengeFilter, userID uint) ([]*domain.Challenge, int64, error) {
	if userID == 0 {
		return []*domain.Challenge{}, 0, nil
	}
	filter.ManagedByUserID = userID
	if s.access != nil {
		filter.ManagedByTeamID = s.access.TeamIDForUser(ctx, userID)
	}
	return s.challenges.List(ctx, filter)
}

type SubmissionResult struct {
	Correct       bool   `json:"correct"`
	Score         int    `json:"score"`
	AlreadySolved bool   `json:"alreadySolved,omitempty"`
	CompetitionID *uint  `json:"competitionId,omitempty"`
	Message       string `json:"message"`
}

func (s *ChallengeService) SubmitFlag(ctx context.Context, userID, challengeID uint, flag string, ip string, competitionID uint, allowUnpublished bool) (*SubmissionResult, error) {
	flag = strings.TrimSpace(flag)
	if flag == "" {
		return nil, errors.New("flag required")
	}
	c, err := s.challenges.FindByID(ctx, challengeID)
	if err != nil {
		return nil, err
	}
	if s.access != nil {
		ok, err := s.access.CanView(ctx, c, userID, allowUnpublished)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, domain.ErrNotFound
		}
	} else if !c.IsPublished && !allowUnpublished {
		return nil, domain.ErrNotFound
	}

	comp, err := s.resolveCompetition(ctx, competitionID, c, userID)
	if err != nil {
		return nil, err
	}
	var compID *uint
	if comp != nil {
		id := comp.ID
		compID = &id
	}

	alreadySolved := false
	if compID != nil {
		if sol, err := s.competitionSolves.FindByUserAndChallenge(ctx, *compID, userID, challengeID); err == nil && sol != nil {
			alreadySolved = true
		}
	} else if sol, err := s.solves.FindByUserAndChallenge(ctx, userID, challengeID); err == nil && sol != nil {
		alreadySolved = true
	}

	recent, _ := s.submissions.CountRecent(ctx, userID, time.Now().Add(-10*time.Second))
	if recent >= 5 {
		return nil, domain.ErrSubmissionTooFast
	}

	matched := false
	if c.IsDynamic {
		if s.instances != nil {
			matched = s.instances.ValidateDynamicFlag(ctx, userID, challengeID, flag)
		}
	} else {
		flags, err := s.flags.FindByChallengeID(ctx, challengeID)
		if err != nil {
			return nil, err
		}
		for _, f := range flags {
			m, err := crypto.NewFlagMatcher(string(f.Type), f.Content, f.CaseSensitive)
			if err != nil || m == nil {
				continue
			}
			if m.Match(flag) {
				matched = true
				break
			}
		}
	}

	sub := &domain.Submission{
		UserID:        userID,
		ChallengeID:   challengeID,
		CompetitionID: compID,
		Flag:          flag,
		IsCorrect:     matched,
		IP:            ip,
	}
	_ = s.submissions.Create(ctx, sub)
	metrics.SubmissionsTotal.WithLabelValues(fmt.Sprintf("%d", challengeID), boolLabel(matched)).Inc()

	if !matched {
		return &SubmissionResult{Correct: false, CompetitionID: compID, Message: "incorrect"}, nil
	}
	if alreadySolved {
		return &SubmissionResult{
			Correct:       true,
			Score:         0,
			AlreadySolved: true,
			CompetitionID: compID,
			Message:       "already solved",
		}, nil
	}

	score, err := s.computeScore(ctx, c, userID, compID)
	if err != nil {
		return nil, err
	}

	var count int64
	if compID != nil {
		count, _ = s.competitionSolves.CountByCompetitionChallenge(ctx, *compID, challengeID)
	} else {
		count, _ = s.solves.CountByChallenge(ctx, challengeID)
	}
	isFirst := count == 0

	if compID != nil {
		sol := &domain.CompetitionSolve{
			CompetitionID: *compID,
			UserID:        userID,
			ChallengeID:   challengeID,
			Score:         score,
			IsFirstBlood:  isFirst,
			SolvedAt:      time.Now(),
		}
		if err := s.competitionSolves.Create(ctx, sol); err != nil {
			return nil, err
		}
	} else {
		sol := &domain.Solve{
			UserID:       userID,
			ChallengeID:  challengeID,
			Score:        score,
			IsFirstBlood: isFirst,
			SolvedAt:     time.Now(),
		}
		if err := s.solves.Create(ctx, sol); err != nil {
			return nil, err
		}
		if err := s.users.UpdateScore(ctx, userID, score); err != nil {
			return nil, err
		}
	}

	// 容器题：解题后立即释放资源，实例标记为 auto_expired。
	if c.IsDynamic && s.instances != nil {
		_ = s.instances.StopByChallenge(ctx, userID, challengeID)
	}

	if s.notifier != nil {
		title := "已解题：" + c.Title
		link := "/challenges/" + itoa(int(c.ID))
		if compID != nil {
			title = "已解出比赛题目：" + c.Title
			link += "?competition=" + itoa(int(*compID))
		}
		body := "获得 " + itoa(score) + " 分" + firstBloodSuffix(isFirst)
		_ = s.notifier.Dispatch(ctx, userID, domain.NotifySolve, title, body, link)
	}

	if compID == nil && s.publisher != nil {
		user, _ := s.users.FindByID(ctx, userID)
		username := "user"
		if user != nil {
			username = user.Username
		}
		s.publisher.PublishSolve(c.ID, c.Title, username, score, isFirst)
	}
	metrics.SolvesTotal.WithLabelValues(fmt.Sprintf("%d", c.ID)).Inc()

	return &SubmissionResult{Correct: true, Score: score, CompetitionID: compID, Message: "correct"}, nil
}

func (s *ChallengeService) resolveCompetition(ctx context.Context, requestedID uint, c *domain.Challenge, userID uint) (*domain.Competition, error) {
	if s.competitions == nil {
		if requestedID > 0 {
			return nil, fmt.Errorf("%w: competition mode unavailable", domain.ErrInvalidArgument)
		}
		return nil, nil
	}
	if requestedID == 0 {
		active, err := s.competitions.FindActive(ctx)
		if err != nil || active == nil {
			return nil, nil
		}
		if !competitionIsLive(active) || !competitionCoversChallenge(active, c.ID) {
			return nil, nil
		}
		if s.access != nil {
			ok, err := s.access.CanViewCompetition(ctx, active, userID, false)
			if err != nil || !ok {
				return nil, nil
			}
		}
		return active, nil
	}

	comp, err := s.competitions.FindByID(ctx, requestedID)
	if err != nil {
		return nil, err
	}
	if !comp.IsActive || comp.ArchivedAt != nil {
		return nil, fmt.Errorf("%w: competition is not active", domain.ErrInvalidArgument)
	}
	if !competitionIsLive(comp) {
		return nil, fmt.Errorf("%w: competition is not live", domain.ErrInvalidArgument)
	}
	if !competitionCoversChallenge(comp, c.ID) {
		return nil, fmt.Errorf("%w: challenge is not part of this competition", domain.ErrInvalidArgument)
	}
	if s.access != nil {
		ok, err := s.access.CanViewCompetition(ctx, comp, userID, false)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, domain.ErrForbidden
		}
	}
	return comp, nil
}

func competitionIsLive(c *domain.Competition) bool {
	if c == nil || c.ArchivedAt != nil {
		return false
	}
	now := time.Now()
	if c.StartAt != nil && now.Before(*c.StartAt) {
		return false
	}
	if c.EndAt != nil && now.After(*c.EndAt) {
		return false
	}
	return true
}

func competitionCoversChallenge(c *domain.Competition, challengeID uint) bool {
	if c == nil {
		return false
	}
	if len(c.Challenges) == 0 {
		return true
	}
	for _, ch := range c.Challenges {
		if ch.ID == challengeID {
			return true
		}
	}
	return false
}

func firstBloodSuffix(b bool) string {
	if !b {
		return ""
	}
	return " · 首杀"
}

func boolLabel(b bool) string {
	if b {
		return "correct"
	}
	return "incorrect"
}

// computeScore applies the dynamic decay formula and then deducts the
// cumulative cost of hints the user has unlocked on this challenge.
// Hint cost is a ratio in [0, 1]; final score = base * (1 - sum(ratios)).
func (s *ChallengeService) computeScore(ctx context.Context, c *domain.Challenge, userID uint, competitionID *uint) (int, error) {
	raw, err := s.computeRawScore(ctx, c, competitionID)
	if err != nil {
		return 0, err
	}
	if s.hints == nil {
		return raw, nil
	}
	reduction, err := s.hints.CostReductionForUser(ctx, userID, c.ID)
	if err != nil || reduction <= 0 {
		return raw, nil
	}
	if reduction > 1 {
		reduction = 1
	}
	final := int(math.Round(float64(raw) * (1 - float64(reduction))))
	if final < c.MinScore {
		final = c.MinScore
	}
	if final < 0 {
		final = 0
	}
	return final, nil
}

func (s *ChallengeService) computeRawScore(ctx context.Context, c *domain.Challenge, competitionID *uint) (int, error) {
	var (
		count int64
		err   error
	)
	if competitionID != nil && s.competitionSolves != nil {
		count, err = s.competitionSolves.CountByCompetitionChallenge(ctx, *competitionID, c.ID)
	} else {
		count, err = s.solves.CountByChallenge(ctx, c.ID)
	}
	if err != nil {
		return 0, err
	}
	if c.MinScore < 0 {
		c.MinScore = 0
	}
	if c.BaseScore <= c.MinScore {
		return c.BaseScore, nil
	}
	decay := c.Decay
	if decay <= 0 {
		decay = 10
	}
	diff := float64(c.BaseScore - c.MinScore)
	k := math.Exp(-float64(count) / float64(decay))
	score := int(math.Round(diff*k)) + c.MinScore
	if score < c.MinScore {
		score = c.MinScore
	}
	return score, nil
}

func normalize(base, min, decay, diff *int) {
	if *base <= 0 {
		*base = 500
	}
	if *min < 0 {
		*min = 100
	}
	if *min > *base {
		*min = *base
	}
	if *decay <= 0 {
		*decay = 10
	}
	if *diff < 1 {
		*diff = 1
	}
	if *diff > 5 {
		*diff = 5
	}
}

func normalizeProtocol(p string) domain.ChallengeProtocol {
	switch strings.ToLower(strings.TrimSpace(p)) {
	case "http":
		return domain.ProtocolHTTP
	default:
		return domain.ProtocolTCP
	}
}

func normalizeSourceType(s string) domain.ChallengeSourceType {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "dockerfile":
		return domain.SourceDockerfile
	case "compose":
		return domain.SourceCompose
	default:
		return domain.SourceImage
	}
}

// UploadSource writes a single source file under the challenge directory.
func (s *ChallengeService) UploadSource(ctx context.Context, challengeID uint, relPath string, r io.Reader) error {
	if s.sources == nil {
		return errors.New("challenge source storage not configured")
	}
	if relPath == "" {
		return errors.New("path required")
	}
	if _, err := s.challenges.FindByID(ctx, challengeID); err != nil {
		return err
	}
	return s.sources.Write(ctx, challengeID, relPath, r)
}

// ListSources returns the file tree of the challenge source directory.
func (s *ChallengeService) ListSources(ctx context.Context, challengeID uint) ([]storage.SourceEntry, error) {
	if s.sources == nil {
		return nil, errors.New("challenge source storage not configured")
	}
	return s.sources.Tree(ctx, challengeID)
}

// DeleteSource removes a file inside the challenge source directory.
func (s *ChallengeService) DeleteSource(ctx context.Context, challengeID uint, relPath string) error {
	if s.sources == nil {
		return errors.New("challenge source storage not configured")
	}
	return s.sources.Delete(ctx, challengeID, relPath)
}

// OpenSource opens a source file for streaming download.
func (s *ChallengeService) OpenSource(ctx context.Context, challengeID uint, relPath string) (io.ReadCloser, int64, error) {
	if s.sources == nil {
		return nil, 0, errors.New("challenge source storage not configured")
	}
	return s.sources.Open(ctx, challengeID, relPath)
}

// PurgeSources wipes the entire source directory (used when a challenge is deleted).
func (s *ChallengeService) PurgeSources(challengeID uint) error {
	if s.sources == nil {
		return nil
	}
	return s.sources.RemoveChallenge(challengeID)
}
