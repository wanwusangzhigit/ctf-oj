package service

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/ctf-oj/backend/internal/config"
)

type TokenType string

const (
	AccessToken  TokenType = "access"
	RefreshToken TokenType = "refresh"
)

type Claims struct {
	UserID   uint      `json:"uid"`
	Username string    `json:"usr"`
	Role     string    `json:"rol"`
	Type     TokenType `json:"typ"`
	jwt.RegisteredClaims
}

type JWTService struct {
	secret    []byte
	accessTTL time.Duration
	refreshTTL time.Duration
	issuer    string
}

func NewJWTService(cfg config.JWTConfig) *JWTService {
	return &JWTService{
		secret:     []byte(cfg.Secret),
		accessTTL:  cfg.AccessTTL,
		refreshTTL: cfg.RefreshTTL,
		issuer:     cfg.Issuer,
	}
}

type TokenPair struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresAt    int64  `json:"expiresAt"`
}

func (s *JWTService) Issue(userID uint, username, role string) (*TokenPair, error) {
	at, err := s.sign(userID, username, role, AccessToken, s.accessTTL)
	if err != nil {
		return nil, err
	}
	rt, err := s.sign(userID, username, role, RefreshToken, s.refreshTTL)
	if err != nil {
		return nil, err
	}
	exp := time.Now().Add(s.accessTTL).Unix()
	return &TokenPair{AccessToken: at, RefreshToken: rt, ExpiresAt: exp}, nil
}

func (s *JWTService) sign(userID uint, username, role string, typ TokenType, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := &Claims{
		UserID:   userID,
		Username: username,
		Role:     role,
		Type:     typ,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    s.issuer,
			Subject:   fmt.Sprintf("%d", userID),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return tok.SignedString(s.secret)
}

func (s *JWTService) Parse(tokenStr string) (*Claims, error) {
	parsed, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("invalid signing method")
		}
		return s.secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := parsed.Claims.(*Claims)
	if !ok || !parsed.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}
