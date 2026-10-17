package crypto

import (
	"errors"
	"regexp"

	"golang.org/x/crypto/bcrypt"
)

var (
	usernameRe = regexp.MustCompile(`^[a-zA-Z0-9_]{3,32}$`)
	emailRe    = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
)

var (
	ErrInvalidUsername = errors.New("invalid username")
	ErrInvalidEmail    = errors.New("invalid email")
	ErrWeakPassword    = errors.New("password too short")
)

func HashPassword(plain string) (string, error) {
	if len(plain) < 8 {
		return "", ErrWeakPassword
	}
	b, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func CheckPassword(hash, plain string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain)) == nil
}

func ValidateUsername(s string) error {
	if !usernameRe.MatchString(s) {
		return ErrInvalidUsername
	}
	return nil
}

func ValidateEmail(s string) error {
	if !emailRe.MatchString(s) {
		return ErrInvalidEmail
	}
	return nil
}
