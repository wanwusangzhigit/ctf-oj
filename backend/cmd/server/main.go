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
	"github.com/ctf-oj/backend/internal/infrastructure/mailer"
	"github.com/ctf-oj/backend/internal/infrastructure/metrics"
	"github.com/ctf-oj/backend/internal/infrastructure/realtime"
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
	challengeSources, err := storage.NewChallengeSources(cfg.Challenge.SourceDir)
	if err != nil {
		log.Fatal("init challenge sources", zap.Error(err))
	}

	dockerOrch, err := dockerinfra.New()
	if err != nil {
		log.Warn("docker orchestrator disabled", zap.Error(err))
	}

	hub := realtime.NewHub(log)
	go hub.Run()

	// repositories
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
	writeupRepo := repository.NewWriteupRepository(gormDB)
	teamRepo := repository.NewTeamRepository(gormDB)
	settingRepo := repository.NewSettingRepository(gormDB)
	auditRepo := repository.NewAuditLogRepository(gormDB)
	evRepo := repository.NewEmailVerificationRepository(gormDB)
	prRepo := repository.NewPasswordResetRepository(gormDB)
	hintRepo := repository.NewHintRepository(gormDB)
	compRepo := repository.NewCompetitionRepository(gormDB)
	compSolveRepo := repository.NewCompetitionSolveRepository(gormDB)
	compRegRepo := repository.NewCompetitionRegistrationRepo(gormDB)
	compAnnRepo := repository.NewCompetitionAnnouncementRepo(gormDB)
	accessRepo := repository.NewChallengeAccessRepository(gormDB)
	communityRepo := repository.NewCommunityAccessRepository(gormDB)
	communitySectionRepo := repository.NewCommunitySectionRepository(gormDB)

	// services
	jwtSvc := service.NewJWTService(cfg.JWT)
	settingSvc := service.NewSettingService(settingRepo)
	mailerInst := mailer.New(mailer.Config{
		Driver:   cfg.Mailer.Driver,
		From:     cfg.Mailer.From,
		SMTPHost: cfg.Mailer.SMTPHost,
		SMTPPort: cfg.Mailer.SMTPPort,
		SMTPUser: cfg.Mailer.SMTPUser,
		SMTPPass: cfg.Mailer.SMTPPass,
		SMTPFrom: cfg.Mailer.SMTPFrom,
		UseTLS:   cfg.Mailer.UseTLS,
	})
	authSvc := service.NewAuthService(userRepo, evRepo, prRepo, settingSvc, jwtSvc, cfg, mailerInst, cfg.PublicURL)
	auditSvc := service.NewAuditService(auditRepo)
	catSvc := service.NewCategoryService(catRepo)
	followRepo := repository.NewFollowRepository(gormDB)
	userSvc := service.NewUserService(userRepo, solveRepo, subRepo, storageBackend, followRepo)
	attSvc := service.NewAttachmentService(attRepo, chalRepo, storageBackend)
	instSvc := service.NewInstanceService(dockerOrch, instRepo, chalRepo, challengeSources, cfg.Instance)
	instSvc.SetTeamRepository(teamRepo)
	accessSvc := service.NewChallengeAccessService(accessRepo, chalRepo, compRepo, userRepo, teamRepo)
	notifSvc := service.NewNotificationService(notifRepo)
	notifSvc.SetPublisher(&service.HubPublisher{Hub: hub})
	publisher := &service.HubPublisher{Hub: hub}
	hintSvc := service.NewHintService(hintRepo, chalRepo)
	hintSvc.SetAccessService(accessSvc)
	chalSvc := service.NewChallengeService(chalRepo, catRepo, flagRepo, attRepo, subRepo, solveRepo, userRepo, instSvc, notifSvc, publisher, challengeSources, hintSvc)
	chalSvc.SetAccessService(accessSvc)
	chalSvc.SetCompetitionRepositories(compRepo, compSolveRepo)
	chalSvc.SetCompetitionRegistrationRepository(compRegRepo)
	attSvc.SetAccessService(accessSvc)
	instSvc.SetAccessService(accessSvc)
	annSvc := service.NewAnnouncementService(annRepo)
	communitySvc := service.NewCommunityAccessService(communityRepo, userRepo, teamRepo, settingSvc)
	sectionSvc := service.NewCommunitySectionService(communitySectionRepo, communityRepo, communitySvc)
	discSvc := service.NewDiscussionService(discRepo, likeRepo, chalRepo, notifSvc)
	discSvc.SetAccessService(accessSvc)
	discSvc.SetTeamRepository(teamRepo)
	discSvc.SetCommunityAccessService(communitySvc)
	discSvc.SetCommunitySectionService(sectionSvc)
	sectionSvc.SetDiscussionRepository(discRepo)
	discSvc.SetCompetitionRepository(compRepo)
	discSvc.SetRegistrationRepository(compRegRepo)
	writeupSvc := service.NewWriteupService(writeupRepo, chalRepo, solveRepo)
	writeupSvc.SetAccessService(accessSvc)
	writeupSvc.SetCompetitionRepository(compRepo)
	broadcastSvc := service.NewBroadcastService(gormDB, mailerInst)
	searchRepo := repository.NewSearchRepository(gormDB)
	searchSvc := service.NewSearchService(searchRepo)
	teamSvc := service.NewTeamService(teamRepo, userRepo)
	statsSvc := service.NewStatsService(gormDB)
	exportSvc := service.NewExportService(chalRepo, catRepo, flagRepo, attRepo, storageBackend)
	compSvc := service.NewCompetitionService(compRepo, settingSvc)
	compSvc.SetAccessService(accessSvc)
	compSvc.SetRegistrationRepository(compRegRepo)
	compSvc.SetAnnouncementRepository(compAnnRepo)
	serverSvc := service.NewServerService(gormDB, rdb, dockerOrch)

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
		Team:         teamSvc,
		Stats:        statsSvc,
		Export:       exportSvc,
		Hub:          hub,
		UserRepo:     userRepo,

		Settings:      settingSvc,
		Audit:         auditSvc,
		Hints:         hintSvc,
		Competition:   compSvc,
		Writeup:       writeupSvc,
		Broadcast:     broadcastSvc,
		Search:        searchSvc,
		Server:        serverSvc,
		Access:        accessSvc,
		Community:     communitySvc,
		Sections:      sectionSvc,
		AvatarStorage: storageBackend,
		Metrics:       metrics.Handler,
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
