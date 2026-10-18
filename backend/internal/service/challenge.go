package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/crypto"
)

type ChallengeService struct {
	challenges   domain.ChallengeRepository
	categories   domain.CategoryRepository
	flags        domain.FlagRepository
	attachments  domain.AttachmentRepository
	submissions  domain.SubmissionRepository
	solves       domain.SolveRepository
	users        domain.UserRepository
	instances    *InstanceService
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
	}
}

type ChallengeAdminInput struct {
	CategoryID      uint              `json:"categoryId"`
	Title           string            `json:"title"`
	Description     string            `json:"description"`
	BaseScore       int               `json:"baseScore"`
	MinScore        int               `json:"minScore"`
	Decay           int               `json:"decay"`
	Difficulty      int               `json:"difficulty"`
	IsPublished     bool              `json:"isPublished"`
	ConnectionInfo  string            `json:"connectionInfo"`
	Tags            string            `json:"tags"`
	Flags           []FlagInput       `json:"flags"`
	IsDynamic       bool              `json:"isDynamic"`
	Image           string            `json:"image"`
	InternalPort    int               `json:"internalPort"`
	DefaultTTL      int               `json:"defaultTtl"`
	MemoryLimitMB   int               `json:"memoryLimitMb"`
	CPULimit        int               `json:"cpuLimit"`
}

type FlagInput struct {
	Type          string `json:"type"`
	Content       string `json:"content"`
	CaseSensitive bool   `json:"caseSensitive"`
}

func (s *ChallengeService) Create(ctx context.Context, in ChallengeAdminInput, creatorID uint) (*domain.Challenge, error) {
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
		if strings.TrimSpace(in.Image) == "" {
			return nil, errors.New("image required for dynamic challenge")
		}
		if in.InternalPort <= 0 {
			return nil, errors.New("internalPort required for dynamic challenge")
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

	normalize(&in.BaseScore, &in.MinScore, &in.Decay, &in.Difficulty)

	c := &domain.Challenge{
		CategoryID:     in.CategoryID,
		Title:          in.Title,
		Description:    in.Description,
		BaseScore:      in.BaseScore,
		MinScore:       in.MinScore,
		Decay:          in.Decay,
		Difficulty:     in.Difficulty,
		IsPublished:    in.IsPublished,
		ConnectionInfo: in.ConnectionInfo,
		Tags:           in.Tags,
		IsDynamic:      in.IsDynamic,
		Image:          strings.TrimSpace(in.Image),
		InternalPort:   in.InternalPort,
		DefaultTTL:     in.DefaultTTL,
		MemoryLimitMB:  in.MemoryLimitMB,
		CPULimit:      in.CPULimit,
		CreatedBy:     creatorID,
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
	c.BaseScore = in.BaseScore
	c.MinScore = in.MinScore
	c.Decay = in.Decay
	c.Difficulty = in.Difficulty
	c.IsPublished = in.IsPublished
	c.ConnectionInfo = in.ConnectionInfo
	c.Tags = in.Tags
	c.IsDynamic = in.IsDynamic
	c.Image = strings.TrimSpace(in.Image)
	c.InternalPort = in.InternalPort
	c.DefaultTTL = in.DefaultTTL
	c.MemoryLimitMB = in.MemoryLimitMB
	c.CPULimit = in.CPULimit
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
	SolveCount int64                 `json:"solveCount"`
	UserScore  int                   `json:"userScore"`
	Solved     bool                  `json:"solved"`
	Attachments []*domain.Attachment `json:"attachments"`
}

func (s *ChallengeService) GetForUser(ctx context.Context, id, userID uint) (*ChallengeView, error) {
	c, err := s.challenges.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	view := &ChallengeView{Challenge: c}
	view.Attachments, _ = s.attachments.ListByChallengeID(ctx, c.ID)
	view.SolveCount, _ = s.solves.CountByChallenge(ctx, c.ID)
	if userID > 0 {
		if sol, err := s.solves.FindByUserAndChallenge(ctx, userID, c.ID); err == nil && sol != nil {
			view.Solved = true
			view.UserScore = sol.Score
		}
	}
	return view, nil
}

func (s *ChallengeService) ListForUser(ctx context.Context, filter domain.ChallengeFilter, userID uint) ([]*ChallengeView, int64, error) {
	filter.OnlyPublished = true
	cs, total, err := s.challenges.List(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	out := make([]*ChallengeView, 0, len(cs))
	for _, c := range cs {
		v := &ChallengeView{Challenge: c}
		v.SolveCount, _ = s.solves.CountByChallenge(ctx, c.ID)
		if userID > 0 {
			if sol, err := s.solves.FindByUserAndChallenge(ctx, userID, c.ID); err == nil && sol != nil {
				v.Solved = true
				v.UserScore = sol.Score
			}
		}
		out = append(out, v)
	}
	return out, total, nil
}

func (s *ChallengeService) ListAll(ctx context.Context, filter domain.ChallengeFilter) ([]*domain.Challenge, int64, error) {
	return s.challenges.List(ctx, filter)
}

type SubmissionResult struct {
	Correct bool   `json:"correct"`
	Score   int    `json:"score"`
	Message string `json:"message"`
}

func (s *ChallengeService) SubmitFlag(ctx context.Context, userID, challengeID uint, flag string, ip string) (*SubmissionResult, error) {
	flag = strings.TrimSpace(flag)
	if flag == "" {
		return nil, errors.New("flag required")
	}
	c, err := s.challenges.FindByID(ctx, challengeID)
	if err != nil {
		return nil, err
	}
	if !c.IsPublished {
		return nil, domain.ErrNotFound
	}

	if sol, _ := s.solves.FindByUserAndChallenge(ctx, userID, challengeID); sol != nil {
		return &SubmissionResult{Correct: true, Score: sol.Score, Message: "already solved"}, nil
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
		UserID:      userID,
		ChallengeID: challengeID,
		Flag:        flag,
		IsCorrect:   matched,
		IP:          ip,
	}
	_ = s.submissions.Create(ctx, sub)

	if !matched {
		return &SubmissionResult{Correct: false, Message: "incorrect"}, nil
	}

	score, err := s.computeScore(ctx, c)
	if err != nil {
		return nil, err
	}

	count, _ := s.solves.CountByChallenge(ctx, challengeID)
	isFirst := count == 0

	sol := &domain.Solve{
		UserID:        userID,
		ChallengeID:   challengeID,
		Score:         score,
		IsFirstBlood:  isFirst,
		SolvedAt:      time.Now(),
	}
	if err := s.solves.Create(ctx, sol); err != nil {
		return nil, err
	}
	if err := s.users.UpdateScore(ctx, userID, score); err != nil {
		return nil, err
	}

	return &SubmissionResult{Correct: true, Score: score, Message: "correct"}, nil
}

func (s *ChallengeService) computeScore(ctx context.Context, c *domain.Challenge) (int, error) {
	count, err := s.solves.CountByChallenge(ctx, c.ID)
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
