package handlers

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/TadeoSantov/vr-tour-platform/api/internal/models"
	"github.com/TadeoSantov/vr-tour-platform/api/internal/repository"
)

type PublicHandler struct {
	projectRepo *repository.ProjectRepository
	sceneRepo   *repository.SceneRepository
	hotspotRepo *repository.HotspotRepository
	assetRepo   *repository.AssetRepository
}

func NewPublicHandler(
	projectRepo *repository.ProjectRepository,
	sceneRepo *repository.SceneRepository,
	hotspotRepo *repository.HotspotRepository,
	assetRepo *repository.AssetRepository,
) *PublicHandler {
	return &PublicHandler{
		projectRepo: projectRepo,
		sceneRepo:   sceneRepo,
		hotspotRepo: hotspotRepo,
		assetRepo:   assetRepo,
	}
}

type PublicSceneResponse struct {
	models.SceneWithAsset
	Hotspots []models.Hotspot `json:"hotspots"`
}

type PublicTourResponse struct {
	Project models.Project        `json:"project"`
	Scenes  []PublicSceneResponse `json:"scenes"`
}

func (h *PublicHandler) GetTourBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	project, err := h.projectRepo.GetBySlug(slug)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Tour not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "Failed to get tour")
		return
	}

	scenes, err := h.sceneRepo.ListByProject(project.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to get scenes")
		return
	}

	allHotspots, err := h.hotspotRepo.ListByProject(project.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to get hotspots")
		return
	}

	// Group hotspots by scene
	hotspotsByScene := make(map[string][]models.Hotspot)
	for _, hs := range allHotspots {
		hotspotsByScene[hs.SceneID] = append(hotspotsByScene[hs.SceneID], hs)
	}

	result := make([]PublicSceneResponse, 0, len(scenes))
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

		hs := hotspotsByScene[s.ID]
		if hs == nil {
			hs = []models.Hotspot{}
		}

		result = append(result, PublicSceneResponse{
			SceneWithAsset: swa,
			Hotspots:       hs,
		})
	}

	writeJSON(w, http.StatusOK, PublicTourResponse{
		Project: *project,
		Scenes:  result,
	})
}
