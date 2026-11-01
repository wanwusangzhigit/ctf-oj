package domain

import "time"

type CompetitionAnnouncement struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	CompetitionID uint      `gorm:"not null;index" json:"competitionId"`
	Title         string    `gorm:"size:160;not null" json:"title"`
	ContentMD     string    `gorm:"type:text;column:content_md;not null;default:''" json:"contentMd"`
	IsPublished   bool      `gorm:"not null" json:"isPublished"`
	CreatedBy     *uint     `json:"createdBy,omitempty"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

func (CompetitionAnnouncement) TableName() string { return "competition_announcements" }
