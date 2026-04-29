package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/TadeoSantov/vr-tour-platform/api/internal/models"
	"github.com/TadeoSantov/vr-tour-platform/api/internal/repository"
)

type HotspotHandler struct {
	repo *repository.HotspotRepository
}

func NewHotspotHandler(repo *repository.HotspotRepository) *HotspotHandler {
	return &HotspotHandler{repo: repo}
}

func (h *HotspotHandler) ListByScene(w http.ResponseWriter, r *http.Request) {
	sceneID := chi.URLParam(r, "sceneId")
	hotspots, err := h.repo.ListByScene(sceneID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to list hotspots")
		return
	}
	writeJSON(w, http.StatusOK, models.HotspotListResponse{
		Hotspots: hotspots,
		Total:    len(hotspots),
	})
}

func (h *HotspotHandler) Create(w http.ResponseWriter, r *http.Request) {
	sceneID := chi.URLParam(r, "sceneId")
	projectID := chi.URLParam(r, "id")

	var req models.CreateHotspotRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.SceneID = sceneID
	req.ProjectID = projectID

	if req.Label == "" {
		writeError(w, http.StatusBadRequest, "Label is required")
		return
	}

	hotspot, err := h.repo.Create(req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create hotspot")
		return
	}
	writeJSON(w, http.StatusCreated, hotspot)
}

func (h *HotspotHandler) Update(w http.ResponseWriter, r *http.Request) {
	hotspotID := chi.URLParam(r, "hotspotId")

	var req models.UpdateHotspotRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	hotspot, err := h.repo.Update(hotspotID, req)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Hotspot not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "Failed to update hotspot")
		return
	}
	writeJSON(w, http.StatusOK, hotspot)
}

func (h *HotspotHandler) Delete(w http.ResponseWriter, r *http.Request) {
	hotspotID := chi.URLParam(r, "hotspotId")
	if err := h.repo.Delete(hotspotID); err != nil {
		writeError(w, http.StatusNotFound, "Hotspot not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
