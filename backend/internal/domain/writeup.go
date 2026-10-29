package domain

import "time"

type Writeup struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	ChallengeID uint       `gorm:"index;not null" json:"challengeId"`
	UserID      uint       `gorm:"index;not null" json:"userId"`
	Title       string     `gorm:"size:160;not null" json:"title"`
	ContentMD   string     `gorm:"type:text;column:content_md;not null" json:"contentMd"`
	IsPublished bool       `gorm:"not null;default:true" json:"isPublished"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
	User        *User      `gorm:"foreignKey:UserID" json:"-"`
	Challenge   *Challenge `gorm:"foreignKey:ChallengeID" json:"-"`
}
