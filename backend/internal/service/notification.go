package service

import (
	"context"

	"github.com/ctf-oj/backend/internal/domain"
)

// NotificationDispatcher abstracts creation of notification entries.
// Services depend on this interface rather than the concrete repository
// to avoid import cycles and to keep tests simple.
type NotificationDispatcher interface {
	Dispatch(ctx context.Context, userID uint, kind domain.NotificationKind, title, body, link string) error
	DispatchMany(ctx context.Context, userIDs []uint, kind domain.NotificationKind, title, body, link string) error
}

type RealtimePublisher interface {
	PublishTo(userID uint, typ string, payload interface{})
}

type NotificationService struct {
	repos     domain.NotificationRepository
	publisher RealtimePublisher
}

// SetPublisher enables live delivery of new notifications over WebSocket.
func (s *NotificationService) SetPublisher(p RealtimePublisher) {
	s.publisher = p
}

func NewNotificationService(r domain.NotificationRepository) *NotificationService {
	return &NotificationService{repos: r}
}

func (s *NotificationService) Dispatch(ctx context.Context, userID uint, kind domain.NotificationKind, title, body, link string) error {
	if userID == 0 || title == "" {
		return nil
	}
	n := &domain.Notification{
		UserID: userID,
		Kind:   kind,
		Title:  truncate(title, 255),
		Body:   truncate(body, 1000),
		Link:   truncate(link, 255),
	}
	if err := s.repos.Create(ctx, n); err != nil {
		return err
	}
	if s.publisher != nil {
		s.publisher.PublishTo(userID, "notification", n)
	}
	return nil
}

func (s *NotificationService) DispatchMany(ctx context.Context, userIDs []uint, kind domain.NotificationKind, title, body, link string) error {
	for _, id := range userIDs {
		if err := s.Dispatch(ctx, id, kind, title, body, link); err != nil {
			return err
		}
	}
	return nil
}

func (s *NotificationService) ListMine(ctx context.Context, userID uint, page, pageSize int) ([]*domain.Notification, int64, error) {
	return s.repos.ListByUser(ctx, userID, page, pageSize)
}

func (s *NotificationService) UnreadCount(ctx context.Context, userID uint) (int64, error) {
	return s.repos.UnreadCount(ctx, userID)
}

func (s *NotificationService) MarkRead(ctx context.Context, userID, id uint) error {
	return s.repos.MarkRead(ctx, id, userID)
}

func (s *NotificationService) MarkAllRead(ctx context.Context, userID uint) error {
	return s.repos.MarkAllRead(ctx, userID)
}
