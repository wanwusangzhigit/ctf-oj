package domain

import "time"

/**
 * SiteSettings — small key/value store for runtime-configurable site identity
 * and auth toggles. Surfaced publicly via GET /api/v1/settings; writable by
 * admins only via PUT /api/v1/admin/settings.
 *
 * Keys are namespaced with dots, e.g. "site.name", "auth.email_verification_required".
 * Boolean values are stored as the strings "true" / "false" so that all settings
 * share one column.
 */
type SiteSetting struct {
	Key       string    `gorm:"primaryKey;size:64" json:"key"`
	Value     string    `gorm:"type:text;not null;default:''" json:"value"`
	UpdatedAt time.Time `json:"updatedAt"`
	UpdatedBy uint      `json:"updatedBy"`
}

func (SiteSetting) TableName() string { return "site_settings" }

/**
 * AuditLog — append-only record of any mutation performed by an admin.
 * Surfaced under /admin/audit for compliance / debugging.
 *
 * Payload is a JSON-encoded string; we keep the schema intentionally loose
 * so heterogeneous actions can be logged without a schema migration each time.
 */
type AuditLog struct {
	ID         int64     `gorm:"primaryKey" json:"id"`
	ActorID    uint      `gorm:"not null;default:0" json:"actorId"`
	ActorName  string    `gorm:"size:64;not null;default:''" json:"actorName"`
	Action     string    `gorm:"size:64;not null" json:"action"`
	TargetType string    `gorm:"size:32;not null;default:''" json:"targetType"`
	TargetID   uint      `gorm:"not null;default:0" json:"targetId"`
	Payload    string    `gorm:"type:jsonb;not null;default:'{}'::jsonb" json:"payload"`
	IP         string    `gorm:"size:64;not null;default:''" json:"ip"`
	CreatedAt  time.Time `json:"createdAt"`
}

func (AuditLog) TableName() string { return "audit_logs" }

/**
 * Competition — a contest window with optional scoreboard freeze.
 * At most one competition is "active" at a time; the active competition gates
 * the public scoreboard endpoints (frozen between freeze_at and end_at).
 */
type Competition struct {
	ID                   uint            `gorm:"primaryKey" json:"id"`
	Name                 string          `gorm:"size:128;not null" json:"name"`
	Slug                 string          `gorm:"size:64;not null;uniqueIndex" json:"slug"`
	Description          string          `gorm:"type:text;not null;default:''" json:"description"`
	StartAt              *time.Time      `json:"startAt,omitempty"`
	EndAt                *time.Time      `json:"endAt,omitempty"`
	FreezeAt             *time.Time      `json:"freezeAt,omitempty"`
	RegistrationCode     string          `gorm:"size:64;not null;default:''" json:"-"`
	RegistrationRequired bool            `gorm:"not null;default:false" json:"registrationRequired"`
	Visibility           string          `gorm:"size:16;not null;default:public" json:"visibility"`
	ScoringMode          string          `gorm:"size:16;not null;default:dynamic" json:"scoringMode"`
	ArchivedAt           *time.Time      `json:"archivedAt,omitempty"`
	IsActive             bool            `gorm:"not null;default:false" json:"isActive"`
	CreatedAt            time.Time       `json:"createdAt"`
	UpdatedAt            time.Time       `json:"updatedAt"`
	Challenges           []*Challenge    `gorm:"many2many:competition_challenges" json:"challenges,omitempty"`
	AccessGrants         []AccessSubject `gorm:"-" json:"accessGrants,omitempty"`
	BoundChallengeCount  int             `gorm:"-" json:"boundChallengeCount"`
	HasRegistrationCode  bool            `gorm:"-" json:"hasRegistrationCode"`
	Registered           bool            `gorm:"-" json:"registered"`
	RegistrationCount    int             `gorm:"-" json:"registrationCount"`
	ScoreboardFrozen     bool            `gorm:"-" json:"scoreboardFrozen"`
}

func (Competition) TableName() string { return "competitions" }

/**
 * EmailVerification / PasswordReset — single-use tokens with TTL.
 */
type EmailVerification struct {
	ID        int64      `gorm:"primaryKey" json:"id"`
	UserID    uint       `gorm:"not null" json:"userId"`
	Token     string     `gorm:"size:64;not null;uniqueIndex" json:"-"`
	ExpiresAt time.Time  `gorm:"not null" json:"expiresAt"`
	UsedAt    *time.Time `json:"usedAt,omitempty"`
	CreatedAt time.Time  `json:"createdAt"`
}

func (EmailVerification) TableName() string { return "email_verifications" }

type PasswordReset struct {
	ID        int64      `gorm:"primaryKey" json:"id"`
	UserID    uint       `gorm:"not null" json:"userId"`
	Token     string     `gorm:"size:64;not null;uniqueIndex" json:"-"`
	ExpiresAt time.Time  `gorm:"not null" json:"expiresAt"`
	UsedAt    *time.Time `json:"usedAt,omitempty"`
	CreatedAt time.Time  `json:"createdAt"`
}

func (PasswordReset) TableName() string { return "password_resets" }
