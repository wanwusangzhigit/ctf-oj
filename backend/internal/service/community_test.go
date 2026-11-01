package service

import (
	"strings"
	"testing"
	"unicode/utf8"
)

// site_settings.key is VARCHAR(64) and Postgres counts characters, so a long
// namespace would fail at insert time — years after the key was invented.
func TestCommunityCopyKeysAreStorable(t *testing.T) {
	if len(CommunityCopyKeys) == 0 {
		t.Fatal("community copy allowlist is empty")
	}
	seen := make(map[string]struct{}, len(CommunityCopyKeys))
	for _, key := range CommunityCopyKeys {
		if !strings.HasPrefix(key, SettingCommunityCopyPrefix) {
			t.Fatalf("key %q is outside the %s namespace", key, SettingCommunityCopyPrefix)
		}
		suffix := strings.TrimPrefix(key, SettingCommunityCopyPrefix)
		if suffix == "" {
			t.Fatalf("key %q has an empty suffix", key)
		}
		if strings.ContainsAny(suffix, ". ") {
			t.Fatalf("key %q suffix must be a snake_case identifier", key)
		}
		if utf8.RuneCountInString(key) > 64 {
			t.Fatalf("key %q is %d characters, over the VARCHAR(64) column", key, utf8.RuneCountInString(key))
		}
		if _, dup := seen[key]; dup {
			t.Fatalf("key %q is declared twice", key)
		}
		seen[key] = struct{}{}
	}
}
