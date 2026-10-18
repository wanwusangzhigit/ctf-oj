package domain

import "time"

type Discussion struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	ChallengeID uint       `gorm:"index;not null" json:"challengeId"`
	UserID      uint       `gorm:"index;not null" json:"userId"`
	ParentID    *uint      `gorm:"index" json:"parentId,omitempty"`
	ContentMD   string     `gorm:"type:text;column:content_md;not null" json:"contentMd"`
	LikeCount   int        `gorm:"not null;default:0" json:"likeCount"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
	User        *User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Replies     []*Discussion `gorm:"-" json:"replies,omitempty"`
	Liked       bool       `gorm:"-" json:"liked"`
}

type DiscussionLike struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	UserID       uint      `gorm:"uniqueIndex:idx_disc_like_user,priority:1;not null" json:"userId"`
	DiscussionID uint      `gorm:"uniqueIndex:idx_disc_like_user,priority:2;not null" json:"discussionId"`
	CreatedAt    time.Time `json:"createdAt"`
}
