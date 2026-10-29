package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"path/filepath"

	"github.com/ctf-oj/backend/internal/domain"
)

type ExportService struct {
	challenges  domain.ChallengeRepository
	categories  domain.CategoryRepository
	flags       domain.FlagRepository
	attachments domain.AttachmentRepository
	storage     domain.Storage
}

func NewExportService(
	c domain.ChallengeRepository,
	cat domain.CategoryRepository,
	f domain.FlagRepository,
	a domain.AttachmentRepository,
	s domain.Storage,
) *ExportService {
	return &ExportService{
		challenges:  c,
		categories:  cat,
		flags:       f,
		attachments: a,
		storage:     s,
	}
}

// ExportCategory is the JSON shape for a category in the export bundle.
type ExportCategory struct {
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	SortOrder   int    `json:"sortOrder"`
}

// ExportFlag is the JSON shape for a flag in the export bundle.
type ExportFlag struct {
	Type          string `json:"type"`
	Content       string `json:"content"`
	CaseSensitive bool   `json:"caseSensitive"`
}

// ExportAttachment is metadata only (filename/size); file contents are not embedded to keep the bundle small.
type ExportAttachment struct {
	Filename   string `json:"filename"`
	MimeType   string `json:"mimeType"`
	Size       int64  `json:"size"`
	StorageKey string `json:"storageKey"`
}

// ExportChallenge is the JSON shape for a challenge in the export bundle.
type ExportChallenge struct {
	CategorySlug   string             `json:"categorySlug"`
	Title          string             `json:"title"`
	Description    string             `json:"description"`
	BaseScore      int                `json:"baseScore"`
	MinScore       int                `json:"minScore"`
	Decay          int                `json:"decay"`
	Difficulty     int                `json:"difficulty"`
	Status         string             `json:"status"`
	EditorialMD    string             `json:"editorial"`
	IsPublished    bool               `json:"isPublished"`
	ConnectionInfo string             `json:"connectionInfo"`
	Tags           string             `json:"tags"`
	IsDynamic      bool               `json:"isDynamic"`
	Image          string             `json:"image"`
	InternalPort   int                `json:"internalPort"`
	DefaultTTL     int                `json:"defaultTtl"`
	MemoryLimitMB  int                `json:"memoryLimitMb"`
	CPULimit       int                `json:"cpuLimit"`
	PidsLimit      int                `json:"pidsLimit"`
	Flags          []ExportFlag       `json:"flags"`
	Attachments    []ExportAttachment `json:"attachments"`
}

// ExportBundle is the top-level export format.
type ExportBundle struct {
	Version    int               `json:"version"`
	ExportedAt string            `json:"exportedAt"`
	Categories []ExportCategory  `json:"categories"`
	Challenges []ExportChallenge `json:"challenges"`
}

func (s *ExportService) Export(ctx context.Context, w io.Writer) error {
	bundle := ExportBundle{Version: 1}

	cats, err := s.categories.List(ctx)
	if err != nil {
		return err
	}
	for _, c := range cats {
		bundle.Categories = append(bundle.Categories, ExportCategory{
			Name: c.Name, Slug: c.Slug, Description: c.Description, SortOrder: c.SortOrder,
		})
	}

	chals, _, err := s.challenges.List(ctx, domain.ChallengeFilter{PageSize: 1000})
	if err != nil {
		return err
	}
	for _, c := range chals {
		flags, _ := s.flags.FindByChallengeID(ctx, c.ID)
		atts, _ := s.attachments.ListByChallengeID(ctx, c.ID)
		categorySlug := ""
		if c.Category != nil {
			categorySlug = c.Category.Slug
		} else if c.CategoryID > 0 {
			if cat, e := s.categories.FindByID(ctx, c.CategoryID); e == nil {
				categorySlug = cat.Slug
			}
		}
		ec := ExportChallenge{
			CategorySlug:   categorySlug,
			Title:          c.Title,
			Description:    c.Description,
			BaseScore:      c.BaseScore,
			MinScore:       c.MinScore,
			Decay:          c.Decay,
			Difficulty:     c.Difficulty,
			Status:         string(c.Status),
			EditorialMD:    c.EditorialMD,
			IsPublished:    c.IsPublished,
			ConnectionInfo: c.ConnectionInfo,
			Tags:           c.Tags,
			IsDynamic:      c.IsDynamic,
			Image:          c.Image,
			InternalPort:   c.InternalPort,
			DefaultTTL:     c.DefaultTTL,
			MemoryLimitMB:  c.MemoryLimitMB,
			CPULimit:       c.CPULimit,
			PidsLimit:      c.PidsLimit,
		}
		for _, f := range flags {
			ec.Flags = append(ec.Flags, ExportFlag{
				Type:          string(f.Type),
				Content:       f.Content,
				CaseSensitive: f.CaseSensitive,
			})
		}
		for _, a := range atts {
			ec.Attachments = append(ec.Attachments, ExportAttachment{
				Filename: a.Filename, MimeType: a.MimeType, Size: a.Size, StorageKey: a.StorageKey,
			})
		}
		bundle.Challenges = append(bundle.Challenges, ec)
	}

	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	return enc.Encode(&bundle)
}

