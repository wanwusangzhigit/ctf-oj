package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/ctf-oj/backend/internal/config"
	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/infrastructure/mailer"
	"github.com/ctf-oj/backend/internal/infrastructure/metrics"
	"github.com/ctf-oj/backend/internal/pkg/crypto"
	"github.com/ctf-oj/backend/internal/pkg/totp"
)

type AuthService struct {
	users     domain.UserRepository
	evRepo    domain.EmailVerificationRepository
	prRepo    domain.PasswordResetRepository
	settings  *SettingService
	jwt       *JWTService
	cfg       *config.Config
	mailer    mailer.Mailer
	publicURL string // used to build links in emails, e.g. https://ctf.example.com
}

func (s *AuthService) JWT() *JWTService             { return s.jwt }
func (s *AuthService) Users() domain.UserRepository { return s.users }

func NewAuthService(
	users domain.UserRepository,
	evRepo domain.EmailVerificationRepository,
	prRepo domain.PasswordResetRepository,
	settings *SettingService,
	jwt *JWTService,
	cfg *config.Config,
	m mailer.Mailer,
	publicURL string,
) *AuthService {
	return &AuthService{
		users:     users,
		evRepo:    evRepo,
		prRepo:    prRepo,
		settings:  settings,
		jwt:       jwt,
		cfg:       cfg,
		mailer:    m,
		publicURL: strings.TrimRight(publicURL, "/"),
	}
}

type RegisterInput struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
	// RegistrationCode is required when the site has site.registration_code set.
	RegistrationCode string `json:"registrationCode"`
}

type LoginInput struct {
	Account  string `json:"account"`
	Password string `json:"password"`
	TOTPCode string `json:"totpCode"`
}

// Register creates a new user. If email verification is required, a
// verification email is sent and the user is created in an "unverified" state.
// Login is still permitted for unverified users; the frontend may restrict
// certain actions until verification is complete.
func (s *AuthService) Register(ctx context.Context, in RegisterInput) (*domain.User, error) {
	if !s.cfg.RegisterOpen {
		return nil, errors.New("registration is disabled")
	}
	if s.settings != nil && !s.settings.GetBool(ctx, SettingRegistrationOpen, true) {
		return nil, errors.New("registration is disabled by site settings")
	}
	if code := strings.TrimSpace(s.settings.GetString(ctx, SettingRegistrationCode, "")); code != "" {
		if in.RegistrationCode != code {
			return nil, errors.New("invalid registration code")
		}
	}
	in.Username = strings.TrimSpace(in.Username)
	in.Email = strings.TrimSpace(strings.ToLower(in.Email))
	if err := crypto.ValidateUsername(in.Username); err != nil {
		return nil, err
	}
	if err := crypto.ValidateEmail(in.Email); err != nil {
		return nil, err
	}
	if len(in.Password) < 8 {
		return nil, crypto.ErrWeakPassword
	}

	if existing, err := s.users.FindByUsername(ctx, in.Username); err == nil && existing != nil {
		return nil, domain.ErrAlreadyExists
	} else if err != nil && !errors.Is(err, domain.ErrNotFound) {
		return nil, err
	}
	if existing, err := s.users.FindByEmail(ctx, in.Email); err == nil && existing != nil {
		return nil, domain.ErrAlreadyExists
	} else if err != nil && !errors.Is(err, domain.ErrNotFound) {
		return nil, err
	}

	hash, err := crypto.HashPassword(in.Password)
	if err != nil {
		return nil, err
	}
	u := &domain.User{
		Username:     in.Username,
		Email:        in.Email,
		PasswordHash: hash,
		Role:         domain.RoleUser,
	}
	if err := s.users.Create(ctx, u); err != nil {
		return nil, err
	}
	metrics.RegistrationsTotal.Inc()

	// Best-effort: send verification email; if it fails we still return the user.
	if s.settings != nil && s.settings.GetBool(ctx, SettingEmailVerificationRequired, false) {
		_ = s.SendVerificationEmail(ctx, u)
	}
	return u, nil
}

func (s *AuthService) Login(ctx context.Context, in LoginInput) (*domain.User, *TokenPair, error) {
	metrics.LoginsTotal.Inc()
	acc := strings.TrimSpace(in.Account)
	if acc == "" {
		return nil, nil, errors.New("account is required")
	}
	var (
		u   *domain.User
		err error
	)
	if strings.Contains(acc, "@") {
		u, err = s.users.FindByEmail(ctx, strings.ToLower(acc))
	} else {
		u, err = s.users.FindByUsername(ctx, acc)
	}
	if err != nil || u == nil {
		return nil, nil, domain.ErrUnauthorized
	}
	if !crypto.CheckPassword(u.PasswordHash, in.Password) {
		return nil, nil, domain.ErrUnauthorized
	}
	if u.IsBanned {
		return nil, nil, domain.ErrForbidden
	}
	u.Permissions = domain.PermissionStrings(u.Role)
	if u.TOTPEnabledAt != nil {
		if strings.TrimSpace(in.TOTPCode) == "" {
			return nil, nil, domain.ErrTOTPRequired
		}
		if !totp.Verify(u.TOTPSecret, in.TOTPCode, time.Now()) {
			return nil, nil, domain.ErrUnauthorized
		}
	}
	pair, err := s.jwt.Issue(u.ID, u.Username, string(u.Role))
	if err != nil {
		return nil, nil, err
	}
	return u, pair, nil
}

