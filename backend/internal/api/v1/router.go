package v1

import (
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"github.com/ctf-oj/backend/internal/api/middleware"
	"github.com/ctf-oj/backend/internal/service"
)

type Deps struct {
	Logger        *zap.Logger
	RDB           *redis.Client
	JWT           *service.JWTService
	Auth          *service.AuthService
	User          *service.UserService
	Cat           *service.CategoryService
	Chal          *service.ChallengeService
	Att           *service.AttachmentService
	Instance      *service.InstanceService
	Announcement  *service.AnnouncementService
	Discussion    *service.DiscussionService
	Notification  *service.NotificationService
}

func Register(r *gin.Engine, d *Deps) {
	r.Use(middleware.Recover(d.Logger))
	r.Use(middleware.Logger(d.Logger))
	r.Use(middleware.CORS())
	r.Use(middleware.RateLimit(d.RDB, 120))

	r.GET("/health", Health)

	Mount(r.Group("/api"), d)
}

func Mount(parent *gin.RouterGroup, d *Deps) {
	g := parent.Group("/v1")

	authH := NewAuthHandler(d.Auth)
	userH := NewUserHandler(d.User)
	catH := NewCategoryHandler(d.Cat)
	chalH := NewChallengeHandler(d.Chal)
	attH := NewAttachmentHandler(d.Att)
	instH := NewInstanceHandler(d.Instance)
	annH := NewAnnouncementHandler(d.Announcement)
	discH := NewDiscussionHandler(d.Discussion)
	notifH := NewNotificationHandler(d.Notification)

	auth := g.Group("/auth")
	{
		auth.POST("/register", authH.Register)
		auth.POST("/login", authH.Login)
		auth.POST("/refresh", authH.Refresh)
		auth.GET("/me", middleware.Auth(d.JWT), authH.Me)
	}

	categories := g.Group("/categories")
	{
		categories.GET("", catH.List)
		categories.GET("/", catH.List)
		adminCat := categories.Group("")
		adminCat.Use(middleware.Auth(d.JWT), middleware.RequireAdmin())
		adminCat.POST("", catH.Create)
		adminCat.PUT("/:id", catH.Update)
		adminCat.DELETE("/:id", catH.Delete)
	}

	challenges := g.Group("/challenges")
	{
		challenges.GET("", middleware.OptionalAuth(d.JWT), chalH.List)
		challenges.GET("/", middleware.OptionalAuth(d.JWT), chalH.List)
		challenges.GET("/:id", middleware.OptionalAuth(d.JWT), chalH.Get)
		challenges.POST("/:id/submit", middleware.Auth(d.JWT), chalH.Submit)
		challenges.GET("/:id/attachments", middleware.OptionalAuth(d.JWT), attH.List)
		challenges.GET("/:id/attachments/:attachmentId/download", middleware.OptionalAuth(d.JWT), attH.Download)

		instanceGroup := challenges.Group("/:id/instance")
		instanceGroup.Use(middleware.Auth(d.JWT))
		{
			instanceGroup.POST("", instH.Start)
			instanceGroup.GET("", instH.GetActive)
			instanceGroup.POST("/:instanceId/extend", instH.Extend)
			instanceGroup.DELETE("/:instanceId", instH.Stop)
		}

		discussionsGroup := challenges.Group("/:id/discussions")
		discussionsGroup.GET("", middleware.OptionalAuth(d.JWT), discH.List)
		discussionsGroup.POST("", middleware.Auth(d.JWT), discH.Create)

		adminCh := challenges.Group("")
		adminCh.Use(middleware.Auth(d.JWT), middleware.RequireAdmin())
		adminCh.POST("", chalH.Create)
		adminCh.PUT("/:id", chalH.Update)
		adminCh.DELETE("/:id", chalH.Delete)
		adminCh.POST("/:id/attachments", attH.Upload)
		adminCh.DELETE("/:id/attachments/:attachmentId", attH.Delete)
	}

	instances := g.Group("/instances")
	instances.Use(middleware.Auth(d.JWT))
	{
		instances.GET("/me", instH.ListMine)
	}

	announcements := g.Group("/announcements")
	{
		announcements.GET("", annH.List)
		announcements.GET("/", annH.List)
		announcements.GET("/:id", middleware.OptionalAuth(d.JWT), annH.Get)

		adminAnn := announcements.Group("")
		adminAnn.Use(middleware.Auth(d.JWT), middleware.RequireAdmin())
		adminAnn.POST("", annH.Create)
		adminAnn.PUT("/:id", annH.Update)
		adminAnn.DELETE("/:id", annH.Delete)
	}

	discussions := g.Group("/discussions")
	discussions.Use(middleware.Auth(d.JWT))
	{
		discussions.POST("/:id/like", discH.ToggleLike)
		discussions.DELETE("/:id", discH.Delete)
	}

	notifs := g.Group("/notifications")
	notifs.Use(middleware.Auth(d.JWT))
	{
		notifs.GET("/me", notifH.ListMine)
		notifs.GET("/me/unread_count", notifH.UnreadCount)
		notifs.PATCH("/:id/read", notifH.MarkRead)
		notifs.POST("/read_all", notifH.MarkAllRead)
	}

	users := g.Group("/users")
	{
		users.GET("/scoreboard", userH.Scoreboard)
		users.GET("/:id", userH.Get)
		me := users.Group("")
		me.Use(middleware.Auth(d.JWT))
		me.GET("/me", userH.Me)
		me.GET("/me/solves", userH.MySolves)
		me.PATCH("/me", userH.UpdateProfile)
	}
}
