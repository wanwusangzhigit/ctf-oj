package service

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/ctf-oj/backend/internal/domain"
)

/**
 * AuditService — thin wrapper around AuditLogRepository that builds the JSON
 * payload and normalizes the actor. Use Record() from anywhere the API layer
 * completes a mutating admin action.
 */
type AuditService struct {
	repo domain.AuditLogRepository
}

func NewAuditService(repo domain.AuditLogRepository) *AuditService {
	return &AuditService{repo: repo}
}

// Record captures an admin action. It never returns an error that callers
// must handle — audit failures must not break the user flow — so errors are
// swallowed (and could be logged in future).
func (s *AuditService) Record(ctx context.Context, actor *domain.User, action, targetType string, targetID uint, ip string, payload any) {
	if s == nil || actor == nil {
		return
	}
	var payloadStr string
	if payload != nil {
		if b, err := json.Marshal(payload); err == nil {
			payloadStr = string(b)
		}
	}
	if payloadStr == "" {
		payloadStr = "{}"
	}
	entry := &domain.AuditLog{
		ActorID:    actor.ID,
		ActorName:  actor.Username,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Payload:    payloadStr,
		IP:         ip,
	}
	// Use a detached context so the audit write still completes if the caller
	// cancels the request mid-flight. We don't bother with timeouts here.
	_ = s.repo.Record(context.Background(), entry)
}

func (s *AuditService) List(ctx context.Context, page, pageSize int, filter domain.AuditLogFilter) ([]*domain.AuditLog, int64, error) {
	if s == nil {
		return nil, 0, errors.New("audit service not configured")
	}
	return s.repo.List(ctx, page, pageSize, filter)
}
