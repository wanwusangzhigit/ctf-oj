package service

import (
	"errors"
	"strings"
	"testing"

	"github.com/ctf-oj/backend/internal/domain"
)

func strPtr(s string) *string { return &s }

func uintPtr(n uint) *uint { return &n }

func communityTopic() *domain.Discussion {
	return &domain.Discussion{
		Scope:     domain.DiscussionScopeCommunity,
		Title:     "原标题",
		ContentMD: "原正文",
	}
}

func TestValidateDiscussionEdit(t *testing.T) {
	longTitle := strings.Repeat("题", maxTitleLen)
	longContent := strings.Repeat("文", maxContentLen)
	tests := []struct {
		name    string
		topic   *domain.Discussion
		in      DiscussionEditInput
		want    map[string]any
		wantErr bool
	}{
		{
			name:  "content only keeps the title untouched",
			topic: communityTopic(),
			in:    DiscussionEditInput{ContentMD: strPtr("新正文")},
			want:  map[string]any{"content_md": "新正文"},
		},
		{
			name:  "title and content",
			topic: communityTopic(),
			in:    DiscussionEditInput{Title: strPtr("新标题"), ContentMD: strPtr("新正文")},
			want:  map[string]any{"title": "新标题", "content_md": "新正文"},
		},
		{
			name:  "surrounding whitespace is trimmed",
			topic: communityTopic(),
			in:    DiscussionEditInput{Title: strPtr("  新标题  ")},
			want:  map[string]any{"title": "新标题"},
		},
		{
			name:    "nothing supplied",
			topic:   communityTopic(),
			in:      DiscussionEditInput{},
			wantErr: true,
		},
		{
			name:    "blank title is rejected instead of wiping it",
			topic:   communityTopic(),
			in:      DiscussionEditInput{Title: strPtr("   ")},
			wantErr: true,
		},
		{
			name:    "blank content is rejected",
			topic:   communityTopic(),
			in:      DiscussionEditInput{ContentMD: strPtr("")},
			wantErr: true,
		},
		{
			name:  "title length counts characters, not bytes",
			topic: communityTopic(),
			in:    DiscussionEditInput{Title: strPtr(longTitle)},
			want:  map[string]any{"title": longTitle},
		},
		{
			name:    "one character over the title limit",
			topic:   communityTopic(),
			in:      DiscussionEditInput{Title: strPtr(longTitle + "题")},
			wantErr: true,
		},
		{
			name:  "content at the character limit",
			topic: communityTopic(),
			in:    DiscussionEditInput{ContentMD: strPtr(longContent)},
			want:  map[string]any{"content_md": longContent},
		},
		{
			name:    "one character over the content limit",
			topic:   communityTopic(),
			in:      DiscussionEditInput{ContentMD: strPtr(longContent + "文")},
			wantErr: true,
		},
		{
			name: "reply may change its body",
			topic: &domain.Discussion{
				Scope:     domain.DiscussionScopeCommunity,
				ParentID:  uintPtr(9),
				ContentMD: "原回复",
			},
			in:   DiscussionEditInput{ContentMD: strPtr("新回复")},
			want: map[string]any{"content_md": "新回复"},
		},
		{
			name: "reply has no title",
			topic: &domain.Discussion{
				Scope:    domain.DiscussionScopeCommunity,
				ParentID: uintPtr(9),
			},
			in:      DiscussionEditInput{Title: strPtr("标题")},
			wantErr: true,
		},
		{
			name: "challenge discussion has no title column to offer",
			topic: &domain.Discussion{
				Scope:       domain.DiscussionScopeChallenge,
				ChallengeID: uintPtr(3),
				ContentMD:   "原正文",
			},
			in:      DiscussionEditInput{Title: strPtr("标题")},
			wantErr: true,
		},
		{
			name: "competition topic keeps its title editable",
			topic: &domain.Discussion{
				Scope:         domain.DiscussionScopeCompetition,
				CompetitionID: uintPtr(3),
				Title:         "问",
				ContentMD:     "原正文",
			},
			in:   DiscussionEditInput{Title: strPtr("新问")},
			want: map[string]any{"title": "新问"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := validateDiscussionEdit(tt.topic, tt.in)
			if (err != nil) != tt.wantErr {
				t.Fatalf("validateDiscussionEdit() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr {
				if !errors.Is(err, domain.ErrInvalidArgument) {
					t.Fatalf("expected ErrInvalidArgument so the API answers 400, got %v", err)
				}
				return
			}
			if len(got) != len(tt.want) {
				t.Fatalf("fields = %v, want %v", got, tt.want)
			}
			for k, v := range tt.want {
				if got[k] != v {
					t.Fatalf("fields[%q] = %v, want %v", k, got[k], v)
				}
			}
		})
	}
}
