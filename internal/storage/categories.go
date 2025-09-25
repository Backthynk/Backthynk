package storage

import (
	"backthynk/internal/config"
	"backthynk/internal/models"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

func (db *DB) CreateCategory(name string, parentID *int, description string) (*models.Category, error) {
	// Trim whitespace from name
	name = strings.TrimSpace(name)
	if len(name) == 0 {
		return nil, fmt.Errorf("category name cannot be empty")
	}

	// Validate name length
	if len(name) > config.MaxCategoryNameLength {
		return nil, fmt.Errorf("category name must be %d characters or less", config.MaxCategoryNameLength)
	}

	// Validate character restrictions: letters, numbers, and single spaces only
	validNameRegex := regexp.MustCompile(`^[a-zA-Z0-9]+(?:\s[a-zA-Z0-9]+)*$`)
	if !validNameRegex.MatchString(name) {
		return nil, fmt.Errorf("category name can only contain letters, numbers, and single spaces")
	}

	// Check for duplicate names at the same level (case-insensitive)
	var existingID int
	var query string
	var args []interface{}

	if parentID == nil {
		query = "SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND parent_id IS NULL"
		args = []interface{}{name}
	} else {
		query = "SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND parent_id = ?"
		args = []interface{}{name, *parentID}
	}

	err := db.QueryRow(query, args...).Scan(&existingID)
	if err == nil {
		// Found existing category with same name at same level
		return nil, fmt.Errorf("category '%s' already exists at this level (case-insensitive)", name)
	} else if err != sql.ErrNoRows {
		// Actual error occurred
		return nil, fmt.Errorf("failed to check for duplicate category name: %w", err)
	}

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
		"INSERT INTO categories (name, description, parent_id, depth, created) VALUES (?, ?, ?, ?, ?)",
		name, description, parentID, depth, time.Now().UnixMilli(),
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
		"SELECT id, name, description, parent_id, depth, created FROM categories WHERE id = ?",
		id,
	).Scan(&category.ID, &category.Name, &category.Description, &category.ParentID, &category.Depth, &category.Created)

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
		"SELECT id, name, description, parent_id, depth, created FROM categories ORDER BY depth, name",
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query categories: %w", err)
	}
	defer rows.Close()

	var categories []models.Category
	for rows.Next() {
		var category models.Category
		err := rows.Scan(&category.ID, &category.Name, &category.Description, &category.ParentID, &category.Depth, &category.Created)
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
			"SELECT id, name, description, parent_id, depth, created FROM categories WHERE parent_id IS NULL ORDER BY name",
		)
	} else {
		rows, err = db.Query(
			"SELECT id, name, description, parent_id, depth, created FROM categories WHERE parent_id = ? ORDER BY name",
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
		err := rows.Scan(&category.ID, &category.Name, &category.Description, &category.ParentID, &category.Depth, &category.Created)
		if err != nil {
			return nil, fmt.Errorf("failed to scan category: %w", err)
		}
		categories = append(categories, category)
	}

	return categories, nil
}

