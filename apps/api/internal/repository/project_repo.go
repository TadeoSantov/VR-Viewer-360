package repository

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"github.com/TadeoSantov/vr-tour-platform/api/internal/models"
)

type ProjectRepository struct {
	db *sqlx.DB
}

func NewProjectRepository(db *sqlx.DB) *ProjectRepository {
	return &ProjectRepository{db: db}
}

func (r *ProjectRepository) List() ([]models.Project, error) {
	var projects []models.Project
	err := r.db.Select(&projects, "SELECT * FROM projects ORDER BY created_at DESC")
	if err != nil {
		return nil, fmt.Errorf("listing projects: %w", err)
	}
	if projects == nil {
		projects = []models.Project{}
	}
	return projects, nil
}

// ListByUser returns projects belonging to a specific user.
// If userID is empty (unauthenticated), returns all projects (fallback for dev).
func (r *ProjectRepository) ListByUser(userID string) ([]models.Project, error) {
	if userID == "" {
		return r.List()
	}
	var projects []models.Project
	err := r.db.Select(&projects,
		"SELECT * FROM projects WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC",
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing projects for user %s: %w", userID, err)
	}
	if projects == nil {
		projects = []models.Project{}
	}
	return projects, nil
}

func (r *ProjectRepository) GetByID(id string) (*models.Project, error) {
	var project models.Project
	err := r.db.Get(&project, "SELECT * FROM projects WHERE id = ?", id)
	if err != nil {
		return nil, fmt.Errorf("getting project %s: %w", id, err)
	}
	return &project, nil
}

func (r *ProjectRepository) GetBySlug(slug string) (*models.Project, error) {
	var project models.Project
	err := r.db.Get(&project, "SELECT * FROM projects WHERE slug = ?", slug)
	if err != nil {
		return nil, fmt.Errorf("getting project by slug %s: %w", slug, err)
	}
	return &project, nil
}

// Create creates a project with no owner (legacy / fallback).
func (r *ProjectRepository) Create(req models.CreateProjectRequest) (*models.Project, error) {
	return r.CreateForUser(req, "")
}

// CreateForUser creates a project owned by the specified user.
func (r *ProjectRepository) CreateForUser(req models.CreateProjectRequest, userID string) (*models.Project, error) {
	id := uuid.New().String()
	slug := generateSlug(req.Name)

	existing, _ := r.GetBySlug(slug)
	if existing != nil {
		slug = slug + "-" + id[:8]
	}

	now := time.Now().UTC()

	var uid *string
	if userID != "" {
		uid = &userID
	}

	project := models.Project{
		ID:          id,
		UserID:      uid,
		Name:        req.Name,
		Slug:        slug,
		Description: req.Description,
		IsPublished: false,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	_, err := r.db.Exec(
		`INSERT INTO projects (id, user_id, name, slug, description, is_published, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		project.ID, uid, project.Name, project.Slug, project.Description,
		project.IsPublished, project.CreatedAt, project.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("creating project: %w", err)
	}

	return &project, nil
}

func (r *ProjectRepository) Update(id string, req models.UpdateProjectRequest) (*models.Project, error) {
	project, err := r.GetByID(id)
	if err != nil {
		return nil, err
	}

	if req.Name != nil {
		project.Name = *req.Name
	}
	if req.Description != nil {
		project.Description = *req.Description
	}
	project.UpdatedAt = time.Now().UTC()

	_, err = r.db.Exec(
		`UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?`,
		project.Name, project.Description, project.UpdatedAt, project.ID,
	)
	if err != nil {
		return nil, fmt.Errorf("updating project %s: %w", id, err)
	}

	return project, nil
}

func (r *ProjectRepository) Delete(id string) error {
	result, err := r.db.Exec("DELETE FROM projects WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("deleting project %s: %w", id, err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("project %s not found", id)
	}
	return nil
}

func (r *ProjectRepository) SetPublished(id string, published bool) (*models.Project, error) {
	now := time.Now().UTC()
	_, err := r.db.Exec(
		"UPDATE projects SET is_published = ?, updated_at = ? WHERE id = ?",
		published, now, id,
	)
	if err != nil {
		return nil, fmt.Errorf("updating publish status for %s: %w", id, err)
	}
	return r.GetByID(id)
}

var nonAlphanumeric = regexp.MustCompile(`[^a-z0-9]+`)

func generateSlug(name string) string {
	slug := strings.ToLower(strings.TrimSpace(name))
	slug = nonAlphanumeric.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	if slug == "" {
		slug = "project"
	}
	return slug
}
