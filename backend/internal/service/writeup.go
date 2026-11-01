package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/ctf-oj/backend/internal/domain"
)

type WriteupService struct {
	repos        domain.WriteupRepository
	chals        domain.ChallengeRepository
	solves       domain.SolveRepository
	competitions domain.CompetitionRepository
	access       *ChallengeAccessService
}

func NewWriteupService(r domain.WriteupRepository, c domain.ChallengeRepository, s domain.SolveRepository) *WriteupService {
	return &WriteupService{repos: r, chals: c, solves: s}
}

func (s *WriteupService) SetAccessService(a *ChallengeAccessService) { s.access = a }

func (s *WriteupService) SetCompetitionRepository(c domain.CompetitionRepository) {
	s.competitions = c
}

type WriteupView struct {
	ID          uint              `json:"id"`
	ChallengeID uint              `json:"challengeId"`
	Title       string            `json:"title"`
	ContentMD   string            `json:"contentMd"`
	IsPublished bool              `json:"isPublished"`
	Author      domain.PublicUser `json:"author"`
	CreatedAt   time.Time         `json:"createdAt"`
	UpdatedAt   time.Time         `json:"updatedAt"`
}

type WriteupInput struct {
	Title       string `json:"title"`
	ContentMD   string `json:"contentMd"`
	IsPublished *bool  `json:"isPublished"`
}

func toWriteupView(w *domain.Writeup) WriteupView {
	v := WriteupView{
		ID:          w.ID,
		ChallengeID: w.ChallengeID,
		Title:       w.Title,
		ContentMD:   w.ContentMD,
		IsPublished: w.IsPublished,
		CreatedAt:   w.CreatedAt,
		UpdatedAt:   w.UpdatedAt,
	}
	if w.User != nil {
		v.Author = w.User.Public()
	}
	return v
}

func (s *WriteupService) List(ctx context.Context, challengeID, viewerID uint, isAdmin bool, competitionID uint) ([]WriteupView, error) {
	c, err := s.chals.FindByID(ctx, challengeID)
	if err != nil {
		return nil, err
	}
	if s.access != nil {
		ok, err := s.access.CanView(ctx, c, viewerID, isAdmin)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, domain.ErrNotFound
		}
	} else if !c.IsPublished && !isAdmin {
		return nil, domain.ErrNotFound
	}
	if !isAdmin {
		if err := s.blockedByCompetition(ctx, competitionID, challengeID); err != nil {
			return nil, err
		}
		if viewerID == 0 {
			return []WriteupView{}, nil
		}
		if _, err := s.solves.FindByUserAndChallenge(ctx, viewerID, challengeID); err != nil {
			return []WriteupView{}, nil
		}
	}
	ws, err := s.repos.ListByChallenge(ctx, challengeID, !isAdmin)
	if err != nil {
		return nil, err
	}
	out := make([]WriteupView, 0, len(ws))
	for _, w := range ws {
		if !isAdmin && w.UserID != viewerID && !w.IsPublished {
			continue
		}
		out = append(out, toWriteupView(w))
	}
	return out, nil
}

func (s *WriteupService) Create(ctx context.Context, userID, challengeID uint, in WriteupInput, isAdmin bool, competitionID uint) (*WriteupView, error) {
	in.Title = strings.TrimSpace(in.Title)
	in.ContentMD = strings.TrimSpace(in.ContentMD)
	if in.Title == "" || in.ContentMD == "" {
		return nil, errors.New("title and content required")
	}
	if len(in.Title) > 160 || len(in.ContentMD) > 50_000 {
		return nil, domain.ErrInvalidArgument
	}
	c, err := s.chals.FindByID(ctx, challengeID)
	if err != nil {
		return nil, err
	}
	if s.access != nil {
		ok, err := s.access.CanView(ctx, c, userID, isAdmin)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, domain.ErrNotFound
		}
	} else if !c.IsPublished && !isAdmin {
		return nil, domain.ErrNotFound
	}
	if !isAdmin {
		if err := s.blockedByCompetition(ctx, competitionID, challengeID); err != nil {
			return nil, err
		}
		if _, err := s.solves.FindByUserAndChallenge(ctx, userID, challengeID); err != nil {
			return nil, domain.ErrForbidden
		}
	}
	published := true
	if in.IsPublished != nil {
		published = *in.IsPublished
	}
	w := &domain.Writeup{
		ChallengeID: challengeID,
		UserID:      userID,
		Title:       in.Title,
		ContentMD:   in.ContentMD,
		IsPublished: published,
	}
	if err := s.repos.Create(ctx, w); err != nil {
		return nil, err
	}
	u, _ := s.repos.FindByID(ctx, w.ID)
	if u == nil {
		return nil, domain.ErrNotFound
	}
	v := toWriteupView(u)
	return &v, nil
}

func (s *WriteupService) blockedByCompetition(ctx context.Context, competitionID, challengeID uint) error {
	if competitionID == 0 || s.competitions == nil {
		return nil
	}
	c, err := s.competitions.FindByID(ctx, competitionID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil
		}
		return err
	}
	if competitionIsLive(c) && competitionCoversChallenge(c, challengeID) {
		return fmt.Errorf("%w: writeups unavailable during competition", domain.ErrForbidden)
	}
	return nil
}

func (s *WriteupService) Update(ctx context.Context, id, actorID uint, isAdmin bool, in WriteupInput) (*WriteupView, error) {
	w, err := s.repos.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if w.UserID != actorID && !isAdmin {
		return nil, domain.ErrForbidden
	}
	if t := strings.TrimSpace(in.Title); t != "" {
		w.Title = t
	}
	if c := strings.TrimSpace(in.ContentMD); c != "" {
		w.ContentMD = c
	}
	if in.IsPublished != nil {
		w.IsPublished = *in.IsPublished
	}
	if err := s.repos.Update(ctx, w); err != nil {
		return nil, err
	}
	u, err := s.repos.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	v := toWriteupView(u)
	return &v, nil
}

func (s *WriteupService) Delete(ctx context.Context, id, actorID uint, isAdmin bool) error {
	w, err := s.repos.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if w.UserID != actorID && !isAdmin {
		return domain.ErrForbidden
	}
	return s.repos.Delete(ctx, id)
}

func (s *WriteupService) ListMine(ctx context.Context, userID uint) ([]WriteupView, error) {
	ws, err := s.repos.ListByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]WriteupView, 0, len(ws))
	for _, w := range ws {
		out = append(out, toWriteupView(w))
	}
	return out, nil
}
