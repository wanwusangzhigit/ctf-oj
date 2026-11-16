package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/ctf-oj/backend/internal/domain"
)

func TestResolveSectionPolicy(t *testing.T) {
	cases := []struct {
		name              string
		stationVis        string
		stationPost       string
		section           *domain.CommunitySection
		wantVis, wantPost string
	}{
		{name: "no board inherits", stationVis: "members", stationPost: "restricted", wantVis: "members", wantPost: "restricted"},
		{name: "empty columns inherit", stationVis: "members", stationPost: "restricted",
			section: &domain.CommunitySection{}, wantVis: "members", wantPost: "restricted"},
		{name: "visibility overrides", stationVis: "public", stationPost: "members",
			section: &domain.CommunitySection{Visibility: "restricted"}, wantVis: "restricted", wantPost: "members"},
		{name: "posting overrides", stationVis: "public", stationPost: "members",
			section: &domain.CommunitySection{Posting: "restricted"}, wantVis: "public", wantPost: "restricted"},
		{name: "board can open what the station closed", stationVis: "restricted", stationPost: "restricted",
			section: &domain.CommunitySection{Visibility: "public", Posting: "members"}, wantVis: "public", wantPost: "members"},
		// A value outside the enum can only come from a hand-edited row; the CHECK
		// stops writes, so reading must fall back rather than lock the board.
		{name: "nonsense stored values inherit", stationVis: "members", stationPost: "members",
			section: &domain.CommunitySection{Visibility: "private", Posting: "all"}, wantVis: "members", wantPost: "members"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			vis, post := resolveSectionPolicy(tc.stationVis, tc.stationPost, tc.section)
			if vis != tc.wantVis || post != tc.wantPost {
				t.Fatalf("got (%q, %q), want (%q, %q)", vis, post, tc.wantVis, tc.wantPost)
			}
		})
	}
}

func TestDecideAccess(t *testing.T) {
	cases := []struct {
		name           string
		globalModerate bool
		userID         uint
		station        domain.AccessPermission
		section        domain.AccessPermission
		visibility     string
		posting        string
		want           sectionAccess
	}{
		{
			name:       "guest on public board may read but not write",
			visibility: CommunityVisibilityPublic,
			want:       sectionAccess{canView: true},
		},
		{
			name:       "guest on member board",
			visibility: CommunityVisibilityMembers,
			want:       sectionAccess{},
		},
		{
			name:       "guest on restricted board",
			visibility: CommunityVisibilityRestricted,
			want:       sectionAccess{},
		},
		{
			name:       "member on public board with member posting",
			userID:     7,
			visibility: CommunityVisibilityPublic,
			posting:    CommunityPostingMembers,
			want:       sectionAccess{canView: true, canPost: true},
		},
		{
			name:       "member on public board with restricted posting",
			userID:     7,
			visibility: CommunityVisibilityPublic,
			posting:    CommunityPostingRestricted,
			want:       sectionAccess{canView: true},
		},
		{
			name:       "member without any grant cannot read a restricted board",
			userID:     7,
			visibility: CommunityVisibilityRestricted,
			posting:    CommunityPostingMembers,
			want:       sectionAccess{},
		},
		{
			name:       "station read grant opens a restricted board but cannot post",
			userID:     7,
			station:    domain.AccessView,
			visibility: CommunityVisibilityRestricted,
			posting:    CommunityPostingRestricted,
			want:       sectionAccess{canView: true},
		},
		{
			name:       "station read grant posts once posting is open to members",
			userID:     7,
			station:    domain.AccessView,
			visibility: CommunityVisibilityRestricted,
			posting:    CommunityPostingMembers,
			want:       sectionAccess{canView: true, canPost: true},
		},
		{
			name:       "station manage implies everything",
			userID:     7,
			station:    domain.AccessManage,
			visibility: CommunityVisibilityRestricted,
			posting:    CommunityPostingRestricted,
			want:       sectionAccess{canView: true, canPost: true, canManage: true},
		},
		{
			name:       "board manage implies everything on that board",
			userID:     7,
			section:    domain.AccessManage,
			visibility: CommunityVisibilityRestricted,
			posting:    CommunityPostingRestricted,
			want:       sectionAccess{canView: true, canPost: true, canManage: true},
		},
		{
			name:       "board read grant opens a restricted board without moderating it",
			userID:     7,
			section:    domain.AccessView,
			visibility: CommunityVisibilityRestricted,
			posting:    CommunityPostingRestricted,
			want:       sectionAccess{canView: true},
		},
		{
			name:       "restricted board without any grant stays closed even for member posting",
			userID:     7,
			visibility: CommunityVisibilityRestricted,
			posting:    CommunityPostingMembers,
			want:       sectionAccess{},
		},
		{
			name:       "restricted posting keeps readers out of the composer",
			userID:     7,
			visibility: CommunityVisibilityMembers,
			posting:    CommunityPostingRestricted,
			want:       sectionAccess{canView: true},
		},
		{
			name:           "global moderator needs no grant",
			globalModerate: true,
			visibility:     CommunityVisibilityRestricted,
			posting:        CommunityPostingRestricted,
			want:           sectionAccess{canView: true, canPost: true, canManage: true},
		},
		{
			name:       "anonymous station manage grant still reads",
			station:    domain.AccessManage,
			visibility: CommunityVisibilityRestricted,
			want:       sectionAccess{canView: true, canManage: true},
		},
		{
			name:       "board manage alone does not make an anonymous caller a reader",
			section:    domain.AccessManage,
			visibility: CommunityVisibilityMembers,
			want:       sectionAccess{canManage: true},
		},
		{
			name:       "member posting is enough for any reader",
			userID:     7,
			visibility: CommunityVisibilityMembers,
			posting:    CommunityPostingMembers,
			want:       sectionAccess{canView: true, canPost: true},
		},
		{
			name:       "station manage plus board nothing",
			userID:     7,
			station:    domain.AccessManage,
			visibility: CommunityVisibilityPublic,
			posting:    CommunityPostingMembers,
			want:       sectionAccess{canView: true, canPost: true, canManage: true},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := decideAccess(tc.globalModerate, tc.userID, tc.station, tc.section, tc.visibility, tc.posting)
			if got != tc.want {
				t.Fatalf("got %+v, want %+v", got, tc.want)
			}
		})
	}
}

