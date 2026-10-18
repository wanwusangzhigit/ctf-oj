package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/ctf-oj/backend/internal/api/v1"
	"github.com/ctf-oj/backend/internal/config"
	"github.com/ctf-oj/backend/internal/infrastructure/cache"
	"github.com/ctf-oj/backend/internal/infrastructure/db"
	dockerinfra "github.com/ctf-oj/backend/internal/infrastructure/docker"
	"github.com/ctf-oj/backend/internal/infrastructure/logger"
	"github.com/ctf-oj/backend/internal/infrastructure/storage"
	"github.com/ctf-oj/backend/internal/repository"
	"github.com/ctf-oj/backend/internal/service"
)

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
	rdb, err := cache.NewRedis(cfg.Redis)
	if err != nil {
		log.Fatal("connect redis", zap.Error(err))
	}

	storageBackend, err := storage.New(cfg.Storage)
	if err != nil {
		log.Fatal("init storage", zap.Error(err))
	}

	dockerOrch, err := dockerinfra.New()
	if err != nil {
		log.Warn("docker orchestrator disabled", zap.Error(err))
	}

	userRepo := repository.NewUserRepository(gormDB)
	catRepo := repository.NewCategoryRepository(gormDB)
	chalRepo := repository.NewChallengeRepository(gormDB)
	flagRepo := repository.NewFlagRepository(gormDB)
	attRepo := repository.NewAttachmentRepository(gormDB)
	subRepo := repository.NewSubmissionRepository(gormDB)
	solveRepo := repository.NewSolveRepository(gormDB)
	instRepo := repository.NewInstanceRepository(gormDB)
	annRepo := repository.NewAnnouncementRepository(gormDB)
	discRepo := repository.NewDiscussionRepository(gormDB)
	likeRepo := repository.NewDiscussionLikeRepository(gormDB)
	notifRepo := repository.NewNotificationRepository(gormDB)

	jwtSvc := service.NewJWTService(cfg.JWT)
	authSvc := service.NewAuthService(userRepo, jwtSvc, cfg)
	catSvc := service.NewCategoryService(catRepo)
	userSvc := service.NewUserService(userRepo, solveRepo)
	attSvc := service.NewAttachmentService(attRepo, chalRepo, storageBackend)
	instSvc := service.NewInstanceService(dockerOrch, instRepo, chalRepo, cfg.Instance)
	notifSvc := service.NewNotificationService(notifRepo)
	chalSvc := service.NewChallengeService(chalRepo, catRepo, flagRepo, attRepo, subRepo, solveRepo, userRepo, instSvc, notifSvc)
	annSvc := service.NewAnnouncementService(annRepo)
	discSvc := service.NewDiscussionService(discRepo, likeRepo, chalRepo, notifSvc)

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()

	v1.Register(r, &v1.Deps{
		Logger:       log,
		RDB:          rdb,
		JWT:          jwtSvc,
		Auth:         authSvc,
		User:         userSvc,
		Cat:          catSvc,
		Chal:         chalSvc,
		Att:          attSvc,
		Instance:     instSvc,
		Announcement: annSvc,
		Discussion:   discSvc,
		Notification: notifSvc,
	})

	srv := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Info("backend listening", zap.String("addr", cfg.HTTPAddr))
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal("listen", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Info("shutting down")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Error("shutdown error", zap.Error(err))
	}
}
