package v1

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"github.com/ctf-oj/backend/internal/api/middleware"
	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/infrastructure/realtime"
	"github.com/ctf-oj/backend/internal/service"
)

type Deps struct {
	Logger       *zap.Logger
	RDB          *redis.Client
	JWT          *service.JWTService
	Auth         *service.AuthService
	User         *service.UserService
	Cat          *service.CategoryService
	Chal         *service.ChallengeService
	Att          *service.AttachmentService
	Instance     *service.InstanceService
	Announcement *service.AnnouncementService
	Discussion   *service.DiscussionService
	Notification *service.NotificationService
	Team         *service.TeamService
	Stats        *service.StatsService
	Export       *service.ExportService
	Hub          *realtime.Hub
	UserRepo     domain.UserRepository

	// new services
	Settings      *service.SettingService
	Audit         *service.AuditService
	Hints         *service.HintService
	Competition   *service.CompetitionService
	Writeup       *service.WriteupService
	Broadcast     *service.BroadcastService
	Search        *service.SearchService
	Server        *service.ServerService
	Access        *service.ChallengeAccessService
	Community     *service.CommunityAccessService
	AvatarStorage domain.Storage
	Metrics       gin.HandlerFunc
}

func Register(r *gin.Engine, d *Deps) {
	r.Use(middleware.Recover(d.Logger))
	r.Use(middleware.Logger(d.Logger))
	r.Use(middleware.CORS())
	r.Use(middleware.RateLimit(d.RDB, 600))
	r.Use(middleware.CompetitionContext())
	if d.Settings != nil {
		r.Use(middleware.SettingGate(d.Settings))
	}

	r.GET("/health", Health)
	r.GET("/api/v1/health", Health)
	if d.Metrics != nil {
		r.GET("/metrics", d.Metrics)
	}

	Mount(r.Group("/api"), d)
}