// A board with no override and no grant must behave exactly like the whole
// station did before boards existed, otherwise the migration silently changes
// access for everybody who could already read or post.
func TestSectionAccessReducesToStationMeta(t *testing.T) {
	visibilities := []string{CommunityVisibilityPublic, CommunityVisibilityMembers, CommunityVisibilityRestricted}
	postings := []string{CommunityPostingMembers, CommunityPostingRestricted}
	levels := []domain.AccessPermission{"", domain.AccessView, domain.AccessManage}
	userIDs := []uint{0, 7}
	moderators := []bool{false, true}

	for _, visibility := range visibilities {
		for _, posting := range postings {
			for _, level := range levels {
				for _, userID := range userIDs {
					for _, globalModerate := range moderators {
						wantView, wantPost, wantManage := decideStationAccess(globalModerate, userID, level, visibility, posting)
						got := decideAccess(globalModerate, userID, level, "", visibility, posting)
						if got.canView != wantView || got.canPost != wantPost || got.canManage != wantManage {
							t.Fatalf("visibility=%q posting=%q level=%q user=%d globalModerate=%v: got %+v, want view=%v post=%v manage=%v",
								visibility, posting, level, userID, globalModerate, got, wantView, wantPost, wantManage)
						}
					}
				}
			}
		}
	}
}

