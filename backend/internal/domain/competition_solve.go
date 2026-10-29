package domain

import "time"

// CompetitionSolve is a solve recorded inside a competition. It is kept
// separate from Solve so practice progress and contest results never mix.
type CompetitionSolve struct {
	ID            uint       `gorm:"primaryKey" json:"id"`
	CompetitionID uint       `gorm:"uniqueIndex:uq_competition_solve,priority:1;not null" json:"competitionId"`
	UserID        uint       `gorm:"uniqueIndex:uq_competition_solve,priority:2;not null" json:"userId"`
	ChallengeID   uint       `gorm:"uniqueIndex:uq_competition_solve,priority:3;not null" json:"challengeId"`
	Score         int        `gorm:"not null" json:"score"`
	IsFirstBlood  bool       `gorm:"not null;default:false" json:"isFirstBlood"`
	SolvedAt      time.Time  `gorm:"index" json:"solvedAt"`
	User          *User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Challenge     *Challenge `gorm:"foreignKey:ChallengeID" json:"challenge,omitempty"`
}

func (CompetitionSolve) TableName() string { return "competition_solves" }
