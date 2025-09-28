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
	storagePath    string
}

func NewDB(storagePath string) (*DB, error) {
	if err := os.MkdirAll(storagePath, config.DirectoryPermissions); err != nil {
		return nil, fmt.Errorf("failed to create storage directory: %w", err)
	}

	dbPath := filepath.Join(storagePath, config.DatabaseFilename())
	db, err := sql.Open("sqlite3", dbPath+config.SQLiteConnectionOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	dbWrapper := &DB{
		DB:          db,
		storagePath: storagePath,
	}
	if err := dbWrapper.createTables(); err != nil {
		return nil, fmt.Errorf("failed to create tables: %w", err)
	}

	if err := dbWrapper.runMigrations(); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return dbWrapper, nil
}

// GetDescendantCategories recursively gets all descendant category IDs for a given parent
func (db *DB) GetDescendantCategories(parentID int) ([]int, error) {
	var descendants []int

	// Get direct children
	rows, err := db.Query("SELECT id FROM categories WHERE parent_id = ?", parentID)
	if err != nil {
		return nil, fmt.Errorf("failed to query child categories: %w", err)
	}
	defer rows.Close()

	var childIDs []int
	for rows.Next() {
		var childID int
		if err := rows.Scan(&childID); err != nil {
			return nil, fmt.Errorf("failed to scan child category: %w", err)
		}
		childIDs = append(childIDs, childID)
	}

	// Recursively get descendants for each child
	for _, childID := range childIDs {
		childDescendants, err := db.GetDescendantCategories(childID)
		if err != nil {
			return nil, err
		}
		descendants = append(descendants, childDescendants...)
		descendants = append(descendants, childID)
	}

	return descendants, nil
}


func (db *DB) createTables() error {
	queries := []string{
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS categories (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			description TEXT DEFAULT '',
			parent_id INTEGER,
			depth INTEGER NOT NULL DEFAULT 0,
			created INTEGER NOT NULL,
			FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE,
			CHECK (depth >= 0 AND depth <= %d)
		)`, config.MaxCategoryDepth),
		`CREATE TABLE IF NOT EXISTS posts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			category_id INTEGER NOT NULL,
			content TEXT NOT NULL,
			created INTEGER NOT NULL,
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

func (db *DB) runMigrations() error {
	// Check if description column exists in categories table
	rows, err := db.Query("PRAGMA table_info(categories)")
	if err != nil {
		return fmt.Errorf("failed to get table info: %w", err)
	}
	defer rows.Close()

	hasDescription := false
	for rows.Next() {
		var cid int
		var name, dataType string
		var notNull, pk bool
		var defaultValue sql.NullString

		if err := rows.Scan(&cid, &name, &dataType, &notNull, &defaultValue, &pk); err != nil {
			return fmt.Errorf("failed to scan table info: %w", err)
		}

		if name == "description" {
			hasDescription = true
			break
		}
	}

	// Add description column if it doesn't exist
	if !hasDescription {
		_, err := db.Exec("ALTER TABLE categories ADD COLUMN description TEXT DEFAULT ''")
		if err != nil {
			return fmt.Errorf("failed to add description column: %w", err)
		}
	}

	return nil
}
