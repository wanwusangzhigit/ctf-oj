package service

import (
	"context"
	"errors"
	"strings"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/infrastructure/mailer"
)

type BroadcastService struct {
	db     *gorm.DB
	mailer mailer.Mailer
}

func NewBroadcastService(db *gorm.DB, m mailer.Mailer) *BroadcastService {
	return &BroadcastService{db: db, mailer: m}
}

type BroadcastResult struct {
	Sent   int `json:"sent"`
	Failed int `json:"failed"`
}

// Send delivers a plain-text message to every active user with an email.
func (s *BroadcastService) Send(ctx context.Context, subject, body string) (*BroadcastResult, error) {
	subject = strings.TrimSpace(subject)
	body = strings.TrimSpace(body)
	if subject == "" || body == "" {
		return nil, domain.ErrInvalidArgument
	}
	if len(subject) > 200 || len(body) > 10_000 {
		return nil, domain.ErrInvalidArgument
	}
	if s.mailer == nil {
		return nil, errors.New("mailer not configured")
	}
	var users []*domain.User
	if err := s.db.WithContext(ctx).
		Where("is_banned = ? AND email <> ''", false).
		Find(&users).Error; err != nil {
		return nil, err
	}
	res := &BroadcastResult{}
	for _, u := range users {
		if err := s.mailer.Send(ctx, mailer.Message{
			To:      u.Email,
			Subject: subject,
			Body:    body,
		}); err != nil {
			res.Failed++
			continue
		}
		res.Sent++
	}
	return res, nil
}
