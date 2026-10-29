package domain

import "time"

type FeedItem struct {
	Kind           string    `json:"kind"` // solve | writeup
	UserID         uint      `json:"userId"`
	Username       string    `json:"username"`
	ChallengeID    uint      `json:"challengeId"`
	ChallengeTitle string    `json:"challengeTitle"`
	Title          string    `json:"title,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
}