func TestNormalizeSectionInput(t *testing.T) {
	t.Run("trims and keeps declared defaults", func(t *testing.T) {
		got, err := normalizeSectionInput(CommunitySectionInput{
			Name:       "  站务版  ",
			Blurb:      " 公告与反馈 ",
			Visibility: "",
			Posting:    "",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Name != "站务版" || got.Blurb != "公告与反馈" {
			t.Fatalf("not trimmed: %+v", got)
		}
		if got.Visibility != "" || got.Posting != "" {
			t.Fatalf("empty policy must stay empty (inherit), got %+v", got)
		}
	})

	t.Run("empty name", func(t *testing.T) {
		if _, err := normalizeSectionInput(CommunitySectionInput{Name: "   "}); !errors.Is(err, domain.ErrInvalidArgument) {
			t.Fatalf("want ErrInvalidArgument, got %v", err)
		}
	})

	// The columns count characters, not bytes, so a Chinese name must not be
	// rejected by a byte-length check.
	t.Run("name limits are counted in runes", func(t *testing.T) {
		if _, err := normalizeSectionInput(CommunitySectionInput{Name: strings.Repeat("讨", maxSectionNameLen)}); err != nil {
			t.Fatalf("%d runes must fit: %v", maxSectionNameLen, err)
		}
		if _, err := normalizeSectionInput(CommunitySectionInput{Name: strings.Repeat("讨", maxSectionNameLen+1)}); !errors.Is(err, domain.ErrInvalidArgument) {
			t.Fatalf("%d runes must be rejected, got %v", maxSectionNameLen+1, err)
		}
		if utf8.RuneCountInString(strings.Repeat("讨", maxSectionNameLen+1)) <= maxSectionNameLen {
			t.Fatal("test input is not longer than the limit in runes")
		}
	})

	t.Run("blurb and guidelines limits", func(t *testing.T) {
		if _, err := normalizeSectionInput(CommunitySectionInput{Name: "x", Blurb: strings.Repeat("议", maxSectionBlurbLen+1)}); !errors.Is(err, domain.ErrInvalidArgument) {
			t.Fatalf("over-long blurb accepted: %v", err)
		}
		if _, err := normalizeSectionInput(CommunitySectionInput{Name: "x", GuidelinesMD: strings.Repeat("a", maxSectionGuideLen+1)}); !errors.Is(err, domain.ErrInvalidArgument) {
			t.Fatalf("over-long guidelines accepted: %v", err)
		}
	})

	t.Run("policy enums", func(t *testing.T) {
		for _, bad := range []struct{ visibility, posting string }{
			{visibility: "private", posting: ""},
			{visibility: "PUBLIC", posting: ""},
			{visibility: "", posting: "all"},
			{visibility: "", posting: "public"},
		} {
			if _, err := normalizeSectionInput(CommunitySectionInput{Name: "x", Visibility: bad.visibility, Posting: bad.posting}); !errors.Is(err, domain.ErrInvalidArgument) {
				t.Fatalf("visibility=%q posting=%q accepted", bad.visibility, bad.posting)
			}
		}
		for _, good := range []struct{ visibility, posting string }{
			{"", ""},
			{CommunityVisibilityPublic, CommunityPostingMembers},
			{CommunityVisibilityMembers, CommunityPostingRestricted},
			{CommunityVisibilityRestricted, ""},
			{"", CommunityPostingRestricted},
		} {
			if _, err := normalizeSectionInput(CommunitySectionInput{Name: "x", Visibility: good.visibility, Posting: good.posting}); err != nil {
				t.Fatalf("visibility=%q posting=%q rejected: %v", good.visibility, good.posting, err)
			}
		}
	})
}

// UpdateCopy is the route a board manager reaches without community.manage, so
// it must be structurally unable to move the board or change its policy.
func TestSectionInputUpdateCopyIgnoresAdminFields(t *testing.T) {
	got, err := normalizeSectionInput(CommunitySectionInput{
		Name:       "灌水版",
		Blurb:      "闲聊",
		Visibility: CommunityVisibilityRestricted,
		Posting:    CommunityPostingRestricted,
		SortOrder:  99,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	copyOnly, err := normalizeSectionInput(CommunitySectionInput{
		Name:         got.Name,
		Blurb:        got.Blurb,
		GuidelinesMD: got.GuidelinesMD,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if copyOnly.Visibility != "" || copyOnly.Posting != "" || copyOnly.SortOrder != 0 {
		t.Fatalf("copy-only payload must not carry policy or order, got %+v", copyOnly)
	}
}

// fakeSectionRepo records the archive marker written by Delete/Restore without
// needing a database. Only the methods those two paths touch are meaningful.
type fakeSectionRepo struct {
	sections map[uint]*domain.CommunitySection
	updates  int
}

func (f *fakeSectionRepo) Create(_ context.Context, s *domain.CommunitySection) error {
	if f.sections == nil {
		f.sections = map[uint]*domain.CommunitySection{}
	}
	f.sections[s.ID] = s
	return nil
}
func (f *fakeSectionRepo) FindByID(_ context.Context, id uint) (*domain.CommunitySection, error) {
	s, ok := f.sections[id]
	if !ok {
		return nil, domain.ErrNotFound
	}
	return s, nil
}
func (f *fakeSectionRepo) List(context.Context) ([]*domain.CommunitySection, error) { return nil, nil }
func (f *fakeSectionRepo) Update(_ context.Context, s *domain.CommunitySection) error {
	f.updates++
	f.sections[s.ID] = s
	return nil
}
func (f *fakeSectionRepo) Delete(_ context.Context, id uint) error {
	delete(f.sections, id)
	return nil
}

func TestSectionArchiveRestore(t *testing.T) {
	repo := &fakeSectionRepo{sections: map[uint]*domain.CommunitySection{
		1: {ID: 1, Name: "站务版"},
	}}
	svc := &CommunitySectionService{repo: repo}

	archivedAt := func() *time.Time {
		return repo.sections[1].ArchivedAt
	}

	if err := svc.Delete(context.Background(), 1); err != nil {
		t.Fatalf("archive: %v", err)
	}
	if archivedAt() == nil {
		t.Fatal("archive did not set archived_at")
	}
	first := *archivedAt()
	if _, ok := repo.sections[1]; !ok {
		t.Fatal("archive removed the board row; it must keep it")
	}

	// Re-archiving is a no-op: no second Update, marker unchanged.
	if err := svc.Delete(context.Background(), 1); err != nil {
		t.Fatalf("re-archive: %v", err)
	}
	if repo.updates != 1 || *archivedAt() != first {
		t.Fatalf("re-archive wrote again: updates=%d marker=%v", repo.updates, archivedAt())
	}

	if err := svc.Restore(context.Background(), 1); err != nil {
		t.Fatalf("restore: %v", err)
	}
	if archivedAt() != nil {
		t.Fatal("restore did not clear archived_at")
	}

	// Restoring a live board is a no-op too.
	if err := svc.Restore(context.Background(), 1); err != nil {
		t.Fatalf("re-restore: %v", err)
	}
	if repo.updates != 2 {
		t.Fatalf("re-restore wrote again: updates=%d", repo.updates)
	}

	if err := svc.Delete(context.Background(), 999); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("archive missing board: want ErrNotFound, got %v", err)
	}
}
