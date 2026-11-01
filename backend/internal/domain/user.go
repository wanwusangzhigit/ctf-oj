package domain

import (
	"errors"
	"time"
)

var (
	ErrNotFound          = errors.New("record not found")
	ErrConflict          = errors.New("conflict")
	ErrUnauthorized      = errors.New("unauthorized")
	ErrForbidden         = errors.New("forbidden")
	ErrInvalidArgument   = errors.New("invalid argument")
	ErrAlreadyExists     = errors.New("already exists")
	ErrSubmissionTooFast = errors.New("submission too fast")
	ErrRateLimited       = errors.New("rate limit exceeded")
	ErrTOTPRequired      = errors.New("totp required")
	ErrUnavailable       = errors.New("service unavailable")
)

type Role string

const (
	RoleUser             Role = "user"
	RoleChallengeAdmin   Role = "challenge_admin"
	RoleCompetitionAdmin Role = "competition_admin"
	RoleModerator        Role = "moderator"
	RoleAdmin            Role = "admin"
)

type User struct {
	ID                 uint         `gorm:"primaryKey" json:"id"`
	Username           string       `gorm:"uniqueIndex;size:32;not null" json:"username"`
	Email              string       `gorm:"uniqueIndex;size:255;not null" json:"email"`
	PasswordHash       string       `gorm:"size:255;not null" json:"-"`
	Bio                string       `gorm:"type:text" json:"bio"`
	Role               Role         `gorm:"size:32;not null;default:user" json:"role"`
	Score              int          `gorm:"not null;default:0" json:"score"`
	IsBanned           bool         `gorm:"not null;default:false;index" json:"isBanned"`
	ScoreExcluded      bool         `gorm:"not null;default:false;index" json:"scoreExcluded"`
	BannedAt           *time.Time   `json:"bannedAt,omitempty"`
	BannedReason       string       `gorm:"type:text" json:"bannedReason"`
	AvatarStorageKey   string       `gorm:"size:255;not null;default:''" json:"-"`
	ProfileVisibility  string       `gorm:"size:16;not null;default:public" json:"profileVisibility"`
	TOTPSecret         string       `gorm:"size:64;not null;default:''" json:"-"`
	TOTPEnabledAt      *time.Time   `json:"-"`
	TwoFactorEnabled   bool         `gorm:"-" json:"twoFactorEnabled"`
	Permissions        []string     `gorm:"-" json:"permissions,omitempty"`
	Delegations        []Delegation `gorm:"-" json:"delegations,omitempty"`
	HasAvatar          bool         `gorm:"-" json:"hasAvatar"`
	EmailVerifiedAt    *time.Time   `json:"emailVerifiedAt,omitempty"`
	VerificationSentAt *time.Time   `json:"-"`
	CreatedAt          time.Time    `json:"createdAt"`
	UpdatedAt          time.Time    `json:"updatedAt"`
}

func (u *User) IsAdmin() bool { return u.Role == RoleAdmin && !u.IsBanned }

// CanManageChallenges covers full admins and the scoped challenge role.
func (u *User) CanManageChallenges() bool {
	return !u.IsBanned && RoleHasPermission(u.Role, PermChallengeManage)
}

// CanManageCompetitions covers full admins and the scoped competition role.
func (u *User) CanManageCompetitions() bool {
	return !u.IsBanned && RoleHasPermission(u.Role, PermCompetitionManage)
}

// PublicUser is the safe projection for anything visible outside the
// authenticated user's own session: profiles, scoreboards and team rosters.
// It deliberately omits email, ban state and internal storage keys.
type PublicUser struct {
	ID        uint      `json:"id"`
	Username  string    `json:"username"`
	Bio       string    `json:"bio"`
	Role      Role      `json:"role"`
	Score     int       `json:"score"`
	HasAvatar bool      `json:"hasAvatar"`
	CreatedAt time.Time `json:"createdAt"`
}

func (u *User) Public() PublicUser {
	return PublicUser{
		ID:        u.ID,
		Username:  u.Username,
		Bio:       u.Bio,
		Role:      u.Role,
		Score:     u.Score,
		HasAvatar: u.AvatarStorageKey != "",
		CreatedAt: u.CreatedAt,
	}
}
