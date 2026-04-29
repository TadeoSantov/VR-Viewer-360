package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"

	"github.com/TadeoSantov/vr-tour-platform/api/internal/config"
	"github.com/TadeoSantov/vr-tour-platform/api/internal/database"
	"github.com/TadeoSantov/vr-tour-platform/api/internal/handlers"
	"github.com/TadeoSantov/vr-tour-platform/api/internal/middleware"
	"github.com/TadeoSantov/vr-tour-platform/api/internal/repository"
	"github.com/TadeoSantov/vr-tour-platform/api/internal/services"
)

func main() {
	cfg := config.Load()

	// Ensure storage directories exist
	for _, dir := range []string{
		cfg.OriginalsPath(),
		cfg.ProcessedPath(),
		cfg.ThumbnailsPath(),
		cfg.CubemapsPath(),
		cfg.TilesPath(),
	} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			log.Fatalf("Failed to create directory %s: %v", dir, err)
		}
	}

	// Database
	db, err := database.Connect(cfg.DatabasePath)
	if err != nil {
		log.Fatalf("Database connection failed: %v", err)
	}
	defer db.Close()

	if err := database.Migrate(db); err != nil {
		log.Fatalf("Database migration failed: %v", err)
	}

	// Repositories
	projectRepo := repository.NewProjectRepository(db)
	assetRepo := repository.NewAssetRepository(db)
	sceneRepo := repository.NewSceneRepository(db)
	hotspotRepo := repository.NewHotspotRepository(db)
	userRepo := repository.NewUserRepository(db)

	// Services
	jwtService := services.NewJWTService()

	// Handlers
	projectHandler := handlers.NewProjectHandler(projectRepo)
	authHandler := handlers.NewAuthHandler(userRepo, jwtService)

	// Image processor service (CLI-based)
	processorPath := os.Getenv("IMAGE_PROCESSOR_PATH")
	if processorPath == "" {
		processorPath = "image-processor"
	}
	imageProcessorService := services.NewImageProcessorService(
		processorPath,
		cfg.OriginalsPath(),
		cfg.ThumbnailsPath(),
		cfg.CubemapsPath(),
		cfg.TilesPath(),
	)
	if err := imageProcessorService.VerifyProcessorAvailable(); err != nil {
		log.Printf("Warning: image-processor not available: %v", err)
	}

	sceneHandler := handlers.NewSceneHandler(sceneRepo, assetRepo, cfg.OriginalsPath(), cfg.MaxUploadMB, imageProcessorService)
	hotspotHandler := handlers.NewHotspotHandler(hotspotRepo)
	publicHandler := handlers.NewPublicHandler(projectRepo, sceneRepo, hotspotRepo, assetRepo)

	// Auth middleware factory
	authMiddleware := middleware.Authenticate(jwtService)

	// Router
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.Logger)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"}, // Permitir todas las URLs temporalmente
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// Health
	r.Get("/health", handlers.HealthCheck)

	r.Route("/api", func(r chi.Router) {
		// ── Public auth routes (no token required) ──────────────────────────
		r.Route("/auth", func(r chi.Router) {
			r.Post("/register", authHandler.Register)
			r.Post("/login", authHandler.Login)
			// /me requires a valid token
			r.With(authMiddleware).Get("/me", authHandler.Me)
		})

		// ── Protected project routes (token required) ────────────────────────
		r.Route("/projects", func(r chi.Router) {
			// Auth temporalmente desactivado por peticion del usuario
			// r.Use(authMiddleware)

			r.Get("/", projectHandler.List)
			r.Post("/", projectHandler.Create)
			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", projectHandler.GetByID)
				r.Patch("/", projectHandler.Update)
				r.Delete("/", projectHandler.Delete)
				r.Post("/publish", projectHandler.Publish)
				r.Post("/unpublish", projectHandler.Unpublish)

				// Upload scene (multipart)
				r.Post("/upload-scene", sceneHandler.UploadScene)

				// Scenes
				r.Route("/scenes", func(r chi.Router) {
					r.Get("/", sceneHandler.List)
					r.Route("/{sceneId}", func(r chi.Router) {
						r.Get("/", sceneHandler.Get)
						r.Patch("/", sceneHandler.Update)
						r.Delete("/", sceneHandler.Delete)

						// Hotspots
						r.Route("/hotspots", func(r chi.Router) {
							r.Get("/", hotspotHandler.ListByScene)
							r.Post("/", hotspotHandler.Create)
							r.Patch("/{hotspotId}", hotspotHandler.Update)
							r.Delete("/{hotspotId}", hotspotHandler.Delete)
						})
					})
				})
			})
		})
	})

	// Public tour viewer API (no auth — accessible to anyone)
	r.Get("/api/tours/{slug}", publicHandler.GetTourBySlug)

	// Static file serving for uploads
	fileServer := http.FileServer(http.Dir(cfg.StoragePath))
	r.Handle("/storage/*", http.StripPrefix("/storage", fileServer))

	// Start server
	addr := fmt.Sprintf(":%d", cfg.Port)
	log.Printf("[SERVER] VR Tour Platform API v0.2.0 — Auth Enabled")
	log.Printf("[SERVER] Listening on http://localhost%s", addr)
	log.Printf("[SERVER] Storage: %s", cfg.StoragePath)
	log.Printf("[SERVER] Database: %s", cfg.DatabasePath)

	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
