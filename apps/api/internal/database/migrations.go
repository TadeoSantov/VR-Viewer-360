package database

import (
	"fmt"
	"log"
	"strings"

	"github.com/jmoiron/sqlx"
)

const migrationsSQL = `
CREATE TABLE IF NOT EXISTS users (
	id          TEXT PRIMARY KEY,
	username    TEXT NOT NULL UNIQUE,
	email       TEXT,
	created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
	updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
	id           TEXT PRIMARY KEY,
	name         TEXT NOT NULL,
	slug         TEXT NOT NULL UNIQUE,
	description  TEXT DEFAULT '',
	is_published INTEGER DEFAULT 0,
	created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
	updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assets (
	id                TEXT PRIMARY KEY,
	original_filename TEXT NOT NULL,
	stored_filename   TEXT NOT NULL,
	mime_type         TEXT NOT NULL,
	size_bytes        INTEGER DEFAULT 0,
	width             INTEGER,
	height            INTEGER,
	storage_path      TEXT NOT NULL,
	created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scenes (
	id            TEXT PRIMARY KEY,
	project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	name          TEXT NOT NULL,
	asset_id      TEXT REFERENCES assets(id),
	initial_yaw   REAL DEFAULT 0,
	initial_pitch REAL DEFAULT 0,
	initial_fov   REAL DEFAULT 75,
	sort_order    INTEGER DEFAULT 0,
	created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
	updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hotspots (
	id              TEXT PRIMARY KEY,
	project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	scene_id        TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
	label           TEXT NOT NULL,
	description     TEXT DEFAULT '',
	position_x      REAL NOT NULL,
	position_y      REAL NOT NULL,
	position_z      REAL NOT NULL,
	target_scene_id TEXT REFERENCES scenes(id) ON DELETE SET NULL,
	type            TEXT DEFAULT 'info' CHECK(type IN ('info', 'navigation')),
	created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
	updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS processing_jobs (
	id            TEXT PRIMARY KEY,
	asset_id      TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
	status        TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'done', 'failed')),
	progress      INTEGER DEFAULT 0,
	error_message TEXT,
	created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
	updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scenes_project_id ON scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_hotspots_scene_id ON hotspots(scene_id);
CREATE INDEX IF NOT EXISTS idx_hotspots_project_id ON hotspots(project_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_asset_id ON processing_jobs(asset_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);

INSERT OR IGNORE INTO users (id, username, email) VALUES ('default', 'admin', 'admin@local');
`

func Migrate(db *sqlx.DB) error {
	if _, err := db.Exec(migrationsSQL); err != nil {
		return fmt.Errorf("running migrations: %w", err)
	}

	// v2: add processed asset path columns (idempotent — ignore duplicate column errors)
	v2Alters := []string{
		`ALTER TABLE assets ADD COLUMN thumbnail_path TEXT`,
		`ALTER TABLE assets ADD COLUMN cubemap_dir    TEXT`,
		`ALTER TABLE assets ADD COLUMN tiles_dir      TEXT`,
		`ALTER TABLE assets ADD COLUMN processed_at   DATETIME`,
	}
	for _, stmt := range v2Alters {
		if _, err := db.Exec(stmt); err != nil {
			if !strings.Contains(err.Error(), "duplicate column name") {
				return fmt.Errorf("migration v2: %w", err)
			}
		}
	}

	// v3: auth fields + user ownership
	if err := migrateV3(db); err != nil {
		return err
	}

	log.Println("[DB] Migrations applied")
	return nil
}

// migrateV3 adds auth fields and user ownership to projects (idempotent)
func migrateV3(db *sqlx.DB) error {
	v3Alters := []string{
		// Add password hash to users
		`ALTER TABLE users ADD COLUMN password_hash TEXT`,
		// Tie projects to users (nullable for existing rows)
		`ALTER TABLE projects ADD COLUMN user_id TEXT REFERENCES users(id)`,
	}
	for _, stmt := range v3Alters {
		if _, err := db.Exec(stmt); err != nil {
			if !strings.Contains(err.Error(), "duplicate column name") {
				return fmt.Errorf("migration v3: %w", err)
			}
		}
	}
	return nil
}
