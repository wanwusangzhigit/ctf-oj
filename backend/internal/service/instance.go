package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/ctf-oj/backend/internal/config"
	"github.com/ctf-oj/backend/internal/domain"
	dockerinfra "github.com/ctf-oj/backend/internal/infrastructure/docker"
)

var (
	ErrNotDynamic         = errors.New("challenge is not dynamic")
	ErrInstanceLimit      = errors.New("instance limit reached for this user")
	ErrNoImageConfigured  = errors.New("challenge has no image configured")
	ErrNoPortConfigured   = errors.New("challenge has no internal port configured")
	ErrInstanceNotFound   = errors.New("instance not found")
	ErrInstanceNotRunning = errors.New("instance not running")
)

type InstanceService struct {
	orch  *dockerinfra.Orchestrator
	repos domain.InstanceRepository
	chals domain.ChallengeRepository
	cfg   config.InstanceConfig
}

func NewInstanceService(
	orch *dockerinfra.Orchestrator,
	repos domain.InstanceRepository,
	chals domain.ChallengeRepository,
	cfg config.InstanceConfig,
) *InstanceService {
	return &InstanceService{orch: orch, repos: repos, chals: chals, cfg: cfg}
}

// SyncOrchestratorFromEnv initializes the docker orchestrator lazily.
// Used by the worker which doesn't have one configured at startup.
func (s *InstanceService) SyncOrchestratorFromEnv() error {
	if s.orch != nil {
		return nil
	}
	o, err := dockerinfra.New()
	if err != nil {
		return err
	}
	s.orch = o
	return nil
}

type StartInstanceResult struct {
	Instance     *domain.Instance `json:"instance"`
	Connection   string           `json:"connection"`
	DynamicFlag  string           `json:"flag,omitempty"`
}

func (s *InstanceService) Start(ctx context.Context, userID, challengeID uint) (*StartInstanceResult, error) {
	chal, err := s.chals.FindByID(ctx, challengeID)
	if err != nil {
		return nil, err
	}
	if !chal.IsDynamic {
		return nil, ErrNotDynamic
	}
	if chal.Image == "" {
		return nil, ErrNoImageConfigured
	}
	if chal.InternalPort <= 0 {
		return nil, ErrNoPortConfigured
	}

	if existing, _ := s.repos.FindActiveByUserAndChallenge(ctx, userID, challengeID); existing != nil {
		return s.buildResult(existing), nil
	}

	totalActive, _ := s.repos.CountActiveByUser(ctx, userID)
	if int(totalActive) >= s.cfg.MaxPerUser {
		return nil, ErrInstanceLimit
	}

	ttl := time.Duration(chal.DefaultTTL) * time.Second
	if ttl <= 0 {
		ttl = s.cfg.DefaultTTL
	}

	port, err := dockerinfra.AllocateHostPort(ctx, s.cfg.PortMin, s.cfg.PortMax, func(p int) bool {
		// 题目容器即将占用此端口；预留空间，假设被未来实例使用
		return false
	})
	if err != nil {
		return nil, fmt.Errorf("allocate port: %w", err)
	}

	instanceID := uuid.NewString()
	dynamicFlag := s.generateFlag()

	startedIn, err := s.orch.Start(ctx, dockerinfra.StartInput{
		Image:         chal.Image,
		InternalPort:  chal.InternalPort,
		HostPort:      port,
		Env:           map[string]string{"FLAG": dynamicFlag, "INSTANCE_ID": instanceID},
		MemoryLimitMB: chal.MemoryLimitMB,
		CPULimit:      chal.CPULimit,
		InstanceID:    instanceID,
	})
	if err != nil {
		return nil, fmt.Errorf("start container: %w", err)
	}

	now := time.Now()
	inst := &domain.Instance{
		UserID:       userID,
		ChallengeID:  challengeID,
		ContainerID:  startedIn.ContainerID,
		Image:        chal.Image,
		Host:         s.cfg.PublicHost,
		Port:         startedIn.HostPort,
		InternalPort: chal.InternalPort,
		DynamicFlag:  dynamicFlag,
		Status:       domain.InstanceRunning,
		ExpiresAt:    now.Add(ttl),
		StartedAt:    now,
	}
	if err := s.repos.Create(ctx, inst); err != nil {
		_ = s.orch.Stop(ctx, startedIn.ContainerID)
		return nil, err
	}
	return s.buildResult(inst), nil
}

