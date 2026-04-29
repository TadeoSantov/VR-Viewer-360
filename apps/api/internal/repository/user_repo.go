package repository

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"github.com/TadeoSantov/vr-tour-platform/api/internal/models"
)

type UserRepository struct {
	db *sqlx.DB
}

func NewUserRepository(db *sqlx.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(username, email, passwordHash string) (*models.User, error) {
	id := uuid.New().String()
	now := time.Now().UTC()

	_, err := r.db.Exec(
		`INSERT INTO users (id, username, email, password_hash, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		id, username, email, passwordHash, now, now,
	)
	if err != nil {
		return nil, fmt.Errorf("creating user: %w", err)
	}

	return r.GetByID(id)
}

func (r *UserRepository) GetByID(id string) (*models.User, error) {
	var user models.User
	err := r.db.Get(&user, "SELECT * FROM users WHERE id = ?", id)
	if err != nil {
		return nil, fmt.Errorf("getting user %s: %w", id, err)
	}
	return &user, nil
}

func (r *UserRepository) GetByUsername(username string) (*models.User, error) {
	var user models.User
	err := r.db.Get(&user, "SELECT * FROM users WHERE username = ?", username)
	if err != nil {
		return nil, fmt.Errorf("getting user by username %s: %w", username, err)
	}
	return &user, nil
}

func (r *UserRepository) UsernameExists(username string) (bool, error) {
	var count int
	err := r.db.Get(&count, "SELECT COUNT(*) FROM users WHERE username = ?", username)
	return count > 0, err
}
