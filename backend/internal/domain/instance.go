package domain

import "time"

type InstanceStatus string

const (
	InstanceRunning     InstanceStatus = "running"
	InstanceStopped     InstanceStatus = "stopped"      // 用户手动销毁
	InstanceExpired     InstanceStatus = "expired"      // TTL 到期
	InstanceAutoExpired InstanceStatus = "auto_expired" // 用户解题后系统自动销毁
	InstanceError       InstanceStatus = "error"
)

type Instance struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	UserID         uint           `gorm:"index;not null" json:"userId"`
	TeamID         uint           `gorm:"index" json:"teamId"`
	ChallengeID    uint           `gorm:"index;not null" json:"challengeId"`
	ContainerID    string         `gorm:"size:128;not null" json:"containerId"`
	ComposeProject string         `gorm:"size:64;not null;default:''" json:"composeProject"`
	Image          string         `gorm:"size:255;not null" json:"image"`
	Host           string         `gorm:"size:128;not null" json:"host"`
	Port           int            `gorm:"not null" json:"port"`
	InternalPort   int            `gorm:"not null" json:"internalPort"`
	DynamicFlag    string         `gorm:"type:text" json:"-"`
	Status         InstanceStatus `gorm:"size:16;not null;default:running;index" json:"status"`
	ErrorMessage   string         `gorm:"type:text" json:"errorMessage"`
	// LogsSnapshot holds the most recent container stdout/stderr captured at
	// termination time. Lets admins review past instances after the underlying
	// container has been torn down.
	LogsSnapshot string     `gorm:"type:text;not null;default:''" json:"-"`
	ExpiresAt    time.Time  `gorm:"not null;index" json:"expiresAt"`
	StartedAt    time.Time  `gorm:"not null" json:"startedAt"`
	StoppedAt    *time.Time `json:"stoppedAt,omitempty"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
	User         *User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Challenge    *Challenge `gorm:"foreignKey:ChallengeID" json:"challenge,omitempty"`
	Connection   string     `gorm:"-" json:"connection,omitempty"`
}

func (i *Instance) IsAlive() bool {
	return i.Status == InstanceRunning && time.Now().Before(i.ExpiresAt)
}