func (s *InstanceService) GetActive(ctx context.Context, userID, challengeID uint) (*domain.Instance, error) {
	inst, err := s.repos.FindActiveByUserAndChallenge(ctx, userID, challengeID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, ErrInstanceNotFound
		}
		return nil, err
	}
	if !inst.IsAlive() {
		return nil, ErrInstanceNotRunning
	}
	return inst, nil
}

func (s *InstanceService) Extend(ctx context.Context, userID, instanceID uint, ttl time.Duration) (*domain.Instance, error) {
	inst, err := s.repos.FindByID(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	if inst.UserID != userID {
		return nil, domain.ErrForbidden
	}
	if inst.Status != domain.InstanceRunning {
		return nil, ErrInstanceNotRunning
	}
	if ttl <= 0 {
		ttl = s.cfg.DefaultTTL
	}
	inst.ExpiresAt = inst.ExpiresAt.Add(ttl)
	if err := s.repos.Update(ctx, inst); err != nil {
		return nil, err
	}
	return inst, nil
}

func (s *InstanceService) Stop(ctx context.Context, userID, instanceID uint) error {
	inst, err := s.repos.FindByID(ctx, instanceID)
	if err != nil {
		return err
	}
	if inst.UserID != userID {
		return domain.ErrForbidden
	}
	return s.terminate(ctx, inst)
}

func (s *InstanceService) ListMine(ctx context.Context, userID uint) ([]*domain.Instance, error) {
	return s.repos.ListByUser(ctx, userID)
}

func (s *InstanceService) CleanupExpired(ctx context.Context) (int, error) {
	expired, err := s.repos.ListExpired(ctx, time.Now())
	if err != nil {
		return 0, err
	}
	stopped := 0
	for _, inst := range expired {
		if err := s.terminate(ctx, inst); err == nil {
			stopped++
		}
	}
	return stopped, nil
}

func (s *InstanceService) terminate(ctx context.Context, inst *domain.Instance) error {
	if inst.ContainerID != "" {
		_ = s.orch.Stop(ctx, inst.ContainerID)
	}
	if inst.Status == domain.InstanceRunning {
		now := time.Now()
		inst.StoppedAt = &now
		inst.Status = domain.InstanceStopped
		if time.Now().After(inst.ExpiresAt) {
			inst.Status = domain.InstanceExpired
		}
	}
	return s.repos.Update(ctx, inst)
}

func (s *InstanceService) ValidateDynamicFlag(ctx context.Context, userID, challengeID uint, submitted string) bool {
	inst, err := s.repos.FindActiveByUserAndChallenge(ctx, userID, challengeID)
	if err != nil || inst == nil {
		return false
	}
	a := strings.TrimSpace(submitted)
	b := strings.TrimSpace(inst.DynamicFlag)
	return a != "" && a == b
}

func (s *InstanceService) buildResult(inst *domain.Instance) *StartInstanceResult {
	r := &StartInstanceResult{
		Instance:    inst,
		Connection:  fmt.Sprintf("%s:%d", inst.Host, inst.Port),
		DynamicFlag: inst.DynamicFlag,
	}
	return r
}

func (s *InstanceService) generateFlag() string {
	prefix := strings.TrimSpace(s.cfg.FlagPrefix)
	if prefix == "" {
		prefix = "flag"
	}
	return fmt.Sprintf("%s{%s}", prefix, uuid.NewString())
}
