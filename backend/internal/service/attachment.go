package service

import (
	"context"
	"errors"
	"io"
	"mime/multipart"
	"strings"

	"github.com/ctf-oj/backend/internal/domain"
)

type AttachmentService struct {
	attachments domain.AttachmentRepository
	challenges  domain.ChallengeRepository
	storage     domain.Storage
}

func NewAttachmentService(a domain.AttachmentRepository, c domain.ChallengeRepository, s domain.Storage) *AttachmentService {
	return &AttachmentService{attachments: a, challenges: c, storage: s}
}

func (s *AttachmentService) Upload(ctx context.Context, challengeID uint, header *multipart.FileHeader) (*domain.Attachment, error) {
	if header == nil {
		return nil, errors.New("no file")
	}
	if header.Size > 50*1024*1024 {
		return nil, errors.New("file too large (>50MB)")
	}
	if _, err := s.challenges.FindByID(ctx, challengeID); err != nil {
		return nil, err
	}
	src, err := header.Open()
	if err != nil {
		return nil, err
	}
	defer src.Close()

	obj, err := s.storage.Save(ctx, src, header.Filename)
	if err != nil {
		return nil, err
	}
	a := &domain.Attachment{
		ChallengeID: challengeID,
		Filename:    header.Filename,
		StorageKey:  obj.Key,
		Size:        obj.Size,
		MimeType:    sanitizeMime(header.Header.Get("Content-Type")),
	}
	if err := s.attachments.Create(ctx, a); err != nil {
		_ = s.storage.Delete(ctx, obj.Key)
		return nil, err
	}
	return a, nil
}

func (s *AttachmentService) Download(ctx context.Context, attachmentID uint) (io.ReadCloser, *domain.Attachment, error) {
	a, err := s.attachments.FindByID(ctx, attachmentID)
	if err != nil {
		return nil, nil, err
	}
	rc, _, err := s.storage.Open(ctx, a.StorageKey)
	if err != nil {
		return nil, nil, err
	}
	return rc, a, nil
}

func (s *AttachmentService) ListByChallenge(ctx context.Context, challengeID uint) ([]*domain.Attachment, error) {
	return s.attachments.ListByChallengeID(ctx, challengeID)
}

func (s *AttachmentService) Delete(ctx context.Context, attachmentID uint) error {
	a, err := s.attachments.FindByID(ctx, attachmentID)
	if err != nil {
		return err
	}
	_ = s.storage.Delete(ctx, a.StorageKey)
	return s.attachments.Delete(ctx, attachmentID)
}

func sanitizeMime(s string) string {
	if s == "" {
		return "application/octet-stream"
	}
	if len(s) > 128 {
		s = s[:128]
	}
	if !strings.Contains(s, "/") {
		return "application/octet-stream"
	}
	return s
}
