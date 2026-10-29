package service

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/ctf-oj/backend/internal/config"
	"github.com/ctf-oj/backend/internal/domain"
	dockerinfra "github.com/ctf-oj/backend/internal/infrastructure/docker"
	"github.com/ctf-oj/backend/internal/infrastructure/metrics"
	"github.com/ctf-oj/backend/internal/infrastructure/storage"
)

var (
	ErrNotDynamic         = errors.New("challenge is not dynamic")
	ErrInstanceLimit      = errors.New("instance limit reached for this user")
	ErrNoImageConfigured  = errors.New("challenge has no image configured")
	ErrNoPortConfigured   = errors.New("challenge has no internal port configured")
	ErrInstanceNotFound   = errors.New("instance not found")
	ErrInstanceNotRunning = errors.New("instance not running")
)

const (
	readinessProbeAttempts = 10
	readinessProbeInterval = 500 * time.Millisecond
	adminLogsTailLines     = "500"
)

type InstanceService struct {
	orch    *dockerinfra.Orchestrator
	repos   domain.InstanceRepository
	chals   domain.ChallengeRepository
	sources *storage.ChallengeSources
	teams   domain.TeamRepository
	cfg     config.InstanceConfig
	access  *ChallengeAccessService
}

func NewInstanceService(
	orch *dockerinfra.Orchestrator,
	repos domain.InstanceRepository,
	chals domain.ChallengeRepository,
	sources *storage.ChallengeSources,
	cfg config.InstanceConfig,
) *InstanceService {
	return &InstanceService{orch: orch, repos: repos, chals: chals, sources: sources, cfg: cfg}
}

// SetTeamRepository enables team-shared instances. Optional so the worker
// (which only expires instances) does not need team wiring.
func (s *InstanceService) SetTeamRepository(t domain.TeamRepository) { s.teams = t }

func (s *InstanceService) SetAccessService(a *ChallengeAccessService) { s.access = a }

func (s *InstanceService) teamIDFor(ctx context.Context, userID uint) uint {
	if s.teams == nil {
		return 0
	}
	m, err := s.teams.FindMembership(ctx, userID)
	if err != nil || m == nil {
		return 0
	}
	return m.TeamID
}

func (s *InstanceService) canAccess(ctx context.Context, userID uint, inst *domain.Instance) bool {
	if inst.UserID == userID {
		return true
	}
	if inst.TeamID == 0 {
		return false
	}
	return s.teamIDFor(ctx, userID) == inst.TeamID
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
	Instance    *domain.Instance `json:"instance"`
	Connection  string           `json:"connection"`
	DynamicFlag string           `json:"flag,omitempty"`
}

