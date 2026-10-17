package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"

	"github.com/ctf-oj/backend/internal/config"
	"github.com/ctf-oj/backend/internal/domain"
)

var (
	ErrTooLarge = errors.New("file too large")
	ErrEmpty    = errors.New("empty file")
)

func New(cfg config.StorageConfig) (domain.Storage, error) {
	switch cfg.Driver {
	case "local":
		return newLocalStorage(cfg.LocalDir)
	default:
		return nil, fmt.Errorf("unsupported storage driver: %s", cfg.Driver)
	}
}

type localStorage struct {
	root string
}

func newLocalStorage(root string) (*localStorage, error) {
	if err := os.MkdirAll(root, 0o755); err != nil {
		return nil, fmt.Errorf("create storage dir: %w", err)
	}
	return &localStorage{root: root}, nil
}

func (s *localStorage) Save(ctx context.Context, reader io.Reader, originalName string) (*domain.StoredObject, error) {
	ext := strings.ToLower(filepath.Ext(originalName))
	if len(ext) > 16 {
		ext = ""
	}
	key := fmt.Sprintf("%s%s", uuid.NewString(), ext)
	full := filepath.Join(s.root, key)

	f, err := os.Create(full)
	if err != nil {
		return nil, fmt.Errorf("create file: %w", err)
	}
	defer f.Close()

	n, err := io.Copy(f, reader)
	if err != nil {
		_ = os.Remove(full)
		return nil, fmt.Errorf("write file: %w", err)
	}
	if n == 0 {
		_ = os.Remove(full)
		return nil, ErrEmpty
	}

	return &domain.StoredObject{Key: key, Size: n}, nil
}

func (s *localStorage) Open(ctx context.Context, key string) (io.ReadCloser, int64, error) {
	full := filepath.Join(s.root, key)
	info, err := os.Stat(full)
	if err != nil {
		return nil, 0, err
	}
	f, err := os.Open(full)
	if err != nil {
		return nil, 0, err
	}
	return f, info.Size(), nil
}

func (s *localStorage) Delete(ctx context.Context, key string) error {
	return os.Remove(filepath.Join(s.root, key))
}

func (s *localStorage) Path(key string) string {
	return filepath.Join(s.root, key)
}
