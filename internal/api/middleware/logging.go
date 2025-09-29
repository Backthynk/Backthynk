package middleware

import (
	"log"
	"net/http"
	"time"
)

type responseWriter struct {
	http.ResponseWriter
	status int
	size   int
}

func (rw *responseWriter) WriteHeader(status int) {
	rw.status = status
	rw.ResponseWriter.WriteHeader(status)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	size, err := rw.ResponseWriter.Write(b)
	rw.size += size
	return size, err
}

func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		
		wrapped := &responseWriter{
			ResponseWriter: w,
			status:         http.StatusOK,
		}
		
		next.ServeHTTP(wrapped, r)
		
		log.Printf(
			"%s %s %d %d %v",
			r.Method,
			r.RequestURI,
			wrapped.status,
			wrapped.size,
			time.Since(start),
		)
	})
}