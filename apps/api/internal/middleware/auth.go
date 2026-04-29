package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/TadeoSantov/vr-tour-platform/api/internal/services"
)

type contextKey string

const ctxKeyUserID contextKey = "userID"

// Authenticate validates the Bearer JWT in the Authorization header.
// If valid, it injects the userID into request context and calls next.
// If invalid or missing, it responds 401.
func Authenticate(jwtService *services.JWTService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if !strings.HasPrefix(authHeader, "Bearer ") {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
			claims, err := jwtService.ValidateToken(tokenStr)
			if err != nil {
				http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), ctxKeyUserID, claims.UserID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetUserID extracts the authenticated user ID from context (set by Authenticate middleware).
func GetUserID(r *http.Request) (string, bool) {
	id, ok := r.Context().Value(ctxKeyUserID).(string)
	return id, ok && id != ""
}