func (db *DB) UpdateCategory(id int, name string, description string, newParentID *int) (*models.Category, error) {
	// Trim whitespace from name
	name = strings.TrimSpace(name)
	if len(name) == 0 {
		return nil, fmt.Errorf("category name cannot be empty")
	}

	// Validate name length
	if len(name) > config.MaxCategoryNameLength {
		return nil, fmt.Errorf("category name must be %d characters or less", config.MaxCategoryNameLength)
	}

	// Validate character restrictions: letters, numbers, and single spaces only
	validNameRegex := regexp.MustCompile(`^[a-zA-Z0-9]+(?:\s[a-zA-Z0-9]+)*$`)
	if !validNameRegex.MatchString(name) {
		return nil, fmt.Errorf("category name can only contain letters, numbers, and single spaces")
	}

	// Validate description length (max 280 characters)
	if len(description) > config.MaxCategoryDescriptionLength {
		return nil, fmt.Errorf("description cannot exceed %d characters", config.MaxCategoryDescriptionLength)
	}

	// Check if category exists and get current info
	var currentParentID sql.NullInt64
	var currentDepth int
	err := db.QueryRow("SELECT parent_id, depth FROM categories WHERE id = ?", id).Scan(&currentParentID, &currentDepth)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("category not found")
		}
		return nil, fmt.Errorf("failed to get category: %w", err)
	}

	// Convert current parent ID for comparison
	var currentParentIDPtr *int
	if currentParentID.Valid {
		val := int(currentParentID.Int64)
		currentParentIDPtr = &val
	}

	// Check if we're changing the parent
	parentChanged := false
	if newParentID == nil && currentParentIDPtr != nil {
		parentChanged = true
	} else if newParentID != nil && currentParentIDPtr == nil {
		parentChanged = true
	} else if newParentID != nil && currentParentIDPtr != nil && *newParentID != *currentParentIDPtr {
		parentChanged = true
	}

	// If parent is changing, prevent creating cycles and calculate new depth
	newDepth := currentDepth
	if parentChanged {
		// Prevent setting parent to self or descendant
		if newParentID != nil {
			if *newParentID == id {
				return nil, fmt.Errorf("category cannot be its own parent")
			}

			// Check if newParentID is a descendant of current category
			descendants, err := db.getDescendantCategories(id)
			if err != nil {
				return nil, fmt.Errorf("failed to check descendants: %w", err)
			}
			for _, descendantID := range descendants {
				if descendantID == *newParentID {
					return nil, fmt.Errorf("cannot set category as parent of its ancestor")
				}
			}

			// Calculate new depth
			var parentDepth int
			err = db.QueryRow("SELECT depth FROM categories WHERE id = ?", *newParentID).Scan(&parentDepth)
			if err != nil {
				if err == sql.ErrNoRows {
					return nil, fmt.Errorf("parent category not found")
				}
				return nil, fmt.Errorf("failed to get parent depth: %w", err)
			}
			newDepth = parentDepth + 1
		} else {
			newDepth = config.DefaultDepth
		}

		// Check depth limit
		if newDepth > config.MaxCategoryDepth {
			return nil, fmt.Errorf(config.ErrMaxDepthExceeded)
		}
	}

	// Check for duplicate names at the same level (excluding current category)
	var existingID int
	var query string
	var args []interface{}

	if newParentID == nil {
		query = "SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND parent_id IS NULL AND id != ?"
		args = []interface{}{name, id}
	} else {
		query = "SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND parent_id = ? AND id != ?"
		args = []interface{}{name, *newParentID, id}
	}

	err = db.QueryRow(query, args...).Scan(&existingID)
	if err == nil {
		return nil, fmt.Errorf("category '%s' already exists at this level (case-insensitive)", name)
	} else if err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to check for duplicate category name: %w", err)
	}

	// Begin transaction for update
	tx, err := db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Update the category
	_, err = tx.Exec(
		"UPDATE categories SET name = ?, description = ?, parent_id = ?, depth = ? WHERE id = ?",
		name, description, newParentID, newDepth, id,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update category: %w", err)
	}

	// If parent changed, recursively update depth of all descendants
	if parentChanged {
		depthDiff := newDepth - currentDepth

		// Before updating, check if any descendants would exceed max depth
		if err := db.checkDescendantDepthsInTx(tx, id, depthDiff); err != nil {
			return nil, fmt.Errorf("cannot move category: %w", err)
		}

		if err := db.updateDescendantDepthsInTx(tx, id, depthDiff); err != nil {
			return nil, fmt.Errorf("failed to update descendant depths: %w", err)
		}
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return db.GetCategory(id)
}

func (db *DB) checkDescendantDepthsInTx(tx *sql.Tx, parentID int, depthDiff int) error {
	// Get all descendants recursively and check if any would exceed max depth
	var descendants []struct {
		ID    int
		Depth int
	}

	// Get direct children first
	rows, err := tx.Query("SELECT id, depth FROM categories WHERE parent_id = ?", parentID)
	if err != nil {
		return fmt.Errorf("failed to query child categories: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var childID, depth int
		if err := rows.Scan(&childID, &depth); err != nil {
			return fmt.Errorf("failed to scan child category: %w", err)
		}

		newDepth := depth + depthDiff
		if newDepth > config.MaxCategoryDepth {
			return fmt.Errorf("moving would cause subcategory to exceed maximum depth (%d)", config.MaxCategoryDepth)
		}

		descendants = append(descendants, struct {
			ID    int
			Depth int
		}{childID, depth})
	}

	// Recursively check descendants
	for _, desc := range descendants {
		if err := db.checkDescendantDepthsInTx(tx, desc.ID, depthDiff); err != nil {
			return err
		}
	}

	return nil
}

func (db *DB) updateDescendantDepthsInTx(tx *sql.Tx, parentID int, depthDiff int) error {
	// Get direct children
	rows, err := tx.Query("SELECT id FROM categories WHERE parent_id = ?", parentID)
	if err != nil {
		return fmt.Errorf("failed to query child categories: %w", err)
	}
	defer rows.Close()

	var childIDs []int
	for rows.Next() {
		var childID int
		if err := rows.Scan(&childID); err != nil {
			return fmt.Errorf("failed to scan child category: %w", err)
		}
		childIDs = append(childIDs, childID)
	}

	// Update depth for each child and recursively update their descendants
	for _, childID := range childIDs {
		// Update child depth
		_, err = tx.Exec("UPDATE categories SET depth = depth + ? WHERE id = ?", depthDiff, childID)
		if err != nil {
			return fmt.Errorf("failed to update child category depth: %w", err)
		}

		// Recursively update descendants
		if err := db.updateDescendantDepthsInTx(tx, childID, depthDiff); err != nil {
			return err
		}
	}

	return nil
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