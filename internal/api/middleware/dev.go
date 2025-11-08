package middleware

import (
	"backthynk/internal/config"
	"net/http"
	"time"
)

func DevMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

		time.Sleep(config.DEV_LATENCY)
		next.ServeHTTP(w, r)
	})
}