package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/ctf-oj/backend/internal/domain"
)

type AnnouncementService struct {
	repos domain.AnnouncementRepository
}

func NewAnnouncementService(r domain.AnnouncementRepository) *AnnouncementService {
	return &AnnouncementService{repos: r}
}

type AnnouncementInput struct {
	Title       string `json:"title"`
	ContentMD   string `json:"contentMd"`
	IsPinned    bool   `json:"isPinned"`
	IsPublished bool   `json:"isPublished"`
}

func (s *AnnouncementService) List(ctx context.Context, onlyPublished bool, page, pageSize int) ([]*domain.Announcement, int64, error) {
	return s.repos.List(ctx, onlyPublished, page, pageSize)
}

func (s *AnnouncementService) Get(ctx context.Context, id uint) (*domain.Announcement, error) {
	a, err := s.repos.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return a, nil
}

func (s *AnnouncementService) Create(ctx context.Context, in AnnouncementInput, creatorID uint) (*domain.Announcement, error) {
	in.Title = strings.TrimSpace(in.Title)
	if in.Title == "" {
		return nil, errors.New("title required")
	}
	if len(in.Title) > 255 {
		return nil, errors.New("title too long")
	}
	if len(in.ContentMD) > 20_000 {
		return nil, errors.New("content too long")
	}
	a := &domain.Announcement{
		Title:       in.Title,
		ContentMD:   in.ContentMD,
		IsPinned:    in.IsPinned,
		IsPublished: in.IsPublished,
		CreatedBy:   creatorID,
	}
	if in.IsPublished {
		now := time.Now()
		a.PublishedAt = &now
	}
	if err := s.repos.Create(ctx, a); err != nil {
		return nil, err
	}
	return a, nil
}

func (s *AnnouncementService) Update(ctx context.Context, id uint, in AnnouncementInput) (*domain.Announcement, error) {
	a, err := s.repos.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	in.Title = strings.TrimSpace(in.Title)
	if in.Title != "" {
		a.Title = in.Title
	}
	if len(in.Title) > 255 {
		return nil, errors.New("title too long")
	}
	if len(in.ContentMD) > 20_000 {
		return nil, errors.New("content too long")
	}
	a.ContentMD = in.ContentMD
	wasPublished := a.IsPublished
	a.IsPinned = in.IsPinned
	a.IsPublished = in.IsPublished
	if in.IsPublished && !wasPublished && a.PublishedAt == nil {
		now := time.Now()
		a.PublishedAt = &now
	}
	if err := s.repos.Update(ctx, a); err != nil {
		return nil, err
	}
	return a, nil
}

func (s *AnnouncementService) Delete(ctx context.Context, id uint) error {
	return s.repos.Delete(ctx, id)
}