func (s *InstanceService) Start(ctx context.Context, userID, challengeID uint) (*StartInstanceResult, error) {
	chal, err := s.chals.FindByID(ctx, challengeID)
	if err != nil {
		return nil, err
	}
	if s.access != nil {
		ok, err := s.access.CanView(ctx, chal, userID, false)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, domain.ErrNotFound
		}
	} else if !chal.IsPublished {
		return nil, domain.ErrNotFound
	}
	if !chal.IsDynamic {
		return nil, ErrNotDynamic
	}
	if chal.InternalPort <= 0 {
		return nil, ErrNoPortConfigured
	}
	if chal.SourceType == domain.SourceImage && chal.Image == "" {
		return nil, ErrNoImageConfigured
	}

	if existing, _ := s.repos.FindActiveByUserAndChallenge(ctx, userID, challengeID); existing != nil {
		return s.buildResult(existing, chal.ConnectionInfo), nil
	}
	teamID := s.teamIDFor(ctx, userID)
	if teamID > 0 {
		if existing, _ := s.repos.FindActiveByTeamAndChallenge(ctx, teamID, challengeID); existing != nil {
			return s.buildResult(existing, chal.ConnectionInfo), nil
		}
	}

	totalActive, _ := s.repos.CountActiveByUser(ctx, userID)
	if int(totalActive) >= s.cfg.MaxPerUser {
		return nil, ErrInstanceLimit
	}

	ttl := time.Duration(chal.DefaultTTL) * time.Second
	if ttl <= 0 {
		ttl = s.cfg.DefaultTTL
	}

	port, err := dockerinfra.AllocateHostPort(ctx, s.cfg.PortMin, s.cfg.PortMax, nil)
	if err != nil {
		return nil, fmt.Errorf("allocate port: %w", err)
	}

	instanceID := uuid.NewString()
	dynamicFlag := s.generateFlag()
	env := map[string]string{
		"FLAG":           dynamicFlag,
		"INSTANCE_ID":    instanceID,
		"PUBLISHED_PORT": fmt.Sprintf("%d", port),
	}

	started, err := s.startBySource(ctx, chal, instanceID, port, env)
	if err != nil {
		metrics.InstanceErrorsTotal.WithLabelValues(fmt.Sprintf("%d", challengeID)).Inc()
		return nil, err
	}

	now := time.Now()
	inst := &domain.Instance{
		UserID:         userID,
		TeamID:         teamID,
		ChallengeID:    challengeID,
		ContainerID:    started.ContainerID,
		ComposeProject: started.ComposeProject,
		Image:          started.Image,
		Host:           s.cfg.PublicHost,
		Port:           started.HostPort,
		InternalPort:   chal.InternalPort,
		DynamicFlag:    dynamicFlag,
		Status:         domain.InstanceRunning,
		ExpiresAt:      now.Add(ttl),
		StartedAt:      now,
	}
	if err := s.repos.Create(ctx, inst); err != nil {
		s.cleanupContainer(ctx, inst)
		metrics.InstanceErrorsTotal.WithLabelValues(fmt.Sprintf("%d", challengeID)).Inc()
		return nil, err
	}
	metrics.InstanceStartsTotal.WithLabelValues(fmt.Sprintf("%d", challengeID), string(chal.SourceType)).Inc()
	s.probeReady(ctx, started.HostPort)
	return s.buildResult(inst, chal.ConnectionInfo), nil
}

// startedInfo is the unified descriptor of a freshly started instance,
// regardless of source type.
type startedInfo struct {
	ContainerID    string
	ComposeProject string
	Image          string
	HostPort       int
}

func (s *InstanceService) startBySource(ctx context.Context, chal *domain.Challenge, instanceID string, hostPort int, env map[string]string) (*startedInfo, error) {
	switch chal.SourceType {
	case domain.SourceDockerfile:
		return s.startFromDockerfile(ctx, chal, instanceID, hostPort, env)
	case domain.SourceCompose:
		return s.startFromCompose(ctx, chal, instanceID, hostPort, env)
	default:
		return s.startFromImage(ctx, chal, instanceID, hostPort, env)
	}
}

func (s *InstanceService) startFromImage(ctx context.Context, chal *domain.Challenge, instanceID string, hostPort int, env map[string]string) (*startedInfo, error) {
	in, err := s.orch.Start(ctx, dockerinfra.StartInput{
		Image:         chal.Image,
		InternalPort:  chal.InternalPort,
		HostPort:      hostPort,
		Env:           env,
		MemoryLimitMB: chal.MemoryLimitMB,
		CPULimit:      chal.CPULimit,
		PidsLimit:     chal.PidsLimit,
		InstanceID:    instanceID,
	})
	if err != nil {
		return nil, fmt.Errorf("start container: %w", err)
	}
	return &startedInfo{ContainerID: in.ContainerID, Image: chal.Image, HostPort: in.HostPort}, nil
}

