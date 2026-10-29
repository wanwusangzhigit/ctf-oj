// Package docker provides a minimal orchestrator that wraps the docker CLI.
// Avoiding the SDK keeps dependencies slim and avoids version drift.
package docker

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

var (
	ErrNoFreePort    = errors.New("no free port in range")
	ErrContainerGone = errors.New("container not found")
	ErrDockerMissing = errors.New("docker binary not found")
)

type StartInput struct {
	Image         string
	InternalPort  int
	HostPort      int
	Env           map[string]string
	MemoryLimitMB int
	CPULimit      int
	PidsLimit     int
	NetworkName   string
	InstanceID    string
}

type StartedContainer struct {
	ContainerID string
	HostPort    int
}

// BuildResult represents the outcome of `docker build`.
type BuildResult struct {
	Image string
}

// ComposeUpResult represents the outcome of `docker compose up`.
type ComposeUpResult struct {
	ProjectName string
}

type Orchestrator struct {
	bin string
}

func New() (*Orchestrator, error) {
	path, err := exec.LookPath("docker")
	if err != nil {
		return nil, ErrDockerMissing
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if out, err := exec.CommandContext(ctx, path, "version", "--format", "{{.Server.Version}}").CombinedOutput(); err != nil {
		return nil, fmt.Errorf("docker daemon check: %w (%s)", err, strings.TrimSpace(string(out)))
	}
	return &Orchestrator{bin: path}, nil
}

func (o *Orchestrator) EnsureImage(ctx context.Context, image string) error {
	if image == "" {
		return errors.New("empty image")
	}
	out, err := exec.CommandContext(ctx, o.bin, "image", "inspect", image).CombinedOutput()
	if err == nil {
		return nil
	}
	if !strings.Contains(string(out), "No such image") && !strings.Contains(string(out), "no such image") {
		// fallthrough to pull attempt
	}
	pull := exec.CommandContext(ctx, o.bin, "pull", image)
	pull.Stdout = nil
	pull.Stderr = nil
	return pull.Run()
}

func (o *Orchestrator) Start(ctx context.Context, in StartInput) (*StartedContainer, error) {
	if err := o.EnsureImage(ctx, in.Image); err != nil {
		return nil, fmt.Errorf("ensure image: %w", err)
	}

	name := fmt.Sprintf("ctfoj-%s", in.InstanceID)
	args := []string{
		"run", "-d",
		"--name", name,
		"--label", "managed-by=ctf-oj-backend",
		"--label", "instance-id=" + in.InstanceID,
		"--restart", "no",
	}
	for k, v := range in.Env {
		args = append(args, "-e", k+"="+v)
	}
	args = append(args, "-p", fmt.Sprintf("0.0.0.0:%d:%d", in.HostPort, in.InternalPort))
	if in.MemoryLimitMB > 0 {
		args = append(args, "--memory", fmt.Sprintf("%dm", in.MemoryLimitMB))
	}
	if in.CPULimit > 0 {
		args = append(args, "--cpus", strconv.Itoa(in.CPULimit))
	}
	if in.PidsLimit > 0 {
		args = append(args, "--pids-limit", strconv.Itoa(in.PidsLimit))
	}
	if in.NetworkName != "" {
		args = append(args, "--network", in.NetworkName)
	}
	args = append(args, in.Image)

	cmd := exec.CommandContext(ctx, o.bin, args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("docker run: %w (%s)", err, stderr.String())
	}
	containerID := strings.TrimSpace(string(out))
	return &StartedContainer{ContainerID: containerID, HostPort: in.HostPort}, nil
}

func (o *Orchestrator) Stop(ctx context.Context, containerIDOrName string) error {
	if containerIDOrName == "" {
		return nil
	}
	_ = exec.CommandContext(ctx, o.bin, "stop", "-t", "10", containerIDOrName).Run()
	return exec.CommandContext(ctx, o.bin, "rm", "-f", containerIDOrName).Run()
}

func (o *Orchestrator) IsRunning(ctx context.Context, containerIDOrName string) (bool, error) {
	if containerIDOrName == "" {
		return false, nil
	}
	out, err := exec.CommandContext(ctx, o.bin, "inspect",
		"--format", "{{.State.Running}}",
		"--type", "container",
		containerIDOrName,
	).CombinedOutput()
	if err != nil {
		s := string(out)
		if strings.Contains(s, "No such") || strings.Contains(s, "not found") {
			return false, ErrContainerGone
		}
		return false, fmt.Errorf("docker inspect: %w (%s)", err, s)
	}
	return strings.TrimSpace(string(out)) == "true", nil
}

// Logs returns the most recent container stdout/stderr output.
func (o *Orchestrator) Logs(ctx context.Context, containerIDOrName, tailLines string) (string, error) {
	if containerIDOrName == "" {
		return "", ErrContainerGone
	}
	if tailLines == "" {
		tailLines = "200"
	}
	out, err := exec.CommandContext(ctx, o.bin,
		"logs", "--tail", tailLines, "--timestamps", containerIDOrName,
	).CombinedOutput()
	if err != nil {
		s := strings.TrimSpace(string(out))
		if strings.Contains(s, "No such") || strings.Contains(s, "not found") {
			return "", ErrContainerGone
		}
		return "", fmt.Errorf("docker logs: %w (%s)", err, s)
	}
	return string(out), nil
}

// Build runs `docker build -t <tag> <contextDir>`. The caller owns the
// contextDir and is responsible for cleaning it up after Start().
func (o *Orchestrator) Build(ctx context.Context, tag, contextDir string) (*BuildResult, error) {
	if tag == "" {
		return nil, errors.New("image tag required")
	}
	if contextDir == "" {
		return nil, errors.New("build context required")
	}
	args := []string{"build", "-t", tag, contextDir}
	cmd := exec.CommandContext(ctx, o.bin, args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	cmd.Stdout = nil
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("docker build: %w (%s)", err, stderr.String())
	}
	return &BuildResult{Image: tag}, nil
}

// ComposeUp runs `docker compose -p <project> -f <file> up -d` with the
// provided environment variables injected into the compose process. The
// compose file must reference ${PUBLISHED_PORT} and ${FLAG} when applicable.
func (o *Orchestrator) ComposeUp(ctx context.Context, project, composeFile string, env map[string]string) (*ComposeUpResult, error) {
	if project == "" || composeFile == "" {
		return nil, errors.New("project and compose file required")
	}
	cmd := exec.CommandContext(ctx, o.bin, "compose",
		"-p", project,
		"-f", composeFile,
		"up", "-d", "--renew-anon-volumes",
	)
	cmd.Env = os.Environ()
	for k, v := range env {
		cmd.Env = append(cmd.Env, fmt.Sprintf("%s=%s", k, v))
	}
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("docker compose up: %w (%s)", err, stderr.String())
	}
	return &ComposeUpResult{ProjectName: project}, nil
}

