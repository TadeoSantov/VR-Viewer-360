package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/TadeoSantov/vr-tour-platform/api/internal/models"
	"github.com/TadeoSantov/vr-tour-platform/api/internal/repository"
	"github.com/TadeoSantov/vr-tour-platform/api/internal/services"
)

type SceneHandler struct {
	sceneRepo      *repository.SceneRepository
	assetRepo      *repository.AssetRepository
	originalsPath  string
	maxUploadBytes int64
	imageProcessor *services.ImageProcessorService
}

func NewSceneHandler(
	sceneRepo *repository.SceneRepository,
	assetRepo *repository.AssetRepository,
	originalsPath string,
	maxUploadMB int,
	imageProcessor *services.ImageProcessorService,
) *SceneHandler {
	return &SceneHandler{
		sceneRepo:      sceneRepo,
		assetRepo:      assetRepo,
		originalsPath:  originalsPath,
		maxUploadBytes: int64(maxUploadMB) * 1024 * 1024,
		imageProcessor: imageProcessor,
	}
}

func (h *SceneHandler) List(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")
	scenes, err := h.sceneRepo.ListByProject(projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to list scenes")
		return
	}

	result := make([]models.SceneWithAsset, 0, len(scenes))
	for _, s := range scenes {
		swa := models.SceneWithAsset{Scene: s}
		if s.AssetID != nil {
			asset, err := h.assetRepo.GetByID(*s.AssetID)
			if err == nil {
				swa.AssetFilename = asset.StoredFilename
				swa.ThumbnailPath = asset.ThumbnailPath
				swa.CubemapDir = asset.CubemapDir
			}
		}
		result = append(result, swa)
	}

	writeJSON(w, http.StatusOK, models.SceneListResponse{
		Scenes: result,
		Total:  len(result),
	})
}

func (h *SceneHandler) Get(w http.ResponseWriter, r *http.Request) {
	sceneID := chi.URLParam(r, "sceneId")
	scene, err := h.sceneRepo.GetByID(sceneID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Scene not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "Failed to get scene")
		return
	}

	swa := models.SceneWithAsset{Scene: *scene}
	if scene.AssetID != nil {
		asset, err := h.assetRepo.GetByID(*scene.AssetID)
		if err == nil {
			swa.AssetFilename = asset.StoredFilename
			swa.ThumbnailPath = asset.ThumbnailPath
			swa.CubemapDir = asset.CubemapDir
		}
	}
	writeJSON(w, http.StatusOK, swa)
}

func (h *SceneHandler) UploadScene(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	r.Body = http.MaxBytesReader(w, r.Body, h.maxUploadBytes)
	if err := r.ParseMultipartForm(h.maxUploadBytes); err != nil {
		writeError(w, http.StatusBadRequest, "File too large or invalid multipart")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Missing 'file' field")
		return
	}
	defer file.Close()

	// Validate mime type
	mimeType := header.Header.Get("Content-Type")
	if !strings.HasPrefix(mimeType, "image/") {
		writeError(w, http.StatusBadRequest, "Only image files are allowed")
		return
	}

	sceneName := r.FormValue("name")
	if sceneName == "" {
		sceneName = strings.TrimSuffix(header.Filename, filepath.Ext(header.Filename))
	}

	// Generate stored filename
	ext := filepath.Ext(header.Filename)
	if ext == "" {
		ext = ".jpg"
	}
	storedFilename := fmt.Sprintf("%s%s", uuid.New().String(), ext)
	dstPath := filepath.Join(h.originalsPath, storedFilename)

	// Write file to disk
	dst, err := os.Create(dstPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to save file")
		return
	}
	defer dst.Close()

	written, err := io.Copy(dst, file)
	if err != nil {
		os.Remove(dstPath)
		writeError(w, http.StatusInternalServerError, "Failed to write file")
		return
	}

	// Create asset record
	asset, err := h.assetRepo.Create(header.Filename, storedFilename, mimeType, "originals/"+storedFilename, written)
	if err != nil {
		os.Remove(dstPath)
		writeError(w, http.StatusInternalServerError, "Failed to create asset record")
		return
	}

	// Process image (thumbnail, cubemap, tiles) - async
	if h.imageProcessor != nil {
		go func() {
			result := h.imageProcessor.ProcessScene(asset.ID, dstPath)
			if !result.Success {
				fmt.Printf("[ImageProcessor] Failed for asset %s: %s\n", asset.ID, result.Error)
				return
			}
			// Persist processed paths in DB
			if err := h.assetRepo.UpdateProcessedPaths(
				asset.ID,
				result.ThumbnailPath,
				result.CubemapDir,
				result.TilesDir,
			); err != nil {
				fmt.Printf("[ImageProcessor] Failed to save paths for asset %s: %v\n", asset.ID, err)
			}
		}()
	}

	// Create scene record
	scene, err := h.sceneRepo.Create(projectID, sceneName, asset.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create scene record")
		return
	}

	writeJSON(w, http.StatusCreated, models.SceneWithAsset{
		Scene:         *scene,
		AssetFilename: storedFilename,
	})
}

func (h *SceneHandler) Update(w http.ResponseWriter, r *http.Request) {
	sceneID := chi.URLParam(r, "sceneId")

	var req models.UpdateSceneRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	scene, err := h.sceneRepo.Update(sceneID, req)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Scene not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "Failed to update scene")
		return
	}
	writeJSON(w, http.StatusOK, scene)
}

func (h *SceneHandler) Delete(w http.ResponseWriter, r *http.Request) {
	sceneID := chi.URLParam(r, "sceneId")
	if err := h.sceneRepo.Delete(sceneID); err != nil {
		writeError(w, http.StatusNotFound, "Scene not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
