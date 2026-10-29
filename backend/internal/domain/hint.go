package domain

import "time"

/**
 * ChallengeHint — a paid hint attached to a challenge.
 *
 * Cost model (CTFd-style): each hint has a `cost_ratio` in [0, 1].
 * When a user solves the challenge, the actual score awarded is reduced by
 * the sum of the cost_ratios of all hints they unlocked:
 *
 *   final = round(raw_score * (1 - sum(unlocked cost_ratios)))
 *
 * Hints are revealed in order (sort_order ascending); the frontend may hide
 * later hints until the previous one is unlocked (best-effort — backend does
 * not enforce ordering of unlocks).
 */
type ChallengeHint struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ChallengeID uint      `gorm:"not null;index" json:"challengeId"`
	SortOrder   int       `gorm:"not null;default:0" json:"sortOrder"`
	CostRatio   float32   `gorm:"not null;default:0.0" json:"costRatio"`
	Content     string    `gorm:"type:text;not null;column:content_md" json:"content"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

func (ChallengeHint) TableName() string { return "challenge_hints" }

/**
 * HintUnlock — permanent record that a user has unlocked a hint.
 * The unlock is independent of whether the user ever solves the challenge.
 */
type HintUnlock struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	UserID     uint      `gorm:"not null;index;uniqueIndex:uniq_user_hint" json:"userId"`
	HintID     uint      `gorm:"not null;index;uniqueIndex:uniq_user_hint" json:"hintId"`
	UnlockedAt time.Time `json:"unlockedAt"`
}

func (HintUnlock) TableName() string { return "hint_unlocks" }
