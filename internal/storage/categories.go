package storage

import (
	"backthynk/internal/config"
	"backthynk/internal/models"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

func (db *DB) CreateCategory(name string, parentID *int) (*models.Category, error) {
	depth := config.DefaultDepth
	if parentID != nil {
		var parentDepth int
		err := db.QueryRow("SELECT depth FROM categories WHERE id = ?", *parentID).Scan(&parentDepth)
		if err != nil {
			if err == sql.ErrNoRows {
				return nil, fmt.Errorf("parent category not found")
			}
			return nil, fmt.Errorf("failed to get parent depth: %w", err)
		}
		depth = parentDepth + 1
		if depth > config.MaxCategoryDepth {
			return nil, fmt.Errorf(config.ErrMaxDepthExceeded)
		}
	}

	result, err := db.Exec(
		"INSERT INTO categories (name, parent_id, depth, created) VALUES (?, ?, ?, ?)",
		name, parentID, depth, time.Now().UnixMilli(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create category: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get last insert id: %w", err)
	}

	return db.GetCategory(int(id))
}

func (db *DB) GetCategory(id int) (*models.Category, error) {
	var category models.Category
	err := db.QueryRow(
		"SELECT id, name, parent_id, depth, created FROM categories WHERE id = ?",
		id,
	).Scan(&category.ID, &category.Name, &category.ParentID, &category.Depth, &category.Created)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("category not found")
		}
		return nil, fmt.Errorf("failed to get category: %w", err)
	}

	return &category, nil
}

func (db *DB) GetCategories() ([]models.Category, error) {
	rows, err := db.Query(
		"SELECT id, name, parent_id, depth, created FROM categories ORDER BY depth, name",
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query categories: %w", err)
	}
	defer rows.Close()

	var categories []models.Category
	for rows.Next() {
		var category models.Category
		err := rows.Scan(&category.ID, &category.Name, &category.ParentID, &category.Depth, &category.Created)
		if err != nil {
			return nil, fmt.Errorf("failed to scan category: %w", err)
		}
		categories = append(categories, category)
	}

	return categories, nil
}


func (db *DB) GetCategoriesByParent(parentID *int) ([]models.Category, error) {
	var rows *sql.Rows
	var err error

	if parentID == nil {
		rows, err = db.Query(
			"SELECT id, name, parent_id, depth, created FROM categories WHERE parent_id IS NULL ORDER BY name",
		)
	} else {
		rows, err = db.Query(
			"SELECT id, name, parent_id, depth, created FROM categories WHERE parent_id = ? ORDER BY name",
			*parentID,
		)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to query categories by parent: %w", err)
	}
	defer rows.Close()

	var categories []models.Category
	for rows.Next() {
		var category models.Category
		err := rows.Scan(&category.ID, &category.Name, &category.ParentID, &category.Depth, &category.Created)
		if err != nil {
			return nil, fmt.Errorf("failed to scan category: %w", err)
		}
		categories = append(categories, category)
	}

	return categories, nil
}

func (db *DB) DeleteCategory(id int) error {
	// Check if category exists
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM categories WHERE id = ?)", id).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check category existence: %w", err)
	}
	if !exists {
		return fmt.Errorf("category not found")
	}

	// Get all descendant categories recursively
	descendants, err := db.getDescendantCategories(id)
	if err != nil {
		return fmt.Errorf("failed to get descendant categories: %w", err)
	}

	// Add the current category to the list
	descendants = append(descendants, id)

	// Begin transaction
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Get all attachments and delete physical files first
	for _, catID := range descendants {
		// Get all attachments for posts in this category
		rows, err := db.Query(`
			SELECT a.file_path
			FROM attachments a
			JOIN posts p ON a.post_id = p.id
			WHERE p.category_id = ?
		`, catID)
		if err != nil {
			return fmt.Errorf("failed to query attachments for category %d: %w", catID, err)
		}

		var filePaths []string
		for rows.Next() {
			var filePath string
			if err := rows.Scan(&filePath); err != nil {
				rows.Close()
				return fmt.Errorf("failed to scan attachment file path: %w", err)
			}
			filePaths = append(filePaths, filePath)
		}
		rows.Close()

		// Delete physical files
		for _, filePath := range filePaths {
			if err := db.deletePhysicalFile(filePath); err != nil {
				// Log error but continue with deletion
				fmt.Printf("Warning: failed to delete physical file %s: %v\n", filePath, err)
			}
		}
	}

	// Delete all attachments for posts in these categories
	for _, catID := range descendants {
		_, err = tx.Exec(`
			DELETE FROM attachments
			WHERE post_id IN (SELECT id FROM posts WHERE category_id = ?)
		`, catID)
		if err != nil {
			return fmt.Errorf("failed to delete attachments for category %d: %w", catID, err)
		}

		// Delete all posts in this category
		_, err = tx.Exec("DELETE FROM posts WHERE category_id = ?", catID)
		if err != nil {
			return fmt.Errorf("failed to delete posts for category %d: %w", catID, err)
		}
	}

	// Delete categories in reverse order (children first)
	for i := len(descendants) - 1; i >= 0; i-- {
		_, err = tx.Exec("DELETE FROM categories WHERE id = ?", descendants[i])
		if err != nil {
			return fmt.Errorf("failed to delete category %d: %w", descendants[i], err)
		}
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (db *DB) getDescendantCategories(parentID int) ([]int, error) {
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
		childDescendants, err := db.getDescendantCategories(childID)
		if err != nil {
			return nil, err
		}
		descendants = append(descendants, childDescendants...)
		descendants = append(descendants, childID)
	}

	return descendants, nil
}

// Helper function to delete physical files
func (db *DB) deletePhysicalFile(filePath string) error {
	// The filePath is relative to the uploads directory
	// We need to construct the full path
	uploadsDir := filepath.Join("storage", config.UploadsSubdir)
	fullPath := filepath.Join(uploadsDir, filePath)

	// Check if file exists
	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		// File doesn't exist, not an error
		return nil
	}

	// Delete the file
	return os.Remove(fullPath)
}