func (s *ExportService) Import(ctx context.Context, r io.Reader, actorID uint) (*ImportSummary, error) {
	var bundle ExportBundle
	dec := json.NewDecoder(r)
	if err := dec.Decode(&bundle); err != nil {
		return nil, fmt.Errorf("decode bundle: %w", err)
	}
	if bundle.Version != 1 {
		return nil, errors.New("unsupported bundle version")
	}

	summary := &ImportSummary{}

	// Step 1: import categories (find-or-create by slug)
	slugToID := make(map[string]uint)
	allCats, _ := s.categories.List(ctx)
	for _, c := range allCats {
		slugToID[c.Slug] = c.ID
	}
	for _, ec := range bundle.Categories {
		if _, ok := slugToID[ec.Slug]; ok {
			continue
		}
		cat := &domain.Category{
			Name:        ec.Name,
			Slug:        ec.Slug,
			Description: ec.Description,
			SortOrder:   ec.SortOrder,
		}
		if err := s.categories.Create(ctx, cat); err != nil {
			return nil, err
		}
		slugToID[ec.Slug] = cat.ID
		summary.CategoriesCreated++
	}

	// Step 2: import challenges
	existingChals, _, _ := s.challenges.List(ctx, domain.ChallengeFilter{PageSize: 1000})
	existingTitles := make(map[string]bool)
	for _, c := range existingChals {
		existingTitles[c.Title] = true
	}
	for _, ec := range bundle.Challenges {
		if existingTitles[ec.Title] {
			summary.ChallengesSkipped++
			continue
		}
		catID, ok := slugToID[ec.CategorySlug]
		if !ok {
			summary.ChallengesSkipped++
			continue
		}
		status := ec.Status
		if status == "" {
			if ec.IsPublished {
				status = string(domain.ChallengePublished)
			} else {
				status = string(domain.ChallengeDraft)
			}
		}
		ch := &domain.Challenge{
			CategoryID:     catID,
			Title:          ec.Title,
			Description:    ec.Description,
			BaseScore:      ec.BaseScore,
			MinScore:       ec.MinScore,
			Decay:          ec.Decay,
			Difficulty:     ec.Difficulty,
			Status:         domain.ChallengeStatus(status),
			EditorialMD:    ec.EditorialMD,
			IsPublished:    ec.IsPublished,
			ConnectionInfo: ec.ConnectionInfo,
			Tags:           ec.Tags,
			IsDynamic:      ec.IsDynamic,
			Image:          ec.Image,
			InternalPort:   ec.InternalPort,
			DefaultTTL:     ec.DefaultTTL,
			MemoryLimitMB:  ec.MemoryLimitMB,
			CPULimit:       ec.CPULimit,
			PidsLimit:      ec.PidsLimit,
			CreatedBy:      actorID,
		}
		if ch.BaseScore <= 0 {
			ch.BaseScore = 500
		}
		if ch.MinScore < 0 {
			ch.MinScore = 0
		}
		if ch.Decay <= 0 {
			ch.Decay = 10
		}
		if ch.Difficulty <= 0 {
			ch.Difficulty = 2
		}
		if err := s.challenges.Create(ctx, ch); err != nil {
			summary.ChallengesFailed++
			continue
		}
		for _, f := range ec.Flags {
			flag := &domain.Flag{
				ChallengeID:   ch.ID,
				Type:          domain.FlagType(f.Type),
				Content:       f.Content,
				CaseSensitive: f.CaseSensitive,
			}
			if err := s.flags.Create(ctx, flag); err == nil {
				// ok
			}
		}
		// Best-effort attachment re-link (only StorageKey copied; same volume required)
		for _, ea := range ec.Attachments {
			if ea.StorageKey == "" {
				continue
			}
			a := &domain.Attachment{
				ChallengeID: ch.ID,
				Filename:    ea.Filename,
				StorageKey:  ea.StorageKey,
				MimeType:    ea.MimeType,
				Size:        ea.Size,
			}
			if err := s.attachments.Create(ctx, a); err == nil {
				summary.AttachmentsLinked++
			}
		}
		summary.ChallengesCreated++
	}

	return summary, nil
}

type ImportSummary struct {
	CategoriesCreated int `json:"categoriesCreated"`
	ChallengesCreated int `json:"challengesCreated"`
	ChallengesSkipped int `json:"challengesSkipped"`
	ChallengesFailed  int `json:"challengesFailed"`
	AttachmentsLinked int `json:"attachmentsLinked"`
}

// utility used internally when copying attachment metadata only
var _ = filepath.Base
