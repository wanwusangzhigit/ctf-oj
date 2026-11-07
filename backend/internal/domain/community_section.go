package domain

import "time"

// CommunitySection is one board of the community area. Its copy (name, blurb,
// guidelines) is row data rather than a site_settings key: board-scoped strings
// must be editable by a section manager, who has no settings.manage, and
// site_settings.key is VARCHAR(64) — too narrow for community.copy.<id>.*.
type CommunitySection struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	Name         string `gorm:"uniqueIndex;size:64;not null" json:"name"`
	Blurb        string `gorm:"size:255;not null;default:''" json:"blurb"`
	GuidelinesMD string `gorm:"type:text;column:guidelines_md;not null;default:''" json:"guidelinesMd"`
	// Empty means "inherit the station-wide policy"; any stored value overrides it.
	Visibility string    `gorm:"size:16;not null;default:''" json:"visibility"`
	Posting    string    `gorm:"size:16;not null;default:''" json:"posting"`
	SortOrder  int       `gorm:"not null;default:0" json:"sortOrder"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

func (CommunitySection) TableName() string { return "community_sections" }
