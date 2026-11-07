package domain

import "time"

type DiscussionScope string

const (
	DiscussionScopeChallenge   DiscussionScope = "challenge"
	DiscussionScopeCommunity   DiscussionScope = "community"
	DiscussionScopeTeam        DiscussionScope = "team"
	DiscussionScopeCompetition DiscussionScope = "competition"
)

type Discussion struct {
	ID            uint            `gorm:"primaryKey" json:"id"`
	Scope         DiscussionScope `gorm:"size:16;not null;default:challenge;index" json:"scope"`
	ChallengeID   *uint           `gorm:"index" json:"challengeId,omitempty"`
	TeamID        *uint           `gorm:"index" json:"teamId,omitempty"`
	CompetitionID *uint           `gorm:"index" json:"competitionId,omitempty"`
	SectionID     *uint           `gorm:"index;column:section_id" json:"sectionId,omitempty"`
	UserID        uint            `gorm:"index;not null" json:"userId"`
	ParentID      *uint           `gorm:"index" json:"parentId,omitempty"`
	Title         string          `gorm:"size:160;not null;default:''" json:"title,omitempty"`
	ContentMD     string          `gorm:"type:text;column:content_md;not null" json:"contentMd"`
	LikeCount     int             `gorm:"not null;default:0" json:"likeCount"`
	ViewCount     int             `gorm:"not null;default:0" json:"viewCount"`
	ReplyCount    int             `gorm:"not null;default:0" json:"replyCount"`
	LastReplyAt   *time.Time      `json:"lastReplyAt,omitempty"`
	IsPinned      bool            `gorm:"not null;default:false" json:"isPinned"`
	IsLocked      bool            `gorm:"not null;default:false" json:"isLocked"`
	Tags          string          `gorm:"type:text;not null;default:''" json:"tags"`
	EditedAt      *time.Time      `json:"editedAt,omitempty"`
	EditCount     int             `gorm:"not null;default:0" json:"editCount"`
	CreatedAt     time.Time       `json:"createdAt"`
	UpdatedAt     time.Time       `json:"updatedAt"`
	User          *User           `gorm:"foreignKey:UserID" json:"-"`
	Author        *PublicUser     `gorm:"-" json:"user,omitempty"`
	Replies       []*Discussion   `gorm:"-" json:"replies,omitempty"`
	Liked         bool            `gorm:"-" json:"liked"`
}

// RedactAuthor swaps the full author relation for the public projection so no
// email or ban state can reach a discussion response, which is public for the
// community and competition scopes.
func (d *Discussion) RedactAuthor() {
	if d == nil || d.User == nil {
		return
	}
	public := d.User.Public()
	d.Author = &public
	d.User = nil
}

// DiscussionRevision is the content snapshot taken before an edit replaces it,
// so revision N always holds what the topic looked like ahead of edit N.
type DiscussionRevision struct {
	ID           uint        `gorm:"primaryKey" json:"id"`
	DiscussionID uint        `gorm:"column:discussion_id;index;not null" json:"discussionId"`
	Revision     int         `gorm:"not null" json:"revision"`
	Title        string      `gorm:"size:160;not null;default:''" json:"title,omitempty"`
	ContentMD    string      `gorm:"type:text;column:content_md;not null;default:''" json:"contentMd"`
	ActorID      *uint       `gorm:"column:actor_id;index" json:"actorId,omitempty"`
	CreatedAt    time.Time   `json:"createdAt"`
	Actor        *User       `gorm:"foreignKey:ActorID" json:"-"`
	Author       *PublicUser `gorm:"-" json:"actor,omitempty"`
}

func (r *DiscussionRevision) RedactAuthor() {
	if r == nil || r.Actor == nil {
		return
	}
	public := r.Actor.Public()
	r.Author = &public
	r.Actor = nil
}

type DiscussionLike struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	UserID       uint      `gorm:"uniqueIndex:idx_disc_like_user,priority:1;not null" json:"userId"`
	DiscussionID uint      `gorm:"uniqueIndex:idx_disc_like_user,priority:2;not null" json:"discussionId"`
	CreatedAt    time.Time `json:"createdAt"`
}

type DiscussionListOptions struct {
	Page           int
	PageSize       int
	Sort           string
	Tag            string
	Query          string
	IncludeReplies bool
}
