package service

import (
	"context"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
	dockerinfra "github.com/ctf-oj/backend/internal/infrastructure/docker"
)

type HostInfo struct {
	Hostname      string  `json:"hostname"`
	OS            string  `json:"os"`
	Arch          string  `json:"arch"`
	Kernel        string  `json:"kernel"`
	UptimeSeconds float64 `json:"uptimeSeconds"`
	Load1         float64 `json:"load1"`
	Load5         float64 `json:"load5"`
	Load15        float64 `json:"load15"`
	CPUs          int     `json:"cpus"`
	MemTotal      uint64  `json:"memTotal"`
	MemAvailable  uint64  `json:"memAvailable"`
	DiskTotal     uint64  `json:"diskTotal"`
	DiskFree      uint64  `json:"diskFree"`
}

type RuntimeInfo struct {
	GoVersion     string  `json:"goVersion"`
	Goroutines    int     `json:"goroutines"`
	HeapAlloc     uint64  `json:"heapAlloc"`
	Sys           uint64  `json:"sys"`
	NumGC         uint32  `json:"numGC"`
	UptimeSeconds float64 `json:"uptimeSeconds"`
}

type DependencyStatus struct {
	Name      string `json:"name"`
	Status    string `json:"status"`
	Detail    string `json:"detail"`
	LatencyMS int64  `json:"latencyMs"`
}

type ServerCounts struct {
	Users       int64 `json:"users"`
	Challenges  int64 `json:"challenges"`
	Submissions int64 `json:"submissions"`
	Instances   int64 `json:"instances"`
	Teams       int64 `json:"teams"`
}

type DockerInfo struct {
	Available         bool   `json:"available"`
	Version           string `json:"version"`
	Error             string `json:"error,omitempty"`
	ContainersRunning int    `json:"containersRunning"`
	ContainersTotal   int    `json:"containersTotal"`
}

type ServerOverview struct {
	Host         HostInfo                       `json:"host"`
	Runtime      RuntimeInfo                    `json:"runtime"`
	Dependencies []DependencyStatus             `json:"dependencies"`
	Counts       ServerCounts                   `json:"counts"`
	Docker       DockerInfo                     `json:"docker"`
	Containers   []dockerinfra.ContainerSummary `json:"containers"`
	GeneratedAt  time.Time                      `json:"generatedAt"`
}

type ServerService struct {
	db        *gorm.DB
	rdb       *redis.Client
	docker    *dockerinfra.Orchestrator
	startedAt time.Time
}

func NewServerService(db *gorm.DB, rdb *redis.Client, docker *dockerinfra.Orchestrator) *ServerService {
	return &ServerService{db: db, rdb: rdb, docker: docker, startedAt: time.Now()}
}

func (s *ServerService) Overview(ctx context.Context) *ServerOverview {
	host := s.hostInfo()
	rt := s.runtimeInfo()
	deps := []DependencyStatus{
		s.checkDB(ctx),
		s.checkRedis(ctx),
	}
	dockerInfo := DockerInfo{Available: s.docker != nil}
	var containers []dockerinfra.ContainerSummary
	if s.docker != nil {
		vctx, cancel := context.WithTimeout(ctx, 5*time.Second)
		version, err := s.docker.Version(vctx)
		cancel()
		if err != nil {
			dockerInfo.Error = err.Error()
		} else {
			dockerInfo.Version = version
		}
		cctx, cancel := context.WithTimeout(ctx, 5*time.Second)
		list, err := s.docker.ListManaged(cctx)
		cancel()
		if err != nil {
			if dockerInfo.Error == "" {
				dockerInfo.Error = err.Error()
			}
		} else {
			containers = list
			for _, c := range list {
				dockerInfo.ContainersTotal++
				if strings.EqualFold(c.State, "running") {
					dockerInfo.ContainersRunning++
				}
			}
		}
		deps = append(deps, DependencyStatus{
			Name:   "docker",
			Status: map[bool]string{true: "up", false: "down"}[dockerInfo.Error == ""],
			Detail: dockerInfo.Version,
		})
	}
	if containers == nil {
		containers = []dockerinfra.ContainerSummary{}
	}
	return &ServerOverview{
		Host:         host,
		Runtime:      rt,
		Dependencies: deps,
		Counts:       s.counts(ctx),
		Docker:       dockerInfo,
		Containers:   containers,
		GeneratedAt:  time.Now(),
	}
}

