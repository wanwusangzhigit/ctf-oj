// Package docker provides a minimal orchestrator that wraps the docker CLI.
// Avoiding the SDK keeps dependencies slim and avoids version drift.
package docker

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net"
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
	Image          string
	InternalPort   int
	HostPort       int
	Env            map[string]string
	MemoryLimitMB  int
	CPULimit       int
	NetworkName    string
	InstanceID     string
}

type StartedContainer struct {
	ContainerID string
	HostPort    int
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

func AllocateHostPort(ctx context.Context, min, max int, inUse func(port int) bool) (int, error) {
	if min <= 0 || max <= min {
		return 0, ErrNoFreePort
	}
	rng := struct {
		v int
	}{v: int(time.Now().UnixNano())}
	for attempt := 0; attempt < 80; attempt++ {
		rng.v = rng.v*1664525 + 1013904223
		port := min + (rng.v%1_000_000)%((max-min+1)) + min
		port = min + (rng.v & 0x7fffffff)%(max-min+1)
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
