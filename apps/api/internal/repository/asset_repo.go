package repository

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"github.com/TadeoSantov/vr-tour-platform/api/internal/models"
)

type AssetRepository struct {
	db *sqlx.DB
}

func NewAssetRepository(db *sqlx.DB) *AssetRepository {
	return &AssetRepository{db: db}
}

func (r *AssetRepository) Create(originalFilename, storedFilename, mimeType, storagePath string, sizeBytes int64) (*models.Asset, error) {
	asset := models.Asset{
		ID:               uuid.New().String(),
		OriginalFilename: originalFilename,
		StoredFilename:   storedFilename,
		MimeType:         mimeType,
		SizeBytes:        sizeBytes,
		StoragePath:      storagePath,
		CreatedAt:        time.Now().UTC(),
	}

	_, err := r.db.Exec(
		`INSERT INTO assets (id, original_filename, stored_filename, mime_type, size_bytes, storage_path, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		asset.ID, asset.OriginalFilename, asset.StoredFilename, asset.MimeType,
		asset.SizeBytes, asset.StoragePath, asset.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("creating asset: %w", err)
	}
	return &asset, nil
}

func (r *AssetRepository) GetByID(id string) (*models.Asset, error) {
	var asset models.Asset
	err := r.db.Get(&asset, "SELECT * FROM assets WHERE id = ?", id)
	if err != nil {
		return nil, fmt.Errorf("getting asset %s: %w", id, err)
	}
	return &asset, nil
}

// UpdateProcessedPaths stores relative paths (from storage root) after Rust processing completes.
func (r *AssetRepository) UpdateProcessedPaths(id, thumbnailPath, cubemapDir, tilesDir string) error {
	now := time.Now().UTC()
	_, err := r.db.Exec(
		`UPDATE assets
		 SET thumbnail_path=?, cubemap_dir=?, tiles_dir=?, processed_at=?
		 WHERE id=?`,
		thumbnailPath, cubemapDir, tilesDir, now, id,
	)
	if err != nil {
		return fmt.Errorf("updating processed paths for asset %s: %w", id, err)
	}
	return nil
}
