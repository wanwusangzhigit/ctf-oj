package service

import "testing"

func TestFilterCommunityCopy(t *testing.T) {
	allowed := CommunityCopyKeys[0]
	tests := []struct {
		name string
		in   map[string]string
		want map[string]string
	}{
		{"trim and keep", map[string]string{allowed: "  榜单  "}, map[string]string{allowed: "榜单"}},
		{"blank becomes default", map[string]string{allowed: "   "}, map[string]string{allowed: ""}},
		{"drop foreign namespace", map[string]string{allowed: "ok", "site.name": "HACK", "competition.active_id": "7"}, map[string]string{allowed: "ok"}},
		{"drop unknown suffix", map[string]string{"community.copy.nope": "x"}, map[string]string{}},
		{"empty input", map[string]string{}, map[string]string{}},
	}
	for _, tc := range tests {
		got := filterCommunityCopy(tc.in)
		if len(got) != len(tc.want) {
			t.Fatalf("%s: got %v, want %v", tc.name, got, tc.want)
		}
		for k, v := range tc.want {
			if got[k] != v {
				t.Fatalf("%s: key %q got %q, want %q", tc.name, k, got[k], v)
			}
		}
	}
}

// A mistyped key must never reach another namespace, and every declared key
// must survive the filter so the editor can restore defaults with an empty value.
func TestFilterCommunityCopyKeepsWholeAllowlist(t *testing.T) {
	all := make(map[string]string, len(CommunityCopyKeys))
	for _, key := range CommunityCopyKeys {
		all[key] = "x"
	}
	got := filterCommunityCopy(all)
	if len(got) != len(CommunityCopyKeys) {
		t.Fatalf("allowlist round-trip lost keys: got %d, want %d", len(got), len(CommunityCopyKeys))
	}
}
