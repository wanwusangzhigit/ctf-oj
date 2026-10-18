package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.uber.org/zap"

	"github.com/ctf-oj/backend/internal/config"
	"github.com/ctf-oj/backend/internal/infrastructure/db"
	"github.com/ctf-oj/backend/internal/infrastructure/logger"
	"github.com/ctf-oj/backend/internal/repository"
	"github.com/ctf-oj/backend/internal/service"
)

// 容器实例的清理 worker。
//
// 周期性扫描数据库中的过期 running 实例，
// 调用编排器销毁对应的容器并标记为 expired。
//
// 配置：
//   WORKER_INTERVAL_SECONDS  扫描间隔（默认 30）
func main() {
	cfg, err := config.Load()
	if err != nil {
		panic(err)
	}
	log, err := logger.New(cfg.LogLevel)
	if err != nil {
		panic(err)
	}
	defer log.Sync()

	gormDB, err := db.NewPostgres(cfg.DB)
	if err != nil {
		log.Fatal("connect postgres", zap.Error(err))
	}

	instRepo := repository.NewInstanceRepository(gormDB)
	chalRepo := repository.NewChallengeRepository(gormDB)
	instSvc := service.NewInstanceService(nil, instRepo, chalRepo, cfg.Instance)

	interval := 30 * time.Second
	if v := os.Getenv("WORKER_INTERVAL_SECONDS"); v != "" {
		if d, err := time.ParseDuration(v + "s"); err == nil && d > 0 {
			interval = d
		}
	}
	if err := instSvc.SyncOrchestratorFromEnv(); err != nil {
		log.Warn("worker: docker orchestrator unavailable", zap.Error(err))
	}

	log.Info("instance worker started", zap.Duration("interval", interval))

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	runOnce := func() {
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()
		n, err := instSvc.CleanupExpired(ctx)
		if err != nil {
			log.Warn("cleanup error", zap.Error(err))
			return
		}
		if n > 0 {
			log.Info("expired instances cleaned", zap.Int("count", n))
		}
	}

	runOnce()
	for {
		select {
		case <-ticker.C:
			runOnce()
		case <-quit:
			log.Info("worker shutting down")
			return
		}
	}
}
