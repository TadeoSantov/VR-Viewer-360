package repository

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"github.com/TadeoSantov/vr-tour-platform/api/internal/models"
)

type HotspotRepository struct {
	db *sqlx.DB
}

func NewHotspotRepository(db *sqlx.DB) *HotspotRepository {
	return &HotspotRepository{db: db}
}

func (r *HotspotRepository) ListByScene(sceneID string) ([]models.Hotspot, error) {
	var hotspots []models.Hotspot
	err := r.db.Select(&hotspots, "SELECT * FROM hotspots WHERE scene_id = ? ORDER BY created_at ASC", sceneID)
	if err != nil {
		return nil, fmt.Errorf("listing hotspots: %w", err)
	}
	if hotspots == nil {
		hotspots = []models.Hotspot{}
	}
	return hotspots, nil
}

func (r *HotspotRepository) ListByProject(projectID string) ([]models.Hotspot, error) {
	var hotspots []models.Hotspot
	err := r.db.Select(&hotspots, "SELECT * FROM hotspots WHERE project_id = ? ORDER BY created_at ASC", projectID)
	if err != nil {
		return nil, fmt.Errorf("listing hotspots by project: %w", err)
	}
	if hotspots == nil {
		hotspots = []models.Hotspot{}
	}
	return hotspots, nil
}

func (r *HotspotRepository) GetByID(id string) (*models.Hotspot, error) {
	var hotspot models.Hotspot
	err := r.db.Get(&hotspot, "SELECT * FROM hotspots WHERE id = ?", id)
	if err != nil {
		return nil, fmt.Errorf("getting hotspot %s: %w", id, err)
	}
	return &hotspot, nil
}

func (r *HotspotRepository) Create(req models.CreateHotspotRequest) (*models.Hotspot, error) {
	now := time.Now().UTC()
	hotspot := models.Hotspot{
		ID:          uuid.New().String(),
		ProjectID:   req.ProjectID,
		SceneID:     req.SceneID,
		Label:       req.Label,
		Description: req.Description,
		PositionX:   req.PositionX,
		PositionY:   req.PositionY,
		PositionZ:   req.PositionZ,
		Type:        req.Type,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if req.TargetSceneID != "" {
		hotspot.TargetSceneID = &req.TargetSceneID
	}
	if hotspot.Type == "" {
		hotspot.Type = "info"
	}

	_, err := r.db.Exec(
		`INSERT INTO hotspots (id, project_id, scene_id, label, description, position_x, position_y, position_z, target_scene_id, type, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		hotspot.ID, hotspot.ProjectID, hotspot.SceneID, hotspot.Label, hotspot.Description,
		hotspot.PositionX, hotspot.PositionY, hotspot.PositionZ,
		hotspot.TargetSceneID, hotspot.Type, hotspot.CreatedAt, hotspot.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("creating hotspot: %w", err)
	}
	return &hotspot, nil
}

func (r *HotspotRepository) Update(id string, req models.UpdateHotspotRequest) (*models.Hotspot, error) {
	hotspot, err := r.GetByID(id)
	if err != nil {
		return nil, err
	}

	if req.Label != nil {
		hotspot.Label = *req.Label
	}
	if req.Description != nil {
		hotspot.Description = *req.Description
	}
	if req.PositionX != nil {
		hotspot.PositionX = *req.PositionX
	}
	if req.PositionY != nil {
		hotspot.PositionY = *req.PositionY
	}
	if req.PositionZ != nil {
		hotspot.PositionZ = *req.PositionZ
	}
	if req.TargetSceneID != nil {
		hotspot.TargetSceneID = req.TargetSceneID
	}
	if req.Type != nil {
		hotspot.Type = *req.Type
	}
	hotspot.UpdatedAt = time.Now().UTC()

	_, err = r.db.Exec(
		`UPDATE hotspots SET label=?, description=?, position_x=?, position_y=?, position_z=?, target_scene_id=?, type=?, updated_at=? WHERE id=?`,
		hotspot.Label, hotspot.Description, hotspot.PositionX, hotspot.PositionY, hotspot.PositionZ,
		hotspot.TargetSceneID, hotspot.Type, hotspot.UpdatedAt, hotspot.ID,
	)
	if err != nil {
		return nil, fmt.Errorf("updating hotspot %s: %w", id, err)
	}
	return hotspot, nil
}

func (r *HotspotRepository) Delete(id string) error {
	result, err := r.db.Exec("DELETE FROM hotspots WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("deleting hotspot %s: %w", id, err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("hotspot %s not found", id)
	}
	return nil
}
