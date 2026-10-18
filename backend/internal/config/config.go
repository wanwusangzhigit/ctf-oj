package config

import (
	"fmt"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	HTTPAddr     string
	LogLevel     string
	RegisterOpen bool

	JWT       JWTConfig
	DB        DBConfig
	Redis     RedisConfig
	Storage   StorageConfig
	RateLimit RateLimitConfig
	Docker    DockerConfig
	Instance  InstanceConfig
}

type JWTConfig struct {
	Secret      string
	AccessTTL   time.Duration
	RefreshTTL  time.Duration
	Issuer      string
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

type RateLimitConfig struct {
	PerMinute int
}

type DockerConfig struct {
	Host    string
	Network string
}

type InstanceConfig struct {
	PublicHost     string
	PortMin        int
	PortMax        int
	DefaultTTL     time.Duration
	MaxPerUser     int
	FlagPrefix     string
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
			RefreshTTL: envDuration("BACKEND_JWT_REFRESH_TTL", 720*time.Hour),
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
