// Package storage provides the per-challenge source tree used by
// dockerfile/compose build sources. Each challenge owns a directory
// identified by its numeric ID. Access is restricted to the backend
// process uid/gid; directories are created with mode 0o750 and files
// written via the atomic writer with mode 0o640.
package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const (
	dirPerm  os.FileMode = 0o750
	filePerm os.FileMode = 0o640
	rootPerm os.FileMode = 0o755
)

var (
	ErrIllegalPath = errors.New("illegal path outside challenge source dir")
	ErrEmptyName   = errors.New("empty file name")
)

// ChallengeSources is a per-challenge source tree rooted at SourceDir/<id>.
type ChallengeSources struct {
	root string
}

func NewChallengeSources(root string) (*ChallengeSources, error) {
	if err := os.MkdirAll(root, rootPerm); err != nil {
		return nil, fmt.Errorf("create challenge source dir: %w", err)
	}
	return &ChallengeSources{root: root}, nil
}

// ChallengeDir returns the absolute path of a challenge's source directory,
// creating it on first access.
func (s *ChallengeSources) ChallengeDir(challengeID uint) (string, error) {
	dir := filepath.Join(s.root, fmt.Sprintf("challenge-%d", challengeID))
	if err := os.MkdirAll(dir, dirPerm); err != nil {
		return "", fmt.Errorf("create challenge dir: %w", err)
	}
	return dir, nil
}

// Write stores a file under the challenge directory. Subdirectories are allowed
// but path traversal outside the directory is rejected.
func (s *ChallengeSources) Write(ctx context.Context, challengeID uint, relPath string, r io.Reader) error {
	clean := cleanRelPath(relPath)
	if clean == "" {
		return ErrEmptyName
	}
	dir, err := s.ChallengeDir(challengeID)
	if err != nil {
		return err
	}
	full := filepath.Join(dir, clean)
	if !strings.HasPrefix(full+string(os.PathSeparator), dir+string(os.PathSeparator)) && full != dir {
		return ErrIllegalPath
	}
	if err := os.MkdirAll(filepath.Dir(full), dirPerm); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(full), ".tmp-")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)
	if _, err := io.Copy(tmp, r); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Chmod(tmpPath, filePerm); err != nil {
		return err
	}
	return os.Rename(tmpPath, full)
}

// Open opens a file inside the challenge directory.
func (s *ChallengeSources) Open(ctx context.Context, challengeID uint, relPath string) (*os.File, int64, error) {
	clean := cleanRelPath(relPath)
	if clean == "" {
		return nil, 0, ErrEmptyName
	}
	dir, err := s.ChallengeDir(challengeID)
	if err != nil {
		return nil, 0, err
	}
	full := filepath.Join(dir, clean)
	if !strings.HasPrefix(full+string(os.PathSeparator), dir+string(os.PathSeparator)) && full != dir {
		return nil, 0, ErrIllegalPath
	}
	info, err := os.Stat(full)
	if err != nil {
		return nil, 0, err
	}
	if info.IsDir() {
		return nil, 0, fmt.Errorf("is directory")
	}
	f, err := os.Open(full)
	if err != nil {
		return nil, 0, err
	}
	return f, info.Size(), nil
}

// Delete removes a file (or empty subtree) inside the challenge directory.
func (s *ChallengeSources) Delete(ctx context.Context, challengeID uint, relPath string) error {
	clean := cleanRelPath(relPath)
	if clean == "" {
		return ErrEmptyName
	}
	dir, err := s.ChallengeDir(challengeID)
	if err != nil {
		return err
	}
	full := filepath.Join(dir, clean)
	if !strings.HasPrefix(full+string(os.PathSeparator), dir+string(os.PathSeparator)) && full != dir {
		return ErrIllegalPath
	}
	return os.RemoveAll(full)
}

// Tree lists all files inside a challenge directory with their relative paths.
// Returns a sorted slice (depth-first, alphabetical).
type SourceEntry struct {
	Path string `json:"path"`
	Size int64  `json:"size"`
}

func (s *ChallengeSources) Tree(ctx context.Context, challengeID uint) ([]SourceEntry, error) {
	dir, err := s.ChallengeDir(challengeID)
	if err != nil {
		return nil, err
	}
	var entries []SourceEntry
	err = filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			if os.IsNotExist(err) {
				return nil
			}
			return err
		}
		if info.IsDir() {
			return nil
		}
		rel, _ := filepath.Rel(dir, path)
		entries = append(entries, SourceEntry{Path: filepath.ToSlash(rel), Size: info.Size()})
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Path < entries[j].Path })
	return entries, nil
}

// RemoveChallenge wipes the entire directory for a challenge (used on challenge delete).
func (s *ChallengeSources) RemoveChallenge(challengeID uint) error {
	dir := filepath.Join(s.root, fmt.Sprintf("challenge-%d", challengeID))
	return os.RemoveAll(dir)
}

func cleanRelPath(p string) string {
	p = strings.TrimSpace(p)
	p = strings.ReplaceAll(p, "\\", "/")
	for strings.HasPrefix(p, "/") {
		p = p[1:]
	}
	cleaned := filepath.Clean(p)
	if cleaned == "." || cleaned == "" {
		return ""
	}
	return filepath.ToSlash(cleaned)
}
