package repository

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"github.com/TadeoSantov/vr-tour-platform/api/internal/models"
)

type SceneRepository struct {
	db *sqlx.DB
}

func NewSceneRepository(db *sqlx.DB) *SceneRepository {
	return &SceneRepository{db: db}
}

func (r *SceneRepository) ListByProject(projectID string) ([]models.Scene, error) {
	var scenes []models.Scene
	err := r.db.Select(&scenes, "SELECT * FROM scenes WHERE project_id = ? ORDER BY sort_order ASC", projectID)
	if err != nil {
		return nil, fmt.Errorf("listing scenes: %w", err)
	}
	if scenes == nil {
		scenes = []models.Scene{}
	}
	return scenes, nil
}

func (r *SceneRepository) GetByID(id string) (*models.Scene, error) {
	var scene models.Scene
	err := r.db.Get(&scene, "SELECT * FROM scenes WHERE id = ?", id)
	if err != nil {
		return nil, fmt.Errorf("getting scene %s: %w", id, err)
	}
	return &scene, nil
}

func (r *SceneRepository) Create(projectID, name, assetID string) (*models.Scene, error) {
	// Get next sort order
	var maxOrder int
	_ = r.db.Get(&maxOrder, "SELECT COALESCE(MAX(sort_order), -1) FROM scenes WHERE project_id = ?", projectID)

	now := time.Now().UTC()
	scene := models.Scene{
		ID:           uuid.New().String(),
		ProjectID:    projectID,
		Name:         name,
		AssetID:      &assetID,
		InitialYaw:   0,
		InitialPitch: 0,
		InitialFov:   75,
		SortOrder:    maxOrder + 1,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	_, err := r.db.Exec(
		`INSERT INTO scenes (id, project_id, name, asset_id, initial_yaw, initial_pitch, initial_fov, sort_order, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		scene.ID, scene.ProjectID, scene.Name, scene.AssetID,
		scene.InitialYaw, scene.InitialPitch, scene.InitialFov,
		scene.SortOrder, scene.CreatedAt, scene.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("creating scene: %w", err)
	}
	return &scene, nil
}

func (r *SceneRepository) Update(id string, req models.UpdateSceneRequest) (*models.Scene, error) {
	scene, err := r.GetByID(id)
	if err != nil {
		return nil, err
	}

	if req.Name != nil {
		scene.Name = *req.Name
	}
	if req.InitialYaw != nil {
		scene.InitialYaw = *req.InitialYaw
	}
	if req.InitialPitch != nil {
		scene.InitialPitch = *req.InitialPitch
	}
	if req.InitialFov != nil {
		scene.InitialFov = *req.InitialFov
	}
	if req.SortOrder != nil {
		scene.SortOrder = *req.SortOrder
	}
	scene.UpdatedAt = time.Now().UTC()

	_, err = r.db.Exec(
		`UPDATE scenes SET name=?, initial_yaw=?, initial_pitch=?, initial_fov=?, sort_order=?, updated_at=? WHERE id=?`,
		scene.Name, scene.InitialYaw, scene.InitialPitch, scene.InitialFov,
		scene.SortOrder, scene.UpdatedAt, scene.ID,
	)
	if err != nil {
		return nil, fmt.Errorf("updating scene %s: %w", id, err)
	}
	return scene, nil
}

func (r *SceneRepository) Delete(id string) error {
	result, err := r.db.Exec("DELETE FROM scenes WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("deleting scene %s: %w", id, err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("scene %s not found", id)
	}
	return nil
}
