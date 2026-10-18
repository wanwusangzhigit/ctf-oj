package domain

import "time"

type InstanceStatus string

const (
	InstanceRunning  InstanceStatus = "running"
	InstanceStopped  InstanceStatus = "stopped"
	InstanceExpired  InstanceStatus = "expired"
	InstanceError    InstanceStatus = "error"
)

type Instance struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	UserID       uint           `gorm:"index;not null" json:"userId"`
	ChallengeID  uint           `gorm:"index;not null" json:"challengeId"`
	ContainerID  string         `gorm:"size:128;not null" json:"containerId"`
	Image        string         `gorm:"size:255;not null" json:"image"`
	Host         string         `gorm:"size:128;not null" json:"host"`
	Port         int            `gorm:"not null" json:"port"`
	InternalPort int            `gorm:"not null" json:"internalPort"`
	DynamicFlag  string         `gorm:"type:text" json:"-"`
	Status       InstanceStatus `gorm:"size:16;not null;default:running;index" json:"status"`
	ErrorMessage string         `gorm:"type:text" json:"errorMessage"`
	ExpiresAt    time.Time      `gorm:"not null;index" json:"expiresAt"`
	StartedAt    time.Time      `gorm:"not null" json:"startedAt"`
	StoppedAt    *time.Time     `json:"stoppedAt,omitempty"`
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	User         *User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Challenge    *Challenge     `gorm:"foreignKey:ChallengeID" json:"challenge,omitempty"`
}

func (i *Instance) IsAlive() bool {
	return i.Status == InstanceRunning && time.Now().Before(i.ExpiresAt)
}
