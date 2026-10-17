package domain

import (
	"context"
	"io"
)

type UserRepository interface {
	Create(ctx context.Context, u *User) error
	FindByID(ctx context.Context, id uint) (*User, error)
	FindByUsername(ctx context.Context, username string) (*User, error)
	FindByEmail(ctx context.Context, email string) (*User, error)
	Update(ctx context.Context, u *User) error
	List(ctx context.Context, page, pageSize int) ([]*User, int64, error)
	UpdateScore(ctx context.Context, userID uint, delta int) error
}

type CategoryRepository interface {
	Create(ctx context.Context, c *Category) error
	FindByID(ctx context.Context, id uint) (*Category, error)
	FindBySlug(ctx context.Context, slug string) (*Category, error)
	List(ctx context.Context) ([]*Category, error)
	Update(ctx context.Context, c *Category) error
	Delete(ctx context.Context, id uint) error
}

type ChallengeRepository interface {
	Create(ctx context.Context, c *Challenge) error
	FindByID(ctx context.Context, id uint) (*Challenge, error)
	List(ctx context.Context, filter ChallengeFilter) ([]*Challenge, int64, error)
	Update(ctx context.Context, c *Challenge) error
	Delete(ctx context.Context, id uint) error
	CountSolves(ctx context.Context, challengeID uint) (int64, error)
}

type ChallengeFilter struct {
	CategoryID  uint
	OnlyPublished bool
	Page        int
	PageSize    int
}

type FlagRepository interface {
	Create(ctx context.Context, f *Flag) error
	FindByChallengeID(ctx context.Context, challengeID uint) ([]*Flag, error)
	DeleteByChallengeID(ctx context.Context, challengeID uint) error
}

type AttachmentRepository interface {
	Create(ctx context.Context, a *Attachment) error
	FindByID(ctx context.Context, id uint) (*Attachment, error)
	ListByChallengeID(ctx context.Context, challengeID uint) ([]*Attachment, error)
	Delete(ctx context.Context, id uint) error
}

type SubmissionRepository interface {
	Create(ctx context.Context, s *Submission) error
	ListByUserAndChallenge(ctx context.Context, userID, challengeID uint, limit int) ([]*Submission, error)
	CountRecent(ctx context.Context, userID uint, since interface{}) (int64, error)
}

type SolveRepository interface {
	Create(ctx context.Context, s *Solve) error
	FindByUserAndChallenge(ctx context.Context, userID, challengeID uint) (*Solve, error)
	CountByChallenge(ctx context.Context, challengeID uint) (int64, error)
	ListByChallenge(ctx context.Context, challengeID uint, page, pageSize int) ([]*Solve, int64, error)
	ListByUser(ctx context.Context, userID uint) ([]*Solve, error)
	ListTop(ctx context.Context, limit int) ([]*Solve, error)
	ListScoreboard(ctx context.Context, page, pageSize int) ([]*User, int64, error)
}

type Storage interface {
	Save(ctx context.Context, reader io.Reader, originalName string) (*StoredObject, error)
	Open(ctx context.Context, key string) (io.ReadCloser, int64, error)
	Delete(ctx context.Context, key string) error
}

type StoredObject struct {
	Key  string
	Size int64
}
