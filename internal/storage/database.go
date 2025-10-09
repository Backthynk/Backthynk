package storage

import (
	"backthynk/internal/config"
	"backthynk/internal/core/logger"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
	"go.uber.org/zap"
)

type DB struct {
	*sql.DB
	storagePath string
}

func NewDB(storagePath string) (*DB, error) {
	if err := os.MkdirAll(storagePath, config.DirectoryPermissions); err != nil {
		logger.Error("Failed to create storage directory", zap.String("path", storagePath), zap.Error(err))
		return nil, fmt.Errorf("failed to create storage directory: %w", err)
	}

	dbPath := filepath.Join(storagePath, config.GetServiceConfig().Files.DatabaseFilename)
	db, err := sql.Open("sqlite3", dbPath+"?_fk=1")
	if err != nil {
		logger.Error("Failed to open database", zap.String("path", dbPath), zap.Error(err))
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		logger.Error("Failed to ping database", zap.String("path", dbPath), zap.Error(err))
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	dbWrapper := &DB{db, storagePath}
	if err := dbWrapper.createTables(); err != nil {
		logger.Error("Failed to create database tables", zap.Error(err))
		return nil, fmt.Errorf("failed to create tables: %w", err)
	}

	if err := dbWrapper.runMigrations(); err != nil {
		logger.Error("Failed to run database migrations", zap.Error(err))
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return dbWrapper, nil
}

// GetStoragePath returns the storage path for this database
func (db *DB) GetStoragePath() string {
	return db.storagePath
}

func (db *DB) createTables() error {
	queries := []string{
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS spaces (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			description TEXT DEFAULT '',
			parent_id INTEGER,
			depth INTEGER NOT NULL DEFAULT 0,
			created INTEGER NOT NULL,
			FOREIGN KEY (parent_id) REFERENCES spaces(id) ON DELETE CASCADE,
			CHECK (depth >= 0 AND depth <= %d)
		)`, config.MaxSpaceDepth),
		`CREATE TABLE IF NOT EXISTS posts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			space_id INTEGER NOT NULL,
			content TEXT NOT NULL,
			created INTEGER NOT NULL,
			FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS attachments (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			post_id INTEGER NOT NULL,
			filename TEXT NOT NULL,
			file_path TEXT NOT NULL,
			file_type TEXT NOT NULL,
			file_size INTEGER NOT NULL,
			FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS link_previews (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			post_id INTEGER NOT NULL,
			url TEXT NOT NULL,
			title TEXT,
			description TEXT,
			image_url TEXT,
			site_name TEXT,
			FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_spaces_parent ON spaces(parent_id)`,
		`CREATE INDEX IF NOT EXISTS idx_posts_space ON posts(space_id)`,
		`CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_attachments_post ON attachments(post_id)`,
		`CREATE INDEX IF NOT EXISTS idx_link_previews_post ON link_previews(post_id)`,
	}
	
	for _, query := range queries {
		if _, err := db.Exec(query); err != nil {
			logger.Error("Failed to execute database query", zap.String("query", query), zap.Error(err))
			return fmt.Errorf("failed to execute query %q: %w", query, err)
		}
	}

	return nil
}

func (db *DB) runMigrations() error {
	return nil
}