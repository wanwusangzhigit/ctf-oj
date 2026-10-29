package middleware

import (
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func CORS() gin.HandlerFunc {
	return cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "Accept"},
		ExposeHeaders:    []string{"Content-Length", "Content-Disposition"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	})
}

// CORSFromConfig is the configurable variant. Use it when BACKEND_CORS_ORIGINS
// is set to a non-"*" list — it enables credentialed cross-origin requests
// safely (AllowCredentials can only be true when origins are explicit).
func CORSFromConfig(origins []string) gin.HandlerFunc {
	if len(origins) == 0 {
		return CORS()
	}
	wildcard := false
	for _, o := range origins {
		if o == "*" {
			wildcard = true
			break
		}
	}
	return cors.New(cors.Config{
		AllowOrigins:     origins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "Accept"},
		ExposeHeaders:    []string{"Content-Length", "Content-Disposition"},
		AllowCredentials: !wildcard,
		MaxAge:           12 * time.Hour,
	})
}
