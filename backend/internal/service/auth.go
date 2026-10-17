package service

import (
	"context"
	"errors"
	"strings"

	"github.com/ctf-oj/backend/internal/config"
	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/crypto"
)

type AuthService struct {
	users  domain.UserRepository
	jwt    *JWTService
	cfg    *config.Config
}

func (s *AuthService) JWT() *JWTService { return s.jwt }
func (s *AuthService) Users() domain.UserRepository { return s.users }

func NewAuthService(users domain.UserRepository, jwt *JWTService, cfg *config.Config) *AuthService {
	return &AuthService{users: users, jwt: jwt, cfg: cfg}
}

type RegisterInput struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginInput struct {
	Account string `json:"account"`
	Password string `json:"password"`
}

func (s *AuthService) Register(ctx context.Context, in RegisterInput) (*domain.User, error) {
	if !s.cfg.RegisterOpen {
		return nil, errors.New("registration is disabled")
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
	return u, nil
}

func (s *AuthService) Login(ctx context.Context, in LoginInput) (*domain.User, *TokenPair, error) {
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
	return s.jwt.Issue(u.ID, u.Username, string(u.Role))
}
