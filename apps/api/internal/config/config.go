package config

import (
	"os"
	"path/filepath"
	"strconv"
)

type Config struct {
	Port           int
	DatabasePath   string
	StoragePath    string
	MaxUploadMB    int
	AllowedOrigins []string
}

func Load() *Config {
	port, _ := strconv.Atoi(getEnv("PORT", "8080"))
	maxUpload, _ := strconv.Atoi(getEnv("MAX_UPLOAD_MB", "100"))

	storagePath := getEnv("STORAGE_PATH", filepath.Join("..", "..", "storage"))

	return &Config{
		Port:         port,
		DatabasePath: getEnv("DATABASE_PATH", filepath.Join(storagePath, "vr-tour.db")),
		StoragePath:  storagePath,
		MaxUploadMB:  maxUpload,
		AllowedOrigins: []string{
			"http://localhost:3000",
			"http://localhost:5173",
		},
	}
}

func (c *Config) OriginalsPath() string {
	return filepath.Join(c.StoragePath, "originals")
}

func (c *Config) ProcessedPath() string {
	return filepath.Join(c.StoragePath, "processed")
}

func (c *Config) ThumbnailsPath() string {
	return filepath.Join(c.StoragePath, "thumbnails")
}

func (c *Config) CubemapsPath() string {
	return filepath.Join(c.StoragePath, "cubemaps")
}

func (c *Config) TilesPath() string {
	return filepath.Join(c.StoragePath, "tiles")
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
