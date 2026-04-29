package models

import "time"

type User struct {
	ID           string    `db:"id" json:"id"`
	Username     string    `db:"username" json:"username"`
	Email        string    `db:"email" json:"email"`
	PasswordHash *string   `db:"password_hash" json:"-"` // never expose hash in JSON
	CreatedAt    time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt    time.Time `db:"updated_at" json:"updatedAt"`
}

type Project struct {
	ID          string    `db:"id" json:"id"`
	UserID      *string   `db:"user_id" json:"userId,omitempty"`
	Name        string    `db:"name" json:"name"`
	Slug        string    `db:"slug" json:"slug"`
	Description string    `db:"description" json:"description"`
	IsPublished bool      `db:"is_published" json:"isPublished"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time `db:"updated_at" json:"updatedAt"`
}

type Scene struct {
	ID           string    `db:"id" json:"id"`
	ProjectID    string    `db:"project_id" json:"projectId"`
	Name         string    `db:"name" json:"name"`
	AssetID      *string   `db:"asset_id" json:"assetId,omitempty"`
	InitialYaw   float64   `db:"initial_yaw" json:"initialYaw"`
	InitialPitch float64   `db:"initial_pitch" json:"initialPitch"`
	InitialFov   float64   `db:"initial_fov" json:"initialFov"`
	SortOrder    int       `db:"sort_order" json:"sortOrder"`
	CreatedAt    time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt    time.Time `db:"updated_at" json:"updatedAt"`
}

type Hotspot struct {
	ID            string    `db:"id" json:"id"`
	ProjectID     string    `db:"project_id" json:"projectId"`
	SceneID       string    `db:"scene_id" json:"sceneId"`
	Label         string    `db:"label" json:"label"`
	Description   string    `db:"description" json:"description"`
	PositionX     float64   `db:"position_x" json:"positionX"`
	PositionY     float64   `db:"position_y" json:"positionY"`
	PositionZ     float64   `db:"position_z" json:"positionZ"`
	TargetSceneID *string   `db:"target_scene_id" json:"targetSceneId,omitempty"`
	Type          string    `db:"type" json:"type"`
	CreatedAt     time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt     time.Time `db:"updated_at" json:"updatedAt"`
}

type Asset struct {
	ID               string     `db:"id" json:"id"`
	OriginalFilename string     `db:"original_filename" json:"originalFilename"`
	StoredFilename   string     `db:"stored_filename" json:"storedFilename"`
	MimeType         string     `db:"mime_type" json:"mimeType"`
	SizeBytes        int64      `db:"size_bytes" json:"sizeBytes"`
	Width            *int       `db:"width" json:"width,omitempty"`
	Height           *int       `db:"height" json:"height,omitempty"`
	StoragePath      string     `db:"storage_path" json:"storagePath"`
	// Processed asset paths (relative to storage root, set by Rust processor)
	ThumbnailPath *string    `db:"thumbnail_path" json:"thumbnailPath,omitempty"`
	CubemapDir    *string    `db:"cubemap_dir"    json:"cubemapDir,omitempty"`
	TilesDir      *string    `db:"tiles_dir"      json:"tilesDir,omitempty"`
	ProcessedAt   *time.Time `db:"processed_at"   json:"processedAt,omitempty"`
	CreatedAt     time.Time  `db:"created_at" json:"createdAt"`
}

type ProcessingJob struct {
	ID           string    `db:"id" json:"id"`
	AssetID      string    `db:"asset_id" json:"assetId"`
	Status       string    `db:"status" json:"status"`
	Progress     int       `db:"progress" json:"progress"`
	ErrorMessage *string   `db:"error_message" json:"errorMessage,omitempty"`
	CreatedAt    time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt    time.Time `db:"updated_at" json:"updatedAt"`
}

// Request/Response DTOs

type CreateProjectRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type UpdateProjectRequest struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
}

type ProjectListResponse struct {
	Projects []Project `json:"projects"`
	Total    int       `json:"total"`
}

// Auth DTOs

type RegisterRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token    string `json:"token"`
	UserID   string `json:"userId"`
	Username string `json:"username"`
	Email    string `json:"email"`
}

// Scene DTOs

type UpdateSceneRequest struct {
	Name         *string  `json:"name,omitempty"`
	InitialYaw   *float64 `json:"initialYaw,omitempty"`
	InitialPitch *float64 `json:"initialPitch,omitempty"`
	InitialFov   *float64 `json:"initialFov,omitempty"`
	SortOrder    *int     `json:"sortOrder,omitempty"`
}

type SceneWithAsset struct {
	Scene
	AssetFilename string  `json:"assetFilename,omitempty"`
	ThumbnailPath *string `json:"thumbnailPath,omitempty"`
	CubemapDir    *string `json:"cubemapDir,omitempty"`
}

type SceneListResponse struct {
	Scenes []SceneWithAsset `json:"scenes"`
	Total  int              `json:"total"`
}

// Hotspot DTOs

type CreateHotspotRequest struct {
	ProjectID     string  `json:"projectId"`
	SceneID       string  `json:"sceneId"`
	Label         string  `json:"label"`
	Description   string  `json:"description"`
	PositionX     float64 `json:"positionX"`
	PositionY     float64 `json:"positionY"`
	PositionZ     float64 `json:"positionZ"`
	TargetSceneID string  `json:"targetSceneId,omitempty"`
	Type          string  `json:"type"`
}

type UpdateHotspotRequest struct {
	Label         *string  `json:"label,omitempty"`
	Description   *string  `json:"description,omitempty"`
	PositionX     *float64 `json:"positionX,omitempty"`
	PositionY     *float64 `json:"positionY,omitempty"`
	PositionZ     *float64 `json:"positionZ,omitempty"`
	TargetSceneID *string  `json:"targetSceneId,omitempty"`
	Type          *string  `json:"type,omitempty"`
}

type HotspotListResponse struct {
	Hotspots []Hotspot `json:"hotspots"`
	Total    int       `json:"total"`
}
