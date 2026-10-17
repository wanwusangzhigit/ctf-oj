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
)

type Role string

const (
	RoleUser  Role = "user"
	RoleAdmin Role = "admin"
)

type User struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Username     string    `gorm:"uniqueIndex;size:32;not null" json:"username"`
	Email        string    `gorm:"uniqueIndex;size:255;not null" json:"email"`
	PasswordHash string    `gorm:"size:255;not null" json:"-"`
	Bio          string    `gorm:"type:text" json:"bio"`
	Role         Role      `gorm:"size:16;not null;default:user" json:"role"`
	Score        int       `gorm:"not null;default:0" json:"score"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

func (u *User) IsAdmin() bool { return u.Role == RoleAdmin }
