package service

import (
	"testing"
	"time"

	"github.com/ctf-oj/backend/internal/domain"
)

// TestCompetitionLiveForChallenge locks down the single definition of
// "a challenge is currently inside a running contest". Scoring, writeup
// locking and discussion locking all share this predicate, so a regression
// here silently changes all three behaviours at once.
func TestCompetitionLiveForChallenge(t *testing.T) {
	now := time.Now()
	past := now.Add(-time.Hour)
	future := now.Add(time.Hour)
	archived := now.Add(-time.Minute)

	base := func() *domain.Competition {
		return &domain.Competition{
			ID:       7,
			IsActive: true,
			StartAt:  &past,
			EndAt:    &future,
		}
	}

	tests := []struct {
		name        string
		competition *domain.Competition
		challengeID uint
		want        bool
	}{
		{name: "nil competition", competition: nil, challengeID: 1, want: false},
		{name: "inactive", competition: func() *domain.Competition { c := base(); c.IsActive = false; return c }(), challengeID: 1, want: false},
		{name: "upcoming", competition: func() *domain.Competition { c := base(); c.StartAt = &future; c.EndAt = &future; return c }(), challengeID: 1, want: false},
		{name: "ended", competition: func() *domain.Competition { c := base(); c.EndAt = &past; return c }(), challengeID: 1, want: false},
		{name: "archived", competition: func() *domain.Competition { c := base(); c.ArchivedAt = &archived; return c }(), challengeID: 1, want: false},
		{name: "no bindings covers every challenge", competition: base(), challengeID: 999, want: true},
		{name: "bound challenge", competition: func() *domain.Competition {
			c := base()
			c.Challenges = []*domain.Challenge{{ID: 1}, {ID: 2}}
			return c
		}(), challengeID: 2, want: true},
		{name: "unbound challenge", competition: func() *domain.Competition {
			c := base()
			c.Challenges = []*domain.Challenge{{ID: 1}, {ID: 2}}
			return c
		}(), challengeID: 3, want: false},
		{name: "bound but inactive", competition: func() *domain.Competition {
			c := base()
			c.IsActive = false
			c.Challenges = []*domain.Challenge{{ID: 1}}
			return c
		}(), challengeID: 1, want: false},
		{name: "bound but archived", competition: func() *domain.Competition {
			c := base()
			c.ArchivedAt = &archived
			c.Challenges = []*domain.Challenge{{ID: 1}}
			return c
		}(), challengeID: 1, want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := competitionLiveForChallenge(tt.competition, tt.challengeID); got != tt.want {
				t.Fatalf("competitionLiveForChallenge() = %v, want %v", got, tt.want)
			}
		})
	}
}
