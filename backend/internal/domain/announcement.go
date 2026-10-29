package domain

import "time"

type Announcement struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	Title       string     `gorm:"size:255;not null" json:"title"`
	ContentMD   string     `gorm:"type:text;column:content_md" json:"contentMd"`
	IsPinned    bool       `gorm:"not null;default:false" json:"isPinned"`
	IsPublished bool       `gorm:"not null;default:false" json:"isPublished"`
	PublishedAt *time.Time `json:"publishedAt,omitempty"`
	CreatedBy   uint       `gorm:"index" json:"createdBy"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}
