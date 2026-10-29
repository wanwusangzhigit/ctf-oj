package middleware

import (
	"context"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"

	"github.com/ctf-oj/backend/internal/domain"
	"github.com/ctf-oj/backend/internal/pkg/response"
)

func RateLimit(rdb *redis.Client, perMinute int) gin.HandlerFunc {
	if perMinute <= 0 {
		perMinute = 600
	}
	return func(c *gin.Context) {
		key := fmt.Sprintf("rl:%s", c.ClientIP())
		ctx, cancel := context.WithTimeout(c.Request.Context(), 500*time.Millisecond)
		defer cancel()

		count, err := rdb.Incr(ctx, key).Result()
		if err == nil && count == 1 {
			_ = rdb.Expire(ctx, key, time.Minute).Err()
		}
		if count > int64(perMinute) {
			c.Header("Retry-After", "60")
			response.Err(c, domain.ErrRateLimited)
			c.Abort()
			return
		}
		c.Next()
	}
}
