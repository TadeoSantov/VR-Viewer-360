package services

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
)

type ImageProcessorService struct {
	processorPath string
	storagePath   string // root storage dir (e.g. ../../storage)
}

type ProcessingResult struct {
	// Relative paths from storage root — ready to store in DB and serve via /storage/
	ThumbnailPath string
	CubemapDir    string
	TilesDir      string
	Success       bool
	Error         string
}

func NewImageProcessorService(
	processorPath,
	originalsPath,
	thumbnailsPath,
	cubemapsPath,
	tilesPath string,
) *ImageProcessorService {
	// Derive storage root from originalsPath (go up one level from "originals")
	storagePath := filepath.Dir(originalsPath)
	return &ImageProcessorService{
		processorPath: processorPath,
		storagePath:   storagePath,
	}
}

// ProcessScene runs the Rust image-processor CLI in "process" mode.
// It generates thumbnail, cubemap and tiles for a 360° image.
// Returns relative paths (from storage root) suitable for DB storage.
func (s *ImageProcessorService) ProcessScene(assetID string, inputPath string) ProcessingResult {
	result := ProcessingResult{}

	// Output directory: storage/processed/{assetID}/
	assetOutputDir := filepath.Join(s.storagePath, "processed", assetID)
	if err := os.MkdirAll(assetOutputDir, 0755); err != nil {
		result.Error = fmt.Sprintf("Failed to create output directory: %v", err)
		return result
	}

	// Run: image-processor process --input <file> --output <dir>
	cmd := exec.Command(
		s.processorPath,
		"process",
		"--input", inputPath,
		"--output", assetOutputDir,
		"--cubemap-size", "1024",
		"--tile-size", "256",
		"--max-levels", "4",
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		result.Error = fmt.Sprintf("Image processing failed: %v — output: %s", err, string(output))
		return result
	}

	log.Printf("[ImageProcessor] Processed asset %s: %s", assetID, string(output))

	// Validate generated files exist
	thumbnailAbs := filepath.Join(assetOutputDir, "thumbnail.jpg")
	cubemapAbs := filepath.Join(assetOutputDir, "cubemap")

	if _, err := os.Stat(thumbnailAbs); err != nil {
		result.Error = fmt.Sprintf("Thumbnail generation failed: %v", err)
		return result
	}

	if _, err := os.Stat(cubemapAbs); err != nil {
		result.Error = fmt.Sprintf("Cubemap generation failed: %v", err)
		return result
	}

	// Store relative paths from storage root (these get stored in DB and served via /storage/)
	result.ThumbnailPath = filepath.ToSlash(filepath.Join("processed", assetID, "thumbnail.jpg"))
	result.CubemapDir = filepath.ToSlash(filepath.Join("processed", assetID, "cubemap"))
	result.TilesDir = filepath.ToSlash(filepath.Join("processed", assetID, "tiles"))
	result.Success = true

	return result
}

// ProcessSceneAsync runs processing in background and sends result on channel.
func (s *ImageProcessorService) ProcessSceneAsync(assetID string, inputPath string, done chan ProcessingResult) {
	result := s.ProcessScene(assetID, inputPath)
	done <- result
}

// VerifyProcessorAvailable checks that the Rust binary is accessible.
func (s *ImageProcessorService) VerifyProcessorAvailable() error {
	cmd := exec.Command(s.processorPath, "--help")
	return cmd.Run()
}
