package service

import (
	"github.com/ctf-oj/backend/internal/infrastructure/realtime"
)

// HubPublisher adapts realtime.Hub to service.EventPublisher.
type HubPublisher struct {
	Hub *realtime.Hub
}

func (p *HubPublisher) PublishTo(userID uint, typ string, payload interface{}) {
	if p == nil || p.Hub == nil {
		return
	}
	p.Hub.SafePublishTo(userID, typ, payload)
}

func (p *HubPublisher) PublishSolve(challengeID uint, challengeTitle, username string, score int, firstBlood bool) {
	if p == nil || p.Hub == nil {
		return
	}
	p.Hub.SafePublish(realtime.EventSolve, SolveEvent{
		ChallengeID:    challengeID,
		ChallengeTitle: challengeTitle,
		Username:       username,
		Score:          score,
		IsFirstBlood:   firstBlood,
	})
}
