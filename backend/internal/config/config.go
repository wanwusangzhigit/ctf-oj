package config

import (
	"fmt"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

func envList(key string, def []string) []string {
	v := strings.TrimSpace(env(key, ""))
	if v == "" {
		return def
	}
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if s := strings.TrimSpace(p); s != "" {
			out = append(out, s)
		}
	}
	if len(out) == 0 {
		return def
	}
	return out
}

type Config struct {
	HTTPAddr     string
	LogLevel     string
	RegisterOpen bool
	PublicURL    string

	JWT       JWTConfig
	DB        DBConfig
	Redis     RedisConfig
	Storage   StorageConfig
	Challenge ChallengeConfig
	RateLimit RateLimitConfig
	Docker    DockerConfig
	Instance  InstanceConfig
	Mailer    MailerConfig
	CORS      CORSConfig
}

type JWTConfig struct {
	Secret     string
	AccessTTL  time.Duration
	RefreshTTL time.Duration
	Issuer     string
}

type DBConfig struct {
	Host     string
	Port     string
	DBName   string
	User     string
	Password string
}

type RedisConfig struct {
	Addr     string
	Password string
	DB       int
}

type StorageConfig struct {
	Driver   string
	LocalDir string
	MaxSize  int64
}

type ChallengeConfig struct {
	SourceDir string
}

type RateLimitConfig struct {
	PerMinute int
}

type DockerConfig struct {
	Host    string
	Network string
}

type InstanceConfig struct {
	PublicHost string
	PortMin    int
	PortMax    int
	DefaultTTL time.Duration
	MaxPerUser int
	FlagPrefix string
}

type MailerConfig struct {
	Driver   string // "console" | "smtp" | "off"
	From     string
	SMTPHost string
	SMTPPort int
	SMTPUser string
	SMTPPass string
	SMTPFrom string
	UseTLS   bool
}

type CORSConfig struct {
	AllowOrigins []string
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg := &Config{
		HTTPAddr:     env("BACKEND_HTTP_ADDR", ":8081"),
		LogLevel:     env("BACKEND_LOG_LEVEL", "info"),
		RegisterOpen: envBool("BACKEND_REGISTER_OPEN", true),
		JWT: JWTConfig{
			Secret:     env("BACKEND_JWT_SECRET", "dev-secret-change-me"),
			AccessTTL:  envDuration("BACKEND_JWT_ACCESS_TTL", 15*time.Minute),
			RefreshTTL: envDuration("BACKEND_JWT_REFRESH_TTL", 168*time.Hour),
			Issuer:     "ctf-oj",
		},
		DB: DBConfig{
			Host:     env("POSTGRES_HOST", "localhost"),
			Port:     env("POSTGRES_PORT", "5432"),
			DBName:   env("POSTGRES_DB", "ctfoj"),
			User:     env("POSTGRES_USER", "ctfoj"),
			Password: env("POSTGRES_PASSWORD", "change_me"),
		},
		Redis: RedisConfig{
			Addr:     env("REDIS_ADDR", "localhost:6379"),
			Password: env("REDIS_PASSWORD", ""),
			DB:       envInt("REDIS_DB", 0),
		},
		Storage: StorageConfig{
			Driver:   env("BACKEND_STORAGE_DRIVER", "local"),
			LocalDir: env("BACKEND_STORAGE_LOCAL_DIR", "./data/uploads"),
			MaxSize:  50 * 1024 * 1024,
		},
		Challenge: ChallengeConfig{
			SourceDir: env("BACKEND_CHALLENGE_SOURCE_DIR", "./data/challenge_sources"),
		},
		RateLimit: RateLimitConfig{
			PerMinute: envInt("BACKEND_RATE_LIMIT_RPM", 120),
		},
		Docker: DockerConfig{
			Host:    env("BACKEND_DOCKER_HOST", "unix:///var/run/docker.sock"),
			Network: env("BACKEND_DOCKER_NETWORK", ""),
		},
		Instance: InstanceConfig{
			PublicHost: env("BACKEND_INSTANCE_PUBLIC_HOST", "localhost"),
			PortMin:    envInt("BACKEND_INSTANCE_PORT_MIN", 30000),
			PortMax:    envInt("BACKEND_INSTANCE_PORT_MAX", 40000),
			DefaultTTL: envDuration("BACKEND_INSTANCE_DEFAULT_TTL", 2*time.Hour),
			MaxPerUser: envInt("BACKEND_INSTANCE_MAX_PER_USER", 1),
			FlagPrefix: env("BACKEND_INSTANCE_FLAG_PREFIX", "flag"),
		},
		Mailer: MailerConfig{
			Driver:   env("BACKEND_MAILER_DRIVER", "console"),
			From:     env("BACKEND_MAILER_FROM", "noreply@ctf-oj.local"),
			SMTPHost: env("BACKEND_SMTP_HOST", ""),
			SMTPPort: envInt("BACKEND_SMTP_PORT", 587),
			SMTPUser: env("BACKEND_SMTP_USER", ""),
			SMTPPass: env("BACKEND_SMTP_PASS", ""),
			SMTPFrom: env("BACKEND_SMTP_FROM", ""),
			UseTLS:   envBool("BACKEND_SMTP_USE_TLS", true),
		},
		CORS: CORSConfig{
			AllowOrigins: envList("BACKEND_CORS_ORIGINS", []string{"*"}),
		},
		PublicURL: env("BACKEND_PUBLIC_URL", "http://localhost:8080"),
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

func (c *Config) validate() error {
	var errs []string
	if strings.TrimSpace(c.JWT.Secret) == "" {
		errs = append(errs, "jwt secret must not be empty")
	}
	if strings.TrimSpace(c.DB.Host) == "" {
		errs = append(errs, "db host must not be empty")
	}
	if len(errs) > 0 {
		return fmt.Errorf("invalid config: %s", strings.Join(errs, "; "))
	}
	return nil
}

func (c *Config) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable TimeZone=UTC",
		c.DB.Host, c.DB.Port, c.DB.User, c.DB.Password, c.DB.DBName,
	)
}