// ComposePort returns the host port published for the given service/container
// port by inspecting the running compose project. Returns 0 if no mapping.
func (o *Orchestrator) ComposePort(ctx context.Context, project, service string, internalPort int) (int, error) {
	out, err := exec.CommandContext(ctx, o.bin, "compose",
		"-p", project, "port", "--protocol", "tcp", service, fmt.Sprintf("%d", internalPort),
	).CombinedOutput()
	if err != nil {
		return 0, fmt.Errorf("compose port: %w (%s)", err, strings.TrimSpace(string(out)))
	}
	// Output looks like "0.0.0.0:32768" or ":::32768"
	s := strings.TrimSpace(string(out))
	idx := strings.LastIndex(s, ":")
	if idx < 0 {
		return 0, errors.New("unexpected port output: " + s)
	}
	var port int
	_, err = fmt.Sscanf(s[idx+1:], "%d", &port)
	if err != nil || port <= 0 {
		return 0, fmt.Errorf("parse port: %w (%s)", err, s)
	}
	return port, nil
}

// ComposeStop tears down a compose project (down --volumes --remove-orphans).
func (o *Orchestrator) ComposeStop(ctx context.Context, project, composeFile string) error {
	if project == "" {
		return nil
	}
	args := []string{"compose", "-p", project, "down", "--volumes", "--remove-orphans"}
	if composeFile != "" {
		args = append([]string{"compose", "-p", project, "-f", composeFile}, "down", "--volumes", "--remove-orphans")
	}
	cmd := exec.CommandContext(ctx, o.bin, args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("docker compose down: %w (%s)", err, stderr.String())
	}
	return nil
}

