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
	CreatedAt     time.Time       `json:"createdAt"`
	UpdatedAt     time.Time       `json:"updatedAt"`
	User          *User           `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Replies       []*Discussion   `gorm:"-" json:"replies,omitempty"`
	Liked         bool            `gorm:"-" json:"liked"`
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