func (s *InstanceService) startFromDockerfile(ctx context.Context, chal *domain.Challenge, instanceID string, hostPort int, env map[string]string) (*startedInfo, error) {
	if s.sources == nil {
		return nil, fmt.Errorf("challenge source storage not configured")
	}
	dir, err := s.sources.ChallengeDir(chal.ID)
	if err != nil {
		return nil, err
	}
	if _, err := os.Stat(filepath.Join(dir, "Dockerfile")); err != nil {
		return nil, fmt.Errorf("Dockerfile not found in source dir: %w", err)
	}
	imageTag := fmt.Sprintf("ctfoj-chal-%d:%s", chal.ID, shortTag())
	if _, err := s.orch.Build(ctx, imageTag, dir); err != nil {
		return nil, fmt.Errorf("docker build: %w", err)
	}
	in, err := s.orch.Start(ctx, dockerinfra.StartInput{
		Image:         imageTag,
		InternalPort:  chal.InternalPort,
		HostPort:      hostPort,
		Env:           env,
		MemoryLimitMB: chal.MemoryLimitMB,
		CPULimit:      chal.CPULimit,
		PidsLimit:     chal.PidsLimit,
		InstanceID:    instanceID,
	})
	if err != nil {
		return nil, fmt.Errorf("start built container: %w", err)
	}
	return &startedInfo{ContainerID: in.ContainerID, Image: imageTag, HostPort: in.HostPort}, nil
}

func (s *InstanceService) startFromCompose(ctx context.Context, chal *domain.Challenge, instanceID string, hostPort int, env map[string]string) (*startedInfo, error) {
	if s.sources == nil {
		return nil, fmt.Errorf("challenge source storage not configured")
	}
	dir, err := s.sources.ChallengeDir(chal.ID)
	if err != nil {
		return nil, err
	}
	composeFile := filepath.Join(dir, chal.ComposeFile())
	if _, err := os.Stat(composeFile); err != nil {
		return nil, fmt.Errorf("compose file not found: %w", err)
	}
	project := fmt.Sprintf("ctfoj-%s", instanceID)
	if _, err := s.orch.ComposeUp(ctx, project, composeFile, env); err != nil {
		return nil, err
	}
	resolved, err := s.orch.ComposePort(ctx, project, composeServiceName(chal), chal.InternalPort)
	if err != nil {
		s.cleanupCompose(ctx, project, composeFile)
		return nil, fmt.Errorf("resolve compose port: %w", err)
	}
	if resolved != hostPort {
		// Update env-published port should match; if not, log but proceed with the resolved port.
		hostPort = resolved
	}
	return &startedInfo{ComposeProject: project, Image: chal.Image, HostPort: hostPort}, nil
}

// composeServiceName returns the service name used by compose challenges.
// All compose challenges must include a service named "app".
func composeServiceName(chal *domain.Challenge) string {
	if bc := strings.TrimSpace(chal.BuildContext); bc != "" {
		return bc
	}
	return "app"
}

// probeReady briefly waits for the container's published port to accept TCP
// connections. Errors are non-fatal: we don't want a slow image startup to
// block the API response indefinitely.
func (s *InstanceService) probeReady(ctx context.Context, port int) {
	if s.orch == nil {
		return
	}
	addr := fmt.Sprintf("127.0.0.1:%d", port)
	for i := 0; i < readinessProbeAttempts; i++ {
		select {
		case <-ctx.Done():
			return
		default:
		}
		conn, err := net.DialTimeout("tcp", addr, readinessProbeInterval)
		if err == nil {
			_ = conn.Close()
			return
		}
		time.Sleep(readinessProbeInterval)
	}
}

// Restart tears down the existing instance for a user/challenge and starts a
// fresh one with a brand new dynamic flag.
func (s *InstanceService) Restart(ctx context.Context, userID, challengeID uint) (*StartInstanceResult, error) {
	if existing, _ := s.repos.FindActiveByUserAndChallenge(ctx, userID, challengeID); existing != nil {
		if err := s.terminate(ctx, existing); err != nil {
			return nil, err
		}
	}
	return s.Start(ctx, userID, challengeID)
}

// Logs returns the most recent container stdout/stderr for an admin or owner.
// For a live instance the logs are streamed from the underlying container;
// for a terminated instance the snapshot captured at teardown time is returned.
// The snapshot may be empty if termination failed to capture logs.
func (s *InstanceService) Logs(ctx context.Context, requesterID uint, isAdmin bool, instanceID uint) (string, error) {
	inst, err := s.repos.FindByID(ctx, instanceID)
	if err != nil {
		return "", err
	}
	if !isAdmin && inst.UserID != requesterID {
		return "", domain.ErrForbidden
	}
	// Terminated instances: serve the captured snapshot. No docker call.
	if inst.Status != domain.InstanceRunning {
		return inst.LogsSnapshot, nil
	}
	// Live instance: prefer fresh logs, fall back to existing snapshot.
	if s.orch != nil {
		if inst.ComposeProject != "" {
			if out, err := s.orch.ComposeLogs(ctx, inst.ComposeProject, adminLogsTailLines); err == nil {
				return out, nil
			}
		} else if inst.ContainerID != "" {
			if out, err := s.orch.Logs(ctx, inst.ContainerID, adminLogsTailLines); err == nil {
				return out, nil
			}
		}
	}
	return inst.LogsSnapshot, nil
}