// ComposeLogs returns merged logs of all services in the project.
func (o *Orchestrator) ComposeLogs(ctx context.Context, project, tailLines string) (string, error) {
	if project == "" {
		return "", ErrContainerGone
	}
	if tailLines == "" {
		tailLines = "200"
	}
	out, err := exec.CommandContext(ctx, o.bin, "compose",
		"-p", project,
		"logs", "--tail", tailLines, "--timestamps",
	).CombinedOutput()
	if err != nil {
		s := strings.TrimSpace(string(out))
		if strings.Contains(s, "no such") || strings.Contains(s, "not found") {
			return "", ErrContainerGone
		}
		return "", fmt.Errorf("compose logs: %w (%s)", err, s)
	}
	return string(out), nil
}

func AllocateHostPort(ctx context.Context, min, max int, inUse func(port int) bool) (int, error) {
	if min <= 0 || max <= min {
		return 0, ErrNoFreePort
	}
	rng := struct {
		v int
	}{v: int(time.Now().UnixNano())}
	for attempt := 0; attempt < 80; attempt++ {
		rng.v = rng.v*1664525 + 1013904223
		port := min + (rng.v%1_000_000)%(max-min+1) + min
		port = min + (rng.v&0x7fffffff)%(max-min+1)
		if port < min || port > max {
			continue
		}
		select {
		case <-ctx.Done():
			return 0, ctx.Err()
		default:
		}
		if inUse != nil && inUse(port) {
			continue
		}
		if !isPortFree(port) {
			continue
		}
		return port, nil
	}
	return 0, ErrNoFreePort
}

func isPortFree(port int) bool {
	addr := net.JoinHostPort("0.0.0.0", strconv.Itoa(port))
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return false
	}
	_ = ln.Close()
	return true
}

// ContainerSummary is a compact view of a managed container.
type ContainerSummary struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Image     string `json:"image"`
	State     string `json:"state"`
	Status    string `json:"status"`
	Ports     string `json:"ports"`
	CreatedAt string `json:"createdAt"`
}

func (o *Orchestrator) Version(ctx context.Context) (string, error) {
	out, err := exec.CommandContext(ctx, o.bin, "version", "--format", "{{.Server.Version}}").CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("docker version: %w (%s)", err, strings.TrimSpace(string(out)))
	}
	return strings.TrimSpace(string(out)), nil
}

func (o *Orchestrator) ListManaged(ctx context.Context) ([]ContainerSummary, error) {
	out, err := exec.CommandContext(ctx, o.bin, "ps", "-a",
		"--filter", "label=managed-by=ctf-oj-backend",
		"--format", "{{json .}}").Output()
	if err != nil {
		return nil, fmt.Errorf("docker ps: %w", err)
	}
	var list []ContainerSummary
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		var row struct {
			ID        string `json:"ID"`
			Names     string `json:"Names"`
			Image     string `json:"Image"`
			State     string `json:"State"`
			Status    string `json:"Status"`
			Ports     string `json:"Ports"`
			CreatedAt string `json:"CreatedAt"`
		}
		if err := json.Unmarshal([]byte(line), &row); err != nil {
			continue
		}
		list = append(list, ContainerSummary{
			ID:        row.ID,
			Name:      row.Names,
			Image:     row.Image,
			State:     row.State,
			Status:    row.Status,
			Ports:     row.Ports,
			CreatedAt: row.CreatedAt,
		})
	}
	return list, nil
}

func (o *Orchestrator) PruneManaged(ctx context.Context) (string, error) {
	out, err := exec.CommandContext(ctx, o.bin, "container", "prune", "-f",
		"--filter", "label=managed-by=ctf-oj-backend").CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("docker prune: %w (%s)", err, strings.TrimSpace(string(out)))
	}
	return strings.TrimSpace(string(out)), nil
}