func Mount(parent *gin.RouterGroup, d *Deps) {
	g := parent.Group("/v1")

	if d.Hub != nil {
		g.GET("/realtime", middleware.OptionalAuth(d.JWT), d.Hub.Handler)
	}

	authH := NewAuthHandler(d.Auth, d.Access)
	userH := NewUserHandler(d.User, d.Competition, d.Access)
	followH := NewFollowHandler(d.User)
	catH := NewCategoryHandler(d.Cat, d.Audit)
	chalH := NewChallengeHandler(d.Chal, d.Audit)
	attH := NewAttachmentHandler(d.Att, d.Audit)
	instH := NewInstanceHandler(d.Instance)
	annH := NewAnnouncementHandler(d.Announcement, d.Audit)
	discH := NewDiscussionHandler(d.Discussion)
	var communityH *CommunityHandler
	if d.Community != nil {
		communityH = NewCommunityHandler(d.Community, d.Audit)
	}
	writeupH := NewWriteupHandler(d.Writeup)
	broadcastH := NewBroadcastHandler(d.Broadcast, d.Audit)
	searchH := NewSearchHandler(d.Search)
	notifH := NewNotificationHandler(d.Notification)
	teamH := NewTeamHandler(d.Team, d.Competition)
	statsH := NewStatsHandler(d.Stats)
	exportH := NewExportHandler(d.Export)
	adminUserH := NewAdminUserHandler(d.UserRepo, d.User, d.Audit)
	adminInstH := NewAdminInstanceHandler(d.Instance, d.Audit)
	var accessH *AccessHandler
	if d.Access != nil {
		accessH = NewAccessHandler(d.Access, d.Audit)
	}
	var settingH *SettingHandler
	var auditH *AuditHandler
	var hintH *HintHandler
	var compH *CompetitionHandler
	if d.Settings != nil {
		settingH = NewSettingHandler(d.Settings, d.Audit)
	}
	if d.Audit != nil {
		auditH = NewAuditHandler(d.Audit)
	}
	if d.Hints != nil {
		hintH = NewHintHandler(d.Hints, d.Audit)
	}
	if d.Competition != nil {
		compH = NewCompetitionHandler(d.Competition, d.Audit)
	}

	// Reject banned users and refresh role/username from the database on every
	// authenticated endpoint. Mounted alongside Auth so the user id is already
	// in the gin context.
	loadUser := func(ctx context.Context, uid uint) (*domain.User, error) {
		if d.UserRepo == nil {
			return nil, domain.ErrUnauthorized
		}
		return d.UserRepo.FindByID(ctx, uid)
	}
	activeMw := middleware.RequireActive(loadUser)
	optionalActive := middleware.OptionalActive(loadUser)

	auth := g.Group("/auth")
	{
		auth.POST("/register", authH.Register)
		auth.POST("/login", authH.Login)
		auth.POST("/refresh", authH.Refresh)
		auth.POST("/logout", authH.Logout)
		auth.GET("/me", middleware.Auth(d.JWT), activeMw, authH.Me)
		auth.POST("/verify-email", authH.VerifyEmail)
		auth.GET("/verify-email", authH.VerifyEmail)
		auth.POST("/resend-verification", middleware.Auth(d.JWT), activeMw, authH.ResendVerification)
		auth.POST("/forgot-password", authH.ForgotPassword)
		auth.POST("/reset-password", authH.ResetPassword)
	}

	categories := g.Group("/categories")
	{
		categories.GET("", catH.List)
		categories.GET("/", catH.List)
		adminCat := categories.Group("")
		adminCat.Use(middleware.Auth(d.JWT), activeMw, middleware.RequirePermission(domain.PermCategoryManage))
		adminCat.POST("", catH.Create)
		adminCat.PUT("/:id", catH.Update)
		adminCat.DELETE("/:id", catH.Delete)
	}

	challenges := g.Group("/challenges")
	{
		challenges.GET("", middleware.OptionalAuth(d.JWT), optionalActive, chalH.List)
		challenges.GET("/", middleware.OptionalAuth(d.JWT), optionalActive, chalH.List)
		challenges.GET("/:id", middleware.OptionalAuth(d.JWT), optionalActive, chalH.Get)
		challenges.POST("/:id/submit", middleware.Auth(d.JWT), activeMw, chalH.Submit)
		challenges.GET("/:id/podium", middleware.OptionalAuth(d.JWT), optionalActive, statsH.Podium)
		challenges.GET("/:id/writeups", middleware.OptionalAuth(d.JWT), optionalActive, writeupH.List)
		challenges.POST("/:id/writeups", middleware.Auth(d.JWT), activeMw, writeupH.Create)
		challenges.GET("/:id/attachments", middleware.OptionalAuth(d.JWT), optionalActive, attH.List)
		challenges.GET("/:id/attachments/:attachmentId/download", middleware.OptionalAuth(d.JWT), optionalActive, attH.Download)

		instanceGroup := challenges.Group("/:id/instance")
		instanceGroup.Use(middleware.Auth(d.JWT), activeMw)
		{
			instanceGroup.POST("", instH.Start)
			instanceGroup.POST("/restart", instH.Restart)
			instanceGroup.GET("", instH.GetActive)
			instanceGroup.POST("/:instanceId/extend", instH.Extend)
			instanceGroup.DELETE("/:instanceId", instH.Stop)
		}

		// Hints — public read & unlock for authenticated users.
		if hintH != nil {
			challenges.GET("/:id/hints", middleware.OptionalAuth(d.JWT), optionalActive, hintH.PublicList)
			challenges.POST("/:id/hints/:hintId/unlock", middleware.Auth(d.JWT), activeMw, hintH.Unlock)
		}

		discussionsGroup := challenges.Group("/:id/discussions")
		discussionsGroup.GET("", middleware.OptionalAuth(d.JWT), optionalActive, discH.List)
		discussionsGroup.POST("", middleware.Auth(d.JWT), activeMw, discH.Create)

		adminCh := challenges.Group("")
		adminCh.Use(middleware.Auth(d.JWT), activeMw)
		adminCh.POST("", middleware.RequirePermission(domain.PermChallengeManage), chalH.Create)
		adminCh.PUT("/:id", middleware.RequireChallengeManage(d.Access), chalH.Update)
		adminCh.DELETE("/:id", middleware.RequirePermission(domain.PermChallengeManage), chalH.Delete)
		adminCh.POST("/:id/attachments", middleware.RequireChallengeManage(d.Access), attH.Upload)
		adminCh.DELETE("/:id/attachments/:attachmentId", middleware.RequireChallengeManage(d.Access), attH.Delete)
		adminCh.GET("/:id/sources", middleware.RequireChallengeManage(d.Access), chalH.ListSources)
		adminCh.POST("/:id/sources", middleware.RequireChallengeManage(d.Access), chalH.UploadSource)
		adminCh.GET("/:id/sources/*path", middleware.RequireChallengeManage(d.Access), chalH.DownloadSource)
		adminCh.DELETE("/:id/sources/*path", middleware.RequireChallengeManage(d.Access), chalH.DeleteSource)
		if accessH != nil {
			adminCh.GET("/:id/access", middleware.RequirePermission(domain.PermChallengeManage), accessH.ListGrants)
			adminCh.PUT("/:id/access", middleware.RequirePermission(domain.PermChallengeManage), accessH.SetGrants)
		}
	}

	if communityH != nil {
		community := g.Group("/community")
		community.GET("", middleware.OptionalAuth(d.JWT), optionalActive, communityH.Meta)
		community.GET("/discussions", middleware.OptionalAuth(d.JWT), optionalActive, discH.CommunityList)
		community.GET("/discussions/:id", middleware.OptionalAuth(d.JWT), optionalActive, discH.CommunityGet)
		community.POST("/discussions", middleware.Auth(d.JWT), activeMw, discH.CommunityCreate)
		community.PATCH("/discussions/:id", middleware.Auth(d.JWT), activeMw, discH.CommunityModerate)
	}

	// Hint admin CRUD — separate from /challenges so we don't collide with
	// the user-facing /challenges/:id/hints GET endpoint.
	if hintH != nil {
		adminHintGroup := g.Group("/admin/challenges")
		adminHintGroup.Use(middleware.Auth(d.JWT), activeMw)
		adminHintGroup.GET("/:id/hints", middleware.RequireChallengeManage(d.Access), hintH.AdminList)
		adminHintGroup.POST("/:id/hints", middleware.RequireChallengeManage(d.Access), hintH.AdminCreate)
		adminHintGroup.PUT("/hints/:hintId", middleware.RequireHintManage(d.Hints, d.Access), hintH.AdminUpdate)
		adminHintGroup.DELETE("/hints/:hintId", middleware.RequireHintManage(d.Hints, d.Access), hintH.AdminDelete)
	}

	instances := g.Group("/instances")
	instances.Use(middleware.Auth(d.JWT), activeMw)
	{
		instances.GET("/me", instH.ListMine)
	}

	announcements := g.Group("/announcements")
	{
		announcements.GET("", annH.List)
		announcements.GET("/", annH.List)
		announcements.GET("/:id", middleware.OptionalAuth(d.JWT), optionalActive, annH.Get)

		adminAnn := announcements.Group("")
		adminAnn.Use(middleware.Auth(d.JWT), activeMw, middleware.RequirePermission(domain.PermAnnouncementManage))
		adminAnn.POST("", annH.Create)
		adminAnn.PUT("/:id", annH.Update)
		adminAnn.DELETE("/:id", annH.Delete)
	}

	writeups := g.Group("/writeups")
	writeups.Use(middleware.Auth(d.JWT), activeMw)
	writeups.PATCH("/:id", writeupH.Update)
	writeups.DELETE("/:id", writeupH.Delete)

	discussions := g.Group("/discussions")
	discussions.Use(middleware.Auth(d.JWT), activeMw)
	{
		discussions.GET("/:id/content", discH.GetContent)
		discussions.PATCH("/:id/content", discH.UpdateContent)
		discussions.GET("/:id/revisions", discH.Revisions)
		discussions.POST("/:id/like", discH.ToggleLike)
		discussions.DELETE("/:id", discH.Delete)
	}

	notifs := g.Group("/notifications")
	notifs.Use(middleware.Auth(d.JWT), activeMw)
	{
		notifs.GET("/me", notifH.ListMine)
		notifs.GET("/me/unread_count", notifH.UnreadCount)
		notifs.PATCH("/:id/read", notifH.MarkRead)
		notifs.POST("/read_all", notifH.MarkAllRead)
	}

	statsGroup := g.Group("/stats")
	{
		statsGroup.GET("/overview", statsH.Overview)
		statsGroup.GET("/category", statsH.ByCategory)
		statsGroup.GET("/trend", statsH.SolveTrend)
		statsGroup.GET("/recent", statsH.RecentSolves)
		statsGroup.GET("/first-bloods", statsH.FirstBloods)
		statsGroup.GET("/submissions/trend", statsH.SubmissionTrend)
	}

	g.GET("/search", searchH.Search)

	users := g.Group("/users")
	{
		users.GET("/scoreboard", userH.Scoreboard)
		users.GET("/:id", middleware.OptionalAuth(d.JWT), optionalActive, userH.Get)
		users.GET("/:id/activity", middleware.OptionalAuth(d.JWT), optionalActive, statsH.UserActivity)
		users.GET("/:id/achievements", middleware.OptionalAuth(d.JWT), optionalActive, statsH.UserAchievements)
		users.GET("/:id/avatar", userH.GetAvatar)
		users.GET("/:id/followers", followH.Followers)
		users.GET("/:id/following", followH.Following)
		me := users.Group("")
		me.Use(middleware.Auth(d.JWT), activeMw)
		me.GET("/me/feed", followH.Feed)
		me.GET("/me", userH.Me)
		me.GET("/me/solves", userH.MySolves)
		me.GET("/me/submissions", userH.MySubmissions)
		me.PATCH("/me", userH.UpdateProfile)
		me.POST("/:id/follow", followH.Follow)
		me.DELETE("/:id/follow", followH.Unfollow)
		me.POST("/me/avatar", userH.UploadAvatar)
		me.POST("/me/password", userH.ChangePassword)
		me.POST("/me/2fa/setup", userH.Setup2FA)
		me.POST("/me/2fa/enable", userH.Enable2FA)
		me.POST("/me/2fa/disable", userH.Disable2FA)
		me.GET("/me/writeups", writeupH.ListMine)
	}

	// Public settings + competitions + admin endpoints.
	if settingH != nil {
		g.GET("/settings", settingH.Public)
		g.GET("/settings/", settingH.Public)
	}
	if compH != nil {
		g.GET("/competition", compH.PublicActive)
		g.GET("/competitions", middleware.OptionalAuth(d.JWT), optionalActive, compH.List)
		g.GET("/competitions/:id", middleware.OptionalAuth(d.JWT), optionalActive, compH.Get)
		g.GET("/competitions/:id/scoreboard", middleware.OptionalAuth(d.JWT), optionalActive, compH.Scoreboard)
		g.GET("/competitions/:id/announcements", middleware.OptionalAuth(d.JWT), optionalActive, compH.ListAnnouncements)
		g.GET("/competitions/:id/discussions", middleware.OptionalAuth(d.JWT), optionalActive, discH.CompetitionList)
		compAuth := g.Group("/competitions/:id")
		compAuth.Use(middleware.Auth(d.JWT), activeMw)
		compAuth.POST("/register", compH.Register)
		compAuth.DELETE("/register", compH.Unregister)
		compAuth.GET("/registration", compH.RegistrationStatus)
		compAuth.POST("/discussions", discH.CompetitionCreate)
	}

	teams := g.Group("/teams")
	{
		teams.GET("", teamH.List)
		teams.GET("/", teamH.List)
		teams.GET("/scoreboard", teamH.Scoreboard)
		teams.GET("/:id", middleware.OptionalAuth(d.JWT), optionalActive, teamH.Get)

		memberOnly := teams.Group("")
		memberOnly.Use(middleware.Auth(d.JWT), activeMw)
		memberOnly.POST("", teamH.Create)
		memberOnly.POST("/join", teamH.JoinByCode)
		memberOnly.POST("/leave", teamH.Leave)
		memberOnly.GET("/me", teamH.MyMembership)
		memberOnly.POST("/:id/members/remove", teamH.RemoveMember)
		memberOnly.POST("/:id/transfer", teamH.TransferOwner)
		memberOnly.POST("/:id/invite/rotate", teamH.RotateInvite)
		memberOnly.DELETE("/:id", teamH.Disband)
		memberOnly.GET("/:id/discussions", discH.TeamList)
		memberOnly.POST("/:id/discussions", discH.TeamCreate)
		memberOnly.PATCH("/:id/discussions/:discussionId", discH.TeamModerate)
	}

	adminGroup := g.Group("/admin")
	adminGroup.Use(middleware.Auth(d.JWT), activeMw)
	adminGroup.PATCH("/discussions/:id", middleware.RequirePermission(domain.PermDiscussionModerate), discH.Moderate)
	adminGroup.POST("/broadcast", middleware.RequirePermission(domain.PermBroadcastSend), broadcastH.Send)
	{
		adminGroup.GET("/announcements", middleware.RequirePermission(domain.PermAnnouncementManage), annH.AdminList)
		adminGroup.GET("/users", middleware.RequirePermission(domain.PermUserManage), adminUserH.List)
		adminGroup.PATCH("/users/:id", middleware.RequirePermission(domain.PermUserManage), adminUserH.Update)
		adminGroup.POST("/users/:id/reset-password", middleware.RequirePermission(domain.PermUserManage), adminUserH.ResetPassword)
		adminGroup.GET("/instances", middleware.RequirePermission(domain.PermInstanceManage), adminInstH.List)
		adminGroup.POST("/instances/:id/stop", middleware.RequirePermission(domain.PermInstanceManage), adminInstH.Stop)
		adminGroup.GET("/instances/:id/logs", middleware.RequirePermission(domain.PermInstanceManage), adminInstH.Logs)
		if settingH != nil {
			adminGroup.GET("/settings", middleware.RequirePermission(domain.PermSettingsManage), settingH.AdminList)
			adminGroup.PUT("/settings", middleware.RequirePermission(domain.PermSettingsManage), settingH.AdminUpdate)
		}
		if communityH != nil {
			adminGroup.GET("/community", middleware.RequirePermission(domain.PermCommunityManage), communityH.AdminGet)
			adminGroup.PUT("/community", middleware.RequirePermission(domain.PermCommunityManage), communityH.UpdatePolicy)
			adminGroup.GET("/community/access", middleware.RequirePermission(domain.PermCommunityManage), communityH.ListGrants)
			adminGroup.PUT("/community/access", middleware.RequirePermission(domain.PermCommunityManage), communityH.SetGrants)
		}
		if auditH != nil {
			adminGroup.GET("/audit", middleware.RequirePermission(domain.PermAuditView), auditH.List)
		}
		if d.Server != nil {
			serverH := NewServerHandler(d.Server, d.Audit)
			adminGroup.GET("/server", middleware.RequirePermission(domain.PermServerManage), serverH.Overview)
			adminGroup.POST("/server/prune", middleware.RequirePermission(domain.PermServerManage), serverH.Prune)
		}
		if accessH != nil {
			adminGroup.GET("/access/groups", middleware.RequirePermission(domain.PermChallengeManage), accessH.ListGroups)
			adminGroup.POST("/access/groups", middleware.RequirePermission(domain.PermChallengeManage), accessH.CreateGroup)
			adminGroup.PUT("/access/groups/:id", middleware.RequirePermission(domain.PermChallengeManage), accessH.UpdateGroup)
			adminGroup.DELETE("/access/groups/:id", middleware.RequirePermission(domain.PermChallengeManage), accessH.DeleteGroup)
			adminGroup.GET("/access/subjects", middleware.RequirePermission(domain.PermChallengeManage), accessH.SearchSubjects)
		}
	}

	// Scoped capability groups: challenge admins and competition admins can
	// operate their own domain without gaining account/station-wide powers.
	exportGroup := g.Group("/admin")
	exportGroup.Use(middleware.Auth(d.JWT), activeMw, middleware.RequirePermission(domain.PermChallengeExport))
	exportGroup.GET("/export/challenges", exportH.Export)
	exportGroup.POST("/import/challenges", exportH.Import)

	if compH != nil {
		compAdmin := g.Group("/admin/competitions")
		compAdmin.Use(middleware.Auth(d.JWT), activeMw)
		compAdmin.GET("", compH.List)
		compAdmin.POST("", middleware.RequirePermission(domain.PermCompetitionManage), compH.Create)
		compAdmin.PUT("/:id", middleware.RequireCompetitionManage(d.Competition), compH.Update)
		compAdmin.DELETE("/:id", middleware.RequirePermission(domain.PermCompetitionManage), compH.Delete)
		compAdmin.GET("/:id/export", middleware.RequirePermission(domain.PermCompetitionManage), compH.Export)
		compAdmin.GET("/:id/registrations", middleware.RequireCompetitionManage(d.Competition), compH.AdminListRegistrations)
		compAdmin.PATCH("/:id/registrations/:userId", middleware.RequireCompetitionManage(d.Competition), compH.SetScoreExcluded)
		compAdmin.GET("/:id/announcements", middleware.RequireCompetitionManage(d.Competition), compH.AdminListAnnouncements)
		compAdmin.POST("/:id/announcements", middleware.RequireCompetitionManage(d.Competition), compH.CreateAnnouncement)
		compAdmin.PUT("/:id/announcements/:announcementId", middleware.RequireCompetitionManage(d.Competition), compH.UpdateAnnouncement)
		compAdmin.DELETE("/:id/announcements/:announcementId", middleware.RequireCompetitionManage(d.Competition), compH.DeleteAnnouncement)
		compAdmin.PATCH("/:id/discussions/:discussionId", middleware.RequireCompetitionManage(d.Competition), discH.CompetitionModerate)
		if accessH != nil {
			compAdmin.GET("/:id/access", middleware.RequirePermission(domain.PermCompetitionManage), accessH.ListCompetitionGrants)
			compAdmin.PUT("/:id/access", middleware.RequirePermission(domain.PermCompetitionManage), accessH.SetCompetitionGrants)
		}
	}
}