func (s *InstanceService) GetActive(ctx context.Context, userID, challengeID uint) (*domain.Instance, error) {
	inst, err := s.repos.FindActiveByUserAndChallenge(ctx, userID, challengeID)
	if err != nil && errors.Is(err, domain.ErrNotFound) {
		if teamID := s.teamIDFor(ctx, userID); teamID > 0 {
			inst, err = s.repos.FindActiveByTeamAndChallenge(ctx, teamID, challengeID)
		}
	}
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, ErrInstanceNotFound
		}
		return nil, err
	}
	if !inst.IsAlive() {
		return nil, ErrInstanceNotRunning
	}
	if chal, err := s.chals.FindByID(ctx, inst.ChallengeID); err == nil {
		inst.Connection = renderConnection(inst, chal.ConnectionInfo)
	}
	return inst, nil
}

func (s *InstanceService) Extend(ctx context.Context, userID, instanceID uint, ttl time.Duration) (*domain.Instance, error) {
	inst, err := s.repos.FindByID(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	if !s.canAccess(ctx, userID, inst) {
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
	if chal, err := s.chals.FindByID(ctx, inst.ChallengeID); err == nil {
		inst.Connection = renderConnection(inst, chal.ConnectionInfo)
	}
	return inst, nil
}

func (s *InstanceService) Stop(ctx context.Context, userID, instanceID uint) error {
	inst, err := s.repos.FindByID(ctx, instanceID)
	if err != nil {
		return err
	}
	if !s.canAccess(ctx, userID, inst) {
		return domain.ErrForbidden
	}
	return s.terminate(ctx, inst)
}

func (s *InstanceService) ListMine(ctx context.Context, userID uint) ([]*domain.Instance, error) {
	list, err := s.repos.ListByUserOrTeam(ctx, userID, s.teamIDFor(ctx, userID))
	if err != nil {
		return nil, err
	}
	for _, inst := range list {
		var tmpl string
		if inst.Challenge != nil {
			tmpl = inst.Challenge.ConnectionInfo
		}
		inst.Connection = renderConnection(inst, tmpl)
	}
	return list, nil
}

// AdminList returns all instances (any user), with optional filters.
func (s *InstanceService) AdminList(ctx context.Context, page, pageSize int, filter domain.InstanceListFilter) ([]*domain.Instance, int64, error) {
	return s.repos.ListAll(ctx, page, pageSize, filter)
}

// AdminStop allows an administrator to force-stop any instance.
func (s *InstanceService) AdminStop(ctx context.Context, id uint) error {
	inst, err := s.repos.FindByID(ctx, id)
	if err != nil {
		return err
	}
	return s.terminate(ctx, inst)
}

func (s *InstanceService) CleanupExpired(ctx context.Context) (int, error) {
	expired, err := s.repos.ListExpired(ctx, time.Now())
	if err != nil {
		return 0, err
	}
	stopped := 0
	for _, inst := range expired {
		if err := s.terminateAs(ctx, inst, domain.InstanceExpired); err == nil {
			stopped++
		}
	}
	return stopped, nil
}

func (s *InstanceService) terminate(ctx context.Context, inst *domain.Instance) error {
	return s.terminateAs(ctx, inst, domain.InstanceStopped)
}

// terminateAs tears down the underlying container/compose project and marks
// the instance with the supplied status. Used to distinguish user-initiated
// stops, TTL expiry and auto-expire after a successful submit.
//
// Before destroying the container we capture its tail logs so admins can
// review the instance after the fact (containers are removed on stop).
func (s *InstanceService) terminateAs(ctx context.Context, inst *domain.Instance, status domain.InstanceStatus) error {
	if inst.Status == domain.InstanceRunning {
		inst.LogsSnapshot = s.captureLogs(ctx, inst)
	}
	s.cleanupContainer(ctx, inst)
	if inst.Status == domain.InstanceRunning {
		now := time.Now()
		inst.StoppedAt = &now
		inst.Status = status
		if status == domain.InstanceStopped && time.Now().After(inst.ExpiresAt) {
			inst.Status = domain.InstanceExpired
		}
	}
	return s.repos.Update(ctx, inst)
}

// captureLogs returns a best-effort tail of the container's stdout/stderr.
// Errors are swallowed because capture is best-effort — we'd rather lose the
// log than fail to release the container.
func (s *InstanceService) captureLogs(ctx context.Context, inst *domain.Instance) string {
	if s.orch == nil {
		return ""
	}
	if inst.ComposeProject != "" {
		out, err := s.orch.ComposeLogs(ctx, inst.ComposeProject, adminLogsTailLines)
		if err == nil {
			return out
		}
		return ""
	}
	if inst.ContainerID == "" {
		return ""
	}
	out, err := s.orch.Logs(ctx, inst.ContainerID, adminLogsTailLines)
	if err != nil {
		return ""
	}
	return out
}

// StopByChallenge tears down the caller's active instance for a challenge and
// marks it as auto_expired. Invoked after a successful flag submission so the
// platform releases container resources immediately.
func (s *InstanceService) StopByChallenge(ctx context.Context, userID, challengeID uint) error {
	inst, err := s.repos.FindActiveByUserAndChallenge(ctx, userID, challengeID)
	if err != nil && errors.Is(err, domain.ErrNotFound) {
		if teamID := s.teamIDFor(ctx, userID); teamID > 0 {
			inst, err = s.repos.FindActiveByTeamAndChallenge(ctx, teamID, challengeID)
		}
	}
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil
		}
		return err
	}
	if inst == nil {
		return nil
	}
	return s.terminateAs(ctx, inst, domain.InstanceAutoExpired)
}

