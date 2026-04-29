package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"golang.org/x/crypto/bcrypt"

	"github.com/TadeoSantov/vr-tour-platform/api/internal/models"
	"github.com/TadeoSantov/vr-tour-platform/api/internal/repository"
	"github.com/TadeoSantov/vr-tour-platform/api/internal/services"
)

type AuthHandler struct {
	userRepo   *repository.UserRepository
	jwtService *services.JWTService
}

func NewAuthHandler(userRepo *repository.UserRepository, jwtService *services.JWTService) *AuthHandler {
	return &AuthHandler{userRepo: userRepo, jwtService: jwtService}
}

// POST /api/auth/register
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req models.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if len(req.Username) < 3 {
		writeError(w, http.StatusBadRequest, "Username must be at least 3 characters")
		return
	}
	if len(req.Password) < 6 {
		writeError(w, http.StatusBadRequest, "Password must be at least 6 characters")
		return
	}

	exists, err := h.userRepo.UsernameExists(req.Username)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to check username")
		return
	}
	if exists {
		writeError(w, http.StatusConflict, "Username already taken")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to hash password")
		return
	}

	user, err := h.userRepo.Create(req.Username, req.Email, string(hash))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create user")
		return
	}

	token, err := h.jwtService.GenerateToken(user.ID, user.Username)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to generate token")
		return
	}

	writeJSON(w, http.StatusCreated, models.AuthResponse{
		Token:    token,
		UserID:   user.ID,
		Username: user.Username,
		Email:    user.Email,
	})
}

// POST /api/auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	user, err := h.userRepo.GetByUsername(req.Username)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusUnauthorized, "Invalid credentials")
			return
		}
		writeError(w, http.StatusInternalServerError, "Failed to find user")
		return
	}

	if user.PasswordHash == nil {
		writeError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(req.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	token, err := h.jwtService.GenerateToken(user.ID, user.Username)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to generate token")
		return
	}

	writeJSON(w, http.StatusOK, models.AuthResponse{
		Token:    token,
		UserID:   user.ID,
		Username: user.Username,
		Email:    user.Email,
	})
}

// GET /api/auth/me  — validate token + return current user
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	// userID injected by auth middleware via context
	userID, ok := r.Context().Value(ctxKeyUserID).(string)
	if !ok || userID == "" {
		writeError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	user, err := h.userRepo.GetByID(userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "User not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"id":       user.ID,
		"username": user.Username,
		"email":    user.Email,
	})
}
