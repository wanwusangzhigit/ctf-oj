package service

import (
	"context"
	"io"
	"time"

	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/crypto"
	"github.com/ctf-oj/backend/internal/pkg/totp"
)

type UserService struct {
	users       domain.UserRepository
	solves      domain.SolveRepository
	submissions domain.SubmissionRepository
	follows     domain.FollowRepository
	storage     domain.Storage // optional, used for avatars
}

func NewUserService(
	u domain.UserRepository,
	s domain.SolveRepository,
	sub domain.SubmissionRepository,
	st domain.Storage,
	follows domain.FollowRepository,
) *UserService {
	return &UserService{users: u, solves: s, submissions: sub, storage: st, follows: follows}
}

func (s *UserService) Get(ctx context.Context, id uint) (*domain.User, error) {
	u, err := s.users.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	u.TwoFactorEnabled = u.TOTPEnabledAt != nil
	u.Permissions = domain.PermissionStrings(u.Role)
	u.HasAvatar = u.AvatarStorageKey != ""
	return u, nil
}

func (s *UserService) List(ctx context.Context, page, pageSize int) ([]*domain.User, int64, error) {
	return s.users.List(ctx, page, pageSize)
}

func (s *UserService) MySolves(ctx context.Context, userID uint) ([]*domain.Solve, error) {
	return s.solves.ListByUser(ctx, userID)
}

func (s *UserService) Scoreboard(ctx context.Context, page, pageSize int, cutoff *time.Time) ([]domain.PublicUser, int64, error) {
	var (
		us    []*domain.User
		total int64
		err   error
	)
	if cutoff != nil {
		us, total, err = s.solves.ListScoreboardAt(ctx, *cutoff, page, pageSize)
	} else {
		us, total, err = s.solves.ListScoreboard(ctx, page, pageSize)
	}
	if err != nil {
		return nil, 0, err
	}
	out := make([]domain.PublicUser, 0, len(us))
	for _, u := range us {
		out = append(out, u.Public())
	}
	return out, total, nil
}

func (s *UserService) Update(ctx context.Context, u *domain.User) error {
	return s.users.Update(ctx, u)
}

// Search lists users for the admin panel with optional filters.
func (s *UserService) Search(ctx context.Context, filter domain.UserFilter, page, pageSize int) ([]*domain.User, int64, error) {
	return s.users.Search(ctx, filter, page, pageSize)
}

// ChangePassword verifies the current password before setting a new one.
func (s *UserService) ChangePassword(ctx context.Context, userID uint, current, next string) error {
	if len(next) < 8 {
		return domain.ErrInvalidArgument
	}
	u, err := s.users.FindByID(ctx, userID)
	if err != nil {
		return err
	}
	if !crypto.CheckPassword(u.PasswordHash, current) {
		return domain.ErrUnauthorized
	}
	hash, err := crypto.HashPassword(next)
	if err != nil {
		return err
	}
	u.PasswordHash = hash
	return s.users.Update(ctx, u)
}

// AdminResetPassword sets a new password without knowing the old one.
func (s *UserService) AdminResetPassword(ctx context.Context, userID uint, next string) error {
	if len(next) < 8 {
		return domain.ErrInvalidArgument
	}
	u, err := s.users.FindByID(ctx, userID)
	if err != nil {
		return err
	}
	hash, err := crypto.HashPassword(next)
	if err != nil {
		return err
	}
	u.PasswordHash = hash
	return s.users.Update(ctx, u)
}

// Submissions lists a user's flag submissions (newest first), paginated.
func (s *UserService) Submissions(ctx context.Context, userID uint, page, pageSize int) ([]*domain.Submission, int64, error) {
	if s.submissions == nil {
		return nil, 0, nil
	}
	return s.submissions.ListByUser(ctx, userID, page, pageSize)
}

// UploadAvatar stores the avatar image and updates the user's record.
// Accepts the original filename + an open reader; the caller closes the reader.
func (s *UserService) UploadAvatar(ctx context.Context, userID uint, reader io.Reader, originalName string) (*domain.User, error) {
	if s.storage == nil {
		return nil, ErrStorageNotConfigured
	}
	obj, err := s.storage.Save(ctx, reader, originalName)
	if err != nil {
		return nil, err
	}
	u, err := s.users.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	// best-effort cleanup of the old avatar
	if u.AvatarStorageKey != "" && u.AvatarStorageKey != obj.Key {
		_ = s.storage.Delete(ctx, u.AvatarStorageKey)
	}
	u.AvatarStorageKey = obj.Key
	if err := s.users.Update(ctx, u); err != nil {
		return nil, err
	}
	u.HasAvatar = true
	return u, nil
}