// cleanupContainer tears down the underlying container/compose project.
// Errors are swallowed because terminate is best-effort.
func (s *InstanceService) cleanupContainer(ctx context.Context, inst *domain.Instance) {
	if s.orch == nil {
		return
	}
	if inst.ComposeProject != "" {
		dir, _ := s.sources.ChallengeDir(inst.ChallengeID)
		composeFile := ""
		if dir != "" {
			composeFile = filepath.Join(dir, inst.Challenge.ComposeFile())
		}
		_ = s.orch.ComposeStop(ctx, inst.ComposeProject, composeFile)
		return
	}
	if inst.ContainerID != "" {
		_ = s.orch.Stop(ctx, inst.ContainerID)
	}
}

func (s *InstanceService) cleanupCompose(ctx context.Context, project, composeFile string) {
	if s.orch == nil {
		return
	}
	_ = s.orch.ComposeStop(ctx, project, composeFile)
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

func renderConnection(inst *domain.Instance, template string) string {
	if t := strings.TrimSpace(template); t != "" {
		t = strings.ReplaceAll(t, "${host}", inst.Host)
		return strings.ReplaceAll(t, "${port}", strconv.Itoa(inst.Port))
	}
	return fmt.Sprintf("%s:%d", inst.Host, inst.Port)
}

func (s *InstanceService) buildResult(inst *domain.Instance, template string) *StartInstanceResult {
	conn := renderConnection(inst, template)
	inst.Connection = conn
	return &StartInstanceResult{
		Instance:    inst,
		Connection:  conn,
		DynamicFlag: inst.DynamicFlag,
	}
}

func (s *InstanceService) generateFlag() string {
	prefix := strings.TrimSpace(s.cfg.FlagPrefix)
	if prefix == "" {
		prefix = "flag"
	}
	return fmt.Sprintf("%s{%s}", prefix, uuid.NewString())
}

// osStat is a small wrapper for testability; we only need the existence check.
func shortTag() string {
	return uuid.NewString()[:8]
}
