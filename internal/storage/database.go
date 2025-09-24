package storage

import (
	"backthynk/internal/config"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

type DB struct {
	*sql.DB
}

func NewDB(storagePath string) (*DB, error) {
	if err := os.MkdirAll(storagePath, config.DirectoryPermissions); err != nil {
		return nil, fmt.Errorf("failed to create storage directory: %w", err)
	}

	dbPath := filepath.Join(storagePath, config.DatabaseFilename)
	db, err := sql.Open("sqlite3", dbPath+config.SQLiteConnectionOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	dbWrapper := &DB{db}
	if err := dbWrapper.createTables(); err != nil {
		return nil, fmt.Errorf("failed to create tables: %w", err)
	}

	return dbWrapper, nil
}

func (db *DB) createTables() error {
	queries := []string{
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS categories (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			parent_id INTEGER,
			depth INTEGER NOT NULL DEFAULT 0,
			created DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE,
			CHECK (depth >= 0 AND depth <= %d)
		)`, config.MaxCategoryDepth),
		`CREATE TABLE IF NOT EXISTS posts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			category_id INTEGER NOT NULL,
			content TEXT NOT NULL,
			created DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
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
		`CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id)`,
		`CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category_id)`,
		`CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_attachments_post ON attachments(post_id)`,
		`CREATE INDEX IF NOT EXISTS idx_link_previews_post ON link_previews(post_id)`,
	}

	for _, query := range queries {
		if _, err := db.Exec(query); err != nil {
			return fmt.Errorf("failed to execute query %q: %w", query, err)
		}
	}

	return nil
}