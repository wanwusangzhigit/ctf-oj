package domain

import "time"

type Team struct {
	ID          uint         `gorm:"primaryKey" json:"id"`
	Name        string       `gorm:"size:64;uniqueIndex;not null" json:"name"`
	Slug        string       `gorm:"size:64;uniqueIndex;not null" json:"slug"`
	Description string       `gorm:"type:text" json:"description"`
	OwnerID     uint         `gorm:"index;not null" json:"ownerId"`
	InviteCode  string       `gorm:"size:32;uniqueIndex;not null" json:"inviteCode"`
	Score       int          `gorm:"not null;default:0" json:"score"`
	CreatedAt   time.Time    `json:"createdAt"`
	UpdatedAt   time.Time    `json:"updatedAt"`
	Owner       *User        `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
	Members     []TeamMember `gorm:"foreignKey:TeamID" json:"members,omitempty"`
}

type TeamMember struct {
	ID       uint      `gorm:"primaryKey" json:"id"`
	TeamID   uint      `gorm:"uniqueIndex:idx_team_member,priority:1;not null" json:"teamId"`
	UserID   uint      `gorm:"uniqueIndex:idx_team_member,priority:2;not null" json:"userId"`
	JoinedAt time.Time `json:"joinedAt"`
	User     *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// TeamScore is the sanitized competition/team scoreboard projection.
type TeamScore struct {
	ID    uint   `json:"id"`
	Name  string `json:"name"`
	Slug  string `json:"slug"`
	Score int    `json:"score"`
}
