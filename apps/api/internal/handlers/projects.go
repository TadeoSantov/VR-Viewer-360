package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/TadeoSantov/vr-tour-platform/api/internal/middleware"
	"github.com/TadeoSantov/vr-tour-platform/api/internal/models"
	"github.com/TadeoSantov/vr-tour-platform/api/internal/repository"
)

type ProjectHandler struct {
	repo *repository.ProjectRepository
}

func NewProjectHandler(repo *repository.ProjectRepository) *ProjectHandler {
	return &ProjectHandler{repo: repo}
}

func (h *ProjectHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserID(r)
	projects, err := h.repo.ListByUser(userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to list projects")
		return
	}
	writeJSON(w, http.StatusOK, models.ProjectListResponse{
		Projects: projects,
		Total:    len(projects),
	})
}

func (h *ProjectHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	project, err := h.repo.GetByID(id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Project not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "Failed to get project")
		return
	}
	writeJSON(w, http.StatusOK, project)
}

func (h *ProjectHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "Name is required")
		return
	}

	userID, _ := middleware.GetUserID(r)
	project, err := h.repo.CreateForUser(req, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create project")
		return
	}
	writeJSON(w, http.StatusCreated, project)
}

func (h *ProjectHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req models.UpdateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	project, err := h.repo.Update(id, req)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Project not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "Failed to update project")
		return
	}
	writeJSON(w, http.StatusOK, project)
}

func (h *ProjectHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.repo.Delete(id); err != nil {
		writeError(w, http.StatusNotFound, "Project not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *ProjectHandler) Publish(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	project, err := h.repo.SetPublished(id, true)
	if err != nil {
		writeError(w, http.StatusNotFound, "Project not found")
		return
	}
	writeJSON(w, http.StatusOK, project)
}

func (h *ProjectHandler) Unpublish(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	project, err := h.repo.SetPublished(id, false)
	if err != nil {
		writeError(w, http.StatusNotFound, "Project not found")
		return
	}
	writeJSON(w, http.StatusOK, project)
}
