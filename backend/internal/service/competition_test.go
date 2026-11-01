package service

import (
	"errors"
	"testing"
	"time"

	"github.com/ctf-oj/backend/internal/domain"
)

func timePtr(t time.Time) *time.Time { return &t }

func TestValidateCompetitionInput(t *testing.T) {
	start := time.Date(2026, 1, 1, 8, 0, 0, 0, time.UTC)
	end := start.Add(2 * time.Hour)
	freeze := start.Add(time.Hour)
	tests := []struct {
		name    string
		in      CompetitionInput
		wantErr bool
	}{
		{name: "valid schedule", in: CompetitionInput{Name: "Contest", Slug: "contest", StartAt: &start, EndAt: &end, FreezeAt: &freeze}},
		{name: "name required", in: CompetitionInput{Slug: "contest"}, wantErr: true},
		{name: "slug required", in: CompetitionInput{Name: "Contest"}, wantErr: true},
		{name: "end before start", in: CompetitionInput{Name: "Contest", Slug: "contest", StartAt: &end, EndAt: &start}, wantErr: true},
		{name: "freeze before start", in: CompetitionInput{Name: "Contest", Slug: "contest", StartAt: &start, EndAt: &end, FreezeAt: timePtr(start.Add(-time.Minute))}, wantErr: true},
		{name: "freeze after end", in: CompetitionInput{Name: "Contest", Slug: "contest", StartAt: &start, EndAt: &end, FreezeAt: timePtr(end.Add(time.Minute))}, wantErr: true},
		{name: "no freeze", in: CompetitionInput{Name: "Contest", Slug: "contest", StartAt: &start, EndAt: &end}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateCompetitionInput(tt.in)
			if (err != nil) != tt.wantErr {
				t.Fatalf("validateCompetitionInput() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr && !errors.Is(err, domain.ErrInvalidArgument) {
				t.Fatalf("expected ErrInvalidArgument, got %v", err)
			}
		})
	}
}

func TestScoreboardCutoff(t *testing.T) {
	start := time.Date(2026, 1, 1, 8, 0, 0, 0, time.UTC)
	end := start.Add(2 * time.Hour)
	freeze := start.Add(time.Hour)
	tests := []struct {
		name string
		c    *domain.Competition
		now  time.Time
		want *time.Time
	}{
		{name: "nil competition", c: nil, now: start, want: nil},
		{name: "no freeze", c: &domain.Competition{StartAt: &start, EndAt: &end}, now: end, want: nil},
		{name: "before freeze", c: &domain.Competition{StartAt: &start, EndAt: &end, FreezeAt: &freeze}, now: freeze.Add(-time.Minute), want: nil},
		{name: "at freeze", c: &domain.Competition{StartAt: &start, EndAt: &end, FreezeAt: &freeze}, now: freeze, want: &freeze},
		{name: "between freeze and end", c: &domain.Competition{StartAt: &start, EndAt: &end, FreezeAt: &freeze}, now: end.Add(-time.Minute), want: &freeze},
		{name: "at end", c: &domain.Competition{StartAt: &start, EndAt: &end, FreezeAt: &freeze}, now: end, want: nil},
		{name: "after end", c: &domain.Competition{StartAt: &start, EndAt: &end, FreezeAt: &freeze}, now: end.Add(time.Minute), want: nil},
		{name: "open ended", c: &domain.Competition{StartAt: &start, FreezeAt: &freeze}, now: end.Add(time.Hour), want: &freeze},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := scoreboardCutoff(tt.c, tt.now)
			if (got == nil) != (tt.want == nil) {
				t.Fatalf("scoreboardCutoff() = %v, want %v", got, tt.want)
			}
			if got != nil && !got.Equal(*tt.want) {
				t.Fatalf("scoreboardCutoff() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestRawScoreForMode(t *testing.T) {
	c := &domain.Challenge{BaseScore: 500, MinScore: 100, Decay: 10}
	tests := []struct {
		name  string
		mode  string
		count int64
		want  int
	}{
		{name: "fixed ignores solve count", mode: "fixed", count: 8, want: 500},
		{name: "three blood first", mode: "three_blood", count: 0, want: 550},
		{name: "three blood second", mode: "three_blood", count: 1, want: 525},
		{name: "three blood third", mode: "three_blood", count: 2, want: 510},
		{name: "three blood fourth", mode: "three_blood", count: 3, want: 500},
		{name: "dynamic first", mode: "dynamic", count: 0, want: 500},
		{name: "dynamic decays", mode: "dynamic", count: 10, want: 247},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := rawScoreForMode(c, tt.mode, tt.count); got != tt.want {
				t.Fatalf("rawScoreForMode() = %d, want %d", got, tt.want)
			}
		})
	}
}
