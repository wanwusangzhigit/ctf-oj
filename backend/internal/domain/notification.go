package domain

import "time"

type NotificationKind string

const (
	NotifySolve        NotificationKind = "solve"
	NotifyReply        NotificationKind = "reply"
	NotifyAnnouncement NotificationKind = "announcement"
	NotifySystem       NotificationKind = "system"
)

type Notification struct {
	ID        uint             `gorm:"primaryKey" json:"id"`
	UserID    uint             `gorm:"index;not null" json:"userId"`
	Kind      NotificationKind `gorm:"size:32;not null" json:"kind"`
	Title     string           `gorm:"size:255;not null" json:"title"`
	Body      string           `gorm:"type:text" json:"body"`
	Link      string           `gorm:"size:255" json:"link"`
	ReadAt    *time.Time       `json:"readAt,omitempty"`
	CreatedAt time.Time        `gorm:"index" json:"createdAt"`
}

func (n *Notification) IsRead() bool {
	return n.ReadAt != nil
}