// AvatarReader opens the stored avatar for the given user. Returns nil reader
// + nil error when the user has no avatar.
func (s *UserService) AvatarReader(ctx context.Context, userID uint) (io.ReadCloser, int64, error) {
	if s.storage == nil {
		return nil, 0, ErrStorageNotConfigured
	}
	u, err := s.users.FindByID(ctx, userID)
	if err != nil {
		return nil, 0, err
	}
	if u.AvatarStorageKey == "" {
		return nil, 0, nil
	}
	return s.storage.Open(ctx, u.AvatarStorageKey)
}

var ErrStorageNotConfigured = domain.ErrInvalidArgument

// FollowStats returns the public counters plus whether viewer follows target.
func (s *UserService) FollowStats(ctx context.Context, userID, viewerID uint) (followers, following int64, isFollowing bool, err error) {
	if s.follows == nil {
		return 0, 0, false, nil
	}
	if followers, err = s.follows.CountFollowers(ctx, userID); err != nil {
		return
	}
	if following, err = s.follows.CountFollowing(ctx, userID); err != nil {
		return
	}
	if viewerID > 0 && viewerID != userID {
		isFollowing, err = s.follows.IsFollowing(ctx, viewerID, userID)
	}
	return
}

func (s *UserService) Follow(ctx context.Context, followerID, followeeID uint) error {
	if s.follows == nil {
		return domain.ErrInvalidArgument
	}
	if followerID == followeeID {
		return domain.ErrInvalidArgument
	}
	u, err := s.users.FindByID(ctx, followeeID)
	if err != nil {
		return err
	}
	if u.IsBanned {
		return domain.ErrNotFound
	}
	return s.follows.Follow(ctx, followerID, followeeID)
}

func (s *UserService) Unfollow(ctx context.Context, followerID, followeeID uint) error {
	if s.follows == nil {
		return domain.ErrInvalidArgument
	}
	return s.follows.Unfollow(ctx, followerID, followeeID)
}

func (s *UserService) Followers(ctx context.Context, userID uint, page, pageSize int) ([]domain.PublicUser, int64, error) {
	if s.follows == nil {
		return nil, 0, nil
	}
	us, total, err := s.follows.ListFollowers(ctx, userID, page, pageSize)
	if err != nil {
		return nil, 0, err
	}
	out := make([]domain.PublicUser, 0, len(us))
	for _, u := range us {
		out = append(out, u.Public())
	}
	return out, total, nil
}

func (s *UserService) Following(ctx context.Context, userID uint, page, pageSize int) ([]domain.PublicUser, int64, error) {
	if s.follows == nil {
		return nil, 0, nil
	}
	us, total, err := s.follows.ListFollowing(ctx, userID, page, pageSize)
	if err != nil {
		return nil, 0, err
	}
	out := make([]domain.PublicUser, 0, len(us))
	for _, u := range us {
		out = append(out, u.Public())
	}
	return out, total, nil
}

func (s *UserService) Feed(ctx context.Context, userID uint, limit int) ([]*domain.FeedItem, error) {
	if s.follows == nil {
		return nil, nil
	}
	return s.follows.Feed(ctx, userID, limit)
}

// Setup2FA issues a fresh TOTP secret. It stays inactive until verified.
func (s *UserService) Setup2FA(ctx context.Context, userID uint) (string, string, error) {
	u, err := s.users.FindByID(ctx, userID)
	if err != nil {
		return "", "", err
	}
	if u.TOTPEnabledAt != nil {
		return "", "", domain.ErrConflict
	}
	secret, err := totp.GenerateSecret()
	if err != nil {
		return "", "", err
	}
	u.TOTPSecret = secret
	if err := s.users.Update(ctx, u); err != nil {
		return "", "", err
	}
	return secret, totp.URL("CTF-OJ", u.Username, secret), nil
}

// Enable2FA verifies a code against the pending secret and activates it.
func (s *UserService) Enable2FA(ctx context.Context, userID uint, code string) error {
	u, err := s.users.FindByID(ctx, userID)
	if err != nil {
		return err
	}
	if u.TOTPSecret == "" {
		return domain.ErrInvalidArgument
	}
	if !totp.Verify(u.TOTPSecret, code, time.Now()) {
		return domain.ErrUnauthorized
	}
	now := time.Now()
	u.TOTPEnabledAt = &now
	if err := s.users.Update(ctx, u); err != nil {
		return err
	}
	return nil
}

// Disable2FA requires the account password to confirm the change.
func (s *UserService) Disable2FA(ctx context.Context, userID uint, password string) error {
	u, err := s.users.FindByID(ctx, userID)
	if err != nil {
		return err
	}
	if !crypto.CheckPassword(u.PasswordHash, password) {
		return domain.ErrUnauthorized
	}
	u.TOTPSecret = ""
	u.TOTPEnabledAt = nil
	return s.users.Update(ctx, u)
}
