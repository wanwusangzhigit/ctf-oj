package domain

import "time"

type FlagType string

const (
	FlagStatic FlagType = "static"
	FlagRegex  FlagType = "regex"
)

type Challenge struct {
	ID             uint       `gorm:"primaryKey" json:"id"`
	CategoryID     uint       `gorm:"index;not null" json:"categoryId"`
	Title          string     `gorm:"size:128;not null" json:"title"`
	Description    string     `gorm:"type:text" json:"description"`
	BaseScore      int        `gorm:"not null;default:500" json:"baseScore"`
	MinScore       int        `gorm:"not null;default:100" json:"minScore"`
	Decay          int        `gorm:"not null;default:10" json:"decay"`
	Difficulty     int        `gorm:"not null;default:2" json:"difficulty"`
	IsPublished    bool       `gorm:"not null;default:false;index" json:"isPublished"`
	ConnectionInfo string     `gorm:"size:255" json:"connectionInfo"`
	Tags           string     `gorm:"size:255" json:"tags"`
	IsDynamic      bool       `gorm:"not null;default:false;index" json:"isDynamic"`
	Image          string     `gorm:"size:255" json:"image"`
	InternalPort   int        `gorm:"not null;default:0" json:"internalPort"`
	DefaultTTL     int        `gorm:"not null;default:0" json:"defaultTtl"`
	MemoryLimitMB  int        `gorm:"not null;default:0" json:"memoryLimitMb"`
	CPULimit       int        `gorm:"not null;default:0" json:"cpuLimit"`
	CreatedBy      uint       `gorm:"index" json:"createdBy"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
	Category       *Category  `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
}

type Flag struct {
	ID           uint     `gorm:"primaryKey" json:"id"`
	ChallengeID  uint     `gorm:"index;not null" json:"challengeId"`
	Type         FlagType `gorm:"size:16;not null;default:static" json:"type"`
	Content      string   `gorm:"type:text;not null" json:"-"` // 隐藏，不返回给前端
	CaseSensitive bool    `gorm:"not null;default:true" json:"caseSensitive"`
}

type Attachment struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ChallengeID uint      `gorm:"index;not null" json:"challengeId"`
	Filename    string    `gorm:"size:255;not null" json:"filename"`
	StorageKey  string    `gorm:"size:128;not null" json:"-"`
	MimeType    string    `gorm:"size:128" json:"mimeType"`
	Size        int64     `gorm:"not null" json:"size"`
	CreatedAt   time.Time `json:"createdAt"`
}

type Submission struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	UserID      uint      `gorm:"index;not null" json:"userId"`
	ChallengeID uint      `gorm:"index;not null" json:"challengeId"`
	Flag        string    `gorm:"type:text;not null" json:"flag"`
	IsCorrect   bool      `gorm:"not null" json:"isCorrect"`
	IP          string    `gorm:"size:64" json:"ip"`
	CreatedAt   time.Time `gorm:"index" json:"createdAt"`
}

type Solve struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	UserID        uint      `gorm:"uniqueIndex:idx_solve_user_chal,priority:1;not null" json:"userId"`
	ChallengeID   uint      `gorm:"uniqueIndex:idx_solve_user_chal,priority:2;not null" json:"challengeId"`
	Score         int       `gorm:"not null" json:"score"`
	IsFirstBlood  bool      `gorm:"not null;default:false" json:"isFirstBlood"`
	SolvedAt      time.Time `gorm:"index" json:"solvedAt"`
	User          *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Challenge     *Challenge `gorm:"foreignKey:ChallengeID" json:"challenge,omitempty"`
}
