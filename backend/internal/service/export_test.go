package service

import (
	"testing"

	"github.com/ctf-oj/backend/internal/domain"
)

// Hints must survive an export/import round trip, because the demo bundle and
// operator backups both rely on it. These helpers are the whole mapping.
func TestHintBundleRoundTrip(t *testing.T) {
	src := []*domain.ChallengeHint{
		{ID: 1, ChallengeID: 9, SortOrder: 10, CostRatio: 0.2, Content: "first"},
		{ID: 2, ChallengeID: 9, SortOrder: 20, CostRatio: 0.35, Content: "second"},
	}
	exported := toExportHints(src)
	if len(exported) != 2 {
		t.Fatalf("exported %d hints, want 2", len(exported))
	}
	for i, h := range exported {
		if h.SortOrder != src[i].SortOrder || h.CostRatio != src[i].CostRatio || h.Content != src[i].Content {
			t.Fatalf("hint %d lost fields: %+v vs %+v", i, h, src[i])
		}
	}

	back := toDomainHints(42, exported)
	if len(back) != 2 {
		t.Fatalf("imported %d hints, want 2", len(back))
	}
	if back[0].ChallengeID != 42 || back[1].ChallengeID != 42 {
		t.Fatalf("challenge id not applied: %+v", back)
	}
	if back[1].CostRatio != 0.35 || back[1].Content != "second" || back[1].SortOrder != 20 {
		t.Fatalf("round trip changed a hint: %+v", back[1])
	}
}

func TestHintBundleEmpty(t *testing.T) {
	if got := toExportHints(nil); len(got) != 0 {
		t.Fatalf("nil hints exported %d entries", len(got))
	}
	if got := toDomainHints(1, nil); len(got) != 0 {
		t.Fatalf("nil hints imported %d entries", len(got))
	}
}
