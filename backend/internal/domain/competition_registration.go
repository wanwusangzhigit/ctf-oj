package domain

import "time"

type CompetitionRegistration struct {
	CompetitionID  uint       `gorm:"primaryKey" json:"competitionId"`
	UserID         uint       `gorm:"primaryKey" json:"userId"`
	ScoreExcluded  bool       `gorm:"not null;default:false" json:"scoreExcluded"`
	ExcludedReason string     `gorm:"type:text;not null;default:''" json:"excludedReason,omitempty"`
	ExcludedAt     *time.Time `json:"excludedAt,omitempty"`
	ExcludedBy     *uint      `json:"excludedBy,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
	User           *User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (CompetitionRegistration) TableName() string { return "competition_registrations" }
