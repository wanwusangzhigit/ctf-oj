package domain

import (
	"encoding/json"
	"strings"
	"testing"
)

func sampleAuthor() *User {
	return &User{
		ID:               7,
		Username:         "player",
		Email:            "player@corp.local",
		Bio:              "hi",
		Role:             RoleUser,
		IsBanned:         true,
		BannedReason:     "cheating",
		ScoreExcluded:    true,
		AvatarStorageKey: "avatars/7.png",
	}
}

// Discussion bodies are served to anonymous callers on the community and
// competition scopes, so the author relation must never ride along.
func TestDiscussionRedactAuthor(t *testing.T) {
	d := &Discussion{UserID: 7, Title: "T", ContentMD: "C", User: sampleAuthor()}

	d.RedactAuthor()
	after, err := json.Marshal(d)
	if err != nil {
		t.Fatal(err)
	}
	for _, leak := range []string{"player@corp.local", "cheating", `"isBanned"`, `"scoreExcluded"`, `"profileVisibility"`} {
		if strings.Contains(string(after), leak) {
			t.Fatalf("redacted discussion leaks %s: %s", leak, after)
		}
	}
	if d.User != nil {
		t.Fatal("redaction must drop the private relation")
	}
	var got struct {
		User *PublicUser `json:"user"`
	}
	if err := json.Unmarshal(after, &got); err != nil {
		t.Fatal(err)
	}
	if got.User == nil || got.User.ID != 7 || got.User.Username != "player" || !got.User.HasAvatar {
		t.Fatalf("redacted discussion lost the public author: %s", after)
	}
}

// A Discussion that never went through redaction must still be safe to encode:
// the private relation is json:"-", so a forgotten redaction costs the client an
// author rather than an email address.
func TestDiscussionWithoutRedactionIsStillSafe(t *testing.T) {
	raw, err := json.Marshal(&Discussion{UserID: 7, User: sampleAuthor()})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "player@corp.local") {
		t.Fatalf("unredacted discussion leaked the author: %s", raw)
	}
}

func TestDiscussionRevisionRedactAuthor(t *testing.T) {
	rev := &DiscussionRevision{Revision: 1, ContentMD: "C", Actor: sampleAuthor()}
	rev.RedactAuthor()

	after, err := json.Marshal(rev)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(after), "player@corp.local") {
		t.Fatalf("revision leaks the actor email: %s", after)
	}
	var got struct {
		Actor *PublicUser `json:"actor"`
	}
	if err := json.Unmarshal(after, &got); err != nil {
		t.Fatal(err)
	}
	if got.Actor == nil || got.Actor.Username != "player" {
		t.Fatalf("revision lost the public actor: %s", after)
	}
}