func (s *ServerService) PruneContainers(ctx context.Context) (string, error) {
	if s.docker == nil {
		return "", domain.ErrUnavailable
	}
	return s.docker.PruneManaged(ctx)
}

func (s *ServerService) hostInfo() HostInfo {
	hostname, _ := os.Hostname()
	h := HostInfo{
		Hostname: hostname,
		OS:       runtime.GOOS,
		Arch:     runtime.GOARCH,
		CPUs:     runtime.NumCPU(),
	}
	if out, err := exec.Command("uname", "-r").Output(); err == nil {
		h.Kernel = strings.TrimSpace(string(out))
	}
	if b, err := os.ReadFile("/proc/uptime"); err == nil {
		fields := strings.Fields(string(b))
		if len(fields) > 0 {
			h.UptimeSeconds, _ = strconv.ParseFloat(fields[0], 64)
		}
	}
	if b, err := os.ReadFile("/proc/loadavg"); err == nil {
		fields := strings.Fields(string(b))
		if len(fields) >= 3 {
			h.Load1, _ = strconv.ParseFloat(fields[0], 64)
			h.Load5, _ = strconv.ParseFloat(fields[1], 64)
			h.Load15, _ = strconv.ParseFloat(fields[2], 64)
		}
	}
	if b, err := os.ReadFile("/proc/meminfo"); err == nil {
		for _, line := range strings.Split(string(b), "\n") {
			fields := strings.Fields(line)
			if len(fields) < 2 {
				continue
			}
			v, _ := strconv.ParseUint(fields[1], 10, 64)
			switch fields[0] {
			case "MemTotal:":
				h.MemTotal = v * 1024
			case "MemAvailable:":
				h.MemAvailable = v * 1024
			}
		}
	}
	var stat syscall.Statfs_t
	if err := syscall.Statfs("/", &stat); err == nil {
		h.DiskTotal = stat.Blocks * uint64(stat.Bsize)
		h.DiskFree = stat.Bavail * uint64(stat.Bsize)
	}
	return h
}

func (s *ServerService) runtimeInfo() RuntimeInfo {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	return RuntimeInfo{
		GoVersion:     runtime.Version(),
		Goroutines:    runtime.NumGoroutine(),
		HeapAlloc:     m.HeapAlloc,
		Sys:           m.Sys,
		NumGC:         m.NumGC,
		UptimeSeconds: time.Since(s.startedAt).Seconds(),
	}
}

func (s *ServerService) checkDB(ctx context.Context) DependencyStatus {
	start := time.Now()
	d := DependencyStatus{Name: "postgres"}
	cctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	sqlDB, err := s.db.DB()
	if err == nil {
		err = sqlDB.PingContext(cctx)
	}
	d.LatencyMS = time.Since(start).Milliseconds()
	if err != nil {
		d.Status = "down"
		d.Detail = err.Error()
		return d
	}
	d.Status = "up"
	return d
}

func (s *ServerService) checkRedis(ctx context.Context) DependencyStatus {
	start := time.Now()
	d := DependencyStatus{Name: "redis"}
	cctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	err := s.rdb.Ping(cctx).Err()
	d.LatencyMS = time.Since(start).Milliseconds()
	if err != nil {
		d.Status = "down"
		d.Detail = err.Error()
		return d
	}
	d.Status = "up"
	return d
}

func (s *ServerService) counts(ctx context.Context) ServerCounts {
	var c ServerCounts
	s.db.WithContext(ctx).Model(&domain.User{}).Count(&c.Users)
	s.db.WithContext(ctx).Model(&domain.Challenge{}).Count(&c.Challenges)
	s.db.WithContext(ctx).Model(&domain.Submission{}).Count(&c.Submissions)
	s.db.WithContext(ctx).Model(&domain.Instance{}).Count(&c.Instances)
	s.db.WithContext(ctx).Model(&domain.Team{}).Count(&c.Teams)
	return c
}