func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (*TokenPair, error) {
	claims, err := s.jwt.Parse(refreshToken)
	if err != nil {
		return nil, domain.ErrUnauthorized
	}
	if claims.Type != RefreshToken {
		return nil, domain.ErrUnauthorized
	}
	u, err := s.users.FindByID(ctx, claims.UserID)
	if err != nil {
		return nil, domain.ErrUnauthorized
	}
	if u.IsBanned {
		return nil, domain.ErrForbidden
	}
	return s.jwt.Issue(u.ID, u.Username, string(u.Role))
}

// ----- Email verification -----

func (s *AuthService) SendVerificationEmail(ctx context.Context, u *domain.User) error {
	if s.evRepo == nil {
		return errors.New("email verification not configured")
	}
	// Throttle: don't send more than once every 60s.
	if u.VerificationSentAt != nil && time.Since(*u.VerificationSentAt) < time.Minute {
		return errors.New("verification email sent recently; check your inbox")
	}
	token, err := generateToken(32)
	if err != nil {
		return err
	}
	ev := &domain.EmailVerification{
		UserID:    u.ID,
		Token:     token,
		ExpiresAt: time.Now().Add(24 * time.Hour),
	}
	if err := s.evRepo.Create(ctx, ev); err != nil {
		return err
	}
	now := time.Now()
	u.VerificationSentAt = &now
	_ = s.users.Update(ctx, u)

	link := fmt.Sprintf("%s/auth/verify-email?token=%s", s.publicURL, token)
	return s.mailer.Send(ctx, mailer.Message{
		To:      u.Email,
		Subject: "Verify your email — " + s.siteName(ctx),
		Body:    fmt.Sprintf("Welcome to %s.\n\nVerify your email by opening this link:\n%s\n\nThe link expires in 24 hours.", s.siteName(ctx), link),
	})
}

func (s *AuthService) VerifyEmail(ctx context.Context, token string) error {
	if s.evRepo == nil {
		return errors.New("email verification not configured")
	}
	ev, err := s.evRepo.FindByToken(ctx, token)
	if err != nil {
		return domain.ErrInvalidArgument
	}
	if ev.UsedAt != nil {
		return errors.New("verification link already used")
	}
	if time.Now().After(ev.ExpiresAt) {
		return errors.New("verification link expired")
	}
	u, err := s.users.FindByID(ctx, ev.UserID)
	if err != nil {
		return err
	}
	now := time.Now()
	u.EmailVerifiedAt = &now
	if err := s.users.Update(ctx, u); err != nil {
		return err
	}
	return s.evRepo.MarkUsed(ctx, ev.ID)
}

// ----- Password reset -----

func (s *AuthService) RequestPasswordReset(ctx context.Context, emailOrUsername string) error {
	if s.prRepo == nil {
		return errors.New("password reset not configured")
	}
	if s.settings != nil && !s.settings.GetBool(ctx, SettingPasswordResetEnabled, false) {
		return errors.New("password reset is disabled")
	}
	acc := strings.TrimSpace(strings.ToLower(emailOrUsername))
	if acc == "" {
		return nil // silent no-op so we don't leak which accounts exist
	}
	var (
		u   *domain.User
		err error
	)
	if strings.Contains(acc, "@") {
		u, err = s.users.FindByEmail(ctx, acc)
	} else {
		u, err = s.users.FindByUsername(ctx, acc)
	}
	if err != nil || u == nil {
		return nil // silent no-op
	}
	token, err := generateToken(32)
	if err != nil {
		return err
	}
	pr := &domain.PasswordReset{
		UserID:    u.ID,
		Token:     token,
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}
	if err := s.prRepo.Create(ctx, pr); err != nil {
		return err
	}
	link := fmt.Sprintf("%s/auth/reset-password?token=%s", s.publicURL, token)
	return s.mailer.Send(ctx, mailer.Message{
		To:      u.Email,
		Subject: "Reset your password — " + s.siteName(ctx),
		Body:    fmt.Sprintf("We received a request to reset your password.\n\nOpen this link to choose a new one:\n%s\n\nThe link expires in 1 hour. If you didn't request this, ignore this email.", link),
	})
}

func (s *AuthService) ResetPassword(ctx context.Context, token, newPassword string) error {
	if s.prRepo == nil {
		return errors.New("password reset not configured")
	}
	if len(newPassword) < 8 {
		return crypto.ErrWeakPassword
	}
	pr, err := s.prRepo.FindByToken(ctx, token)
	if err != nil {
		return domain.ErrInvalidArgument
	}
	if pr.UsedAt != nil {
		return errors.New("reset link already used")
	}
	if time.Now().After(pr.ExpiresAt) {
		return errors.New("reset link expired")
	}
	u, err := s.users.FindByID(ctx, pr.UserID)
	if err != nil {
		return err
	}
	hash, err := crypto.HashPassword(newPassword)
	if err != nil {
		return err
	}
	u.PasswordHash = hash
	if err := s.users.Update(ctx, u); err != nil {
		return err
	}
	return s.prRepo.MarkUsed(ctx, pr.ID)
}

func (s *AuthService) siteName(ctx context.Context) string {
	if s.settings != nil {
		return s.settings.GetString(ctx, SettingSiteName, "CTF-OJ")
	}
	return "CTF-OJ"
}

func generateToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
