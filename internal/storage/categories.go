package storage

import (
	"backthynk/internal/config"
	"backthynk/internal/core/logger"
	"backthynk/internal/core/models"
	"database/sql"
	"fmt"
	"regexp"
	"strings"
	"time"

	"go.uber.org/zap"
)

func (db *DB) CreateCategory(name string, parentID *int, description string) (*models.Category, error) {
	name = strings.TrimSpace(name)
	if len(name) == 0 {
		logger.Warning("Attempted to create category with empty name")
		return nil, fmt.Errorf("category name cannot be empty")
	}

	if len(name) > config.MaxCategoryNameLength {
		logger.Warning("Category name exceeds maximum length", zap.String("name", name), zap.Int("length", len(name)), zap.Int("max", config.MaxCategoryNameLength))
		return nil, fmt.Errorf("category name must be %d characters or less", config.MaxCategoryNameLength)
	}

	// Validate character restrictions
	validNameRegex := regexp.MustCompile(config.CategoryNamePattern)
	if !validNameRegex.MatchString(name) {
		logger.Warning("Category name contains invalid characters", zap.String("name", name))
		return nil, fmt.Errorf("category name can only contain letters, numbers, hyphens, underscores, and single spaces")
	}
	
	// Check for duplicate names at same level
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
		logger.Warning("Category already exists at this level", zap.String("name", name))
		return nil, fmt.Errorf("category '%s' already exists at this level", name)
	} else if err != sql.ErrNoRows {
		logger.Error("Failed to check for duplicate category", zap.String("name", name), zap.Error(err))
		return nil, fmt.Errorf("failed to check for duplicate: %w", err)
	}

	// Calculate depth
	depth := 0
	if parentID != nil {
		var parentDepth int
		err := db.QueryRow("SELECT depth FROM categories WHERE id = ?", *parentID).Scan(&parentDepth)
		if err != nil {
			if err == sql.ErrNoRows {
				logger.Warning("Parent category not found", zap.Int("parent_id", *parentID))
				return nil, fmt.Errorf("parent category not found")
			}
			logger.Error("Failed to get parent category depth", zap.Int("parent_id", *parentID), zap.Error(err))
			return nil, fmt.Errorf("failed to get parent depth: %w", err)
		}
		depth = parentDepth + 1
		if depth > config.MaxCategoryDepth {
			logger.Warning("Maximum category depth exceeded", zap.String("name", name), zap.Int("depth", depth), zap.Int("max", config.MaxCategoryDepth))
			return nil, fmt.Errorf("maximum category depth exceeded")
		}
	}

	result, err := db.Exec(
		"INSERT INTO categories (name, description, parent_id, depth, created) VALUES (?, ?, ?, ?, ?)",
		name, description, parentID, depth, time.Now().UnixMilli(),
	)
	if err != nil {
		logger.Error("Failed to create category", zap.String("name", name), zap.Error(err))
		return nil, fmt.Errorf("failed to create category: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		logger.Error("Failed to get last insert ID after category creation", zap.String("name", name), zap.Error(err))
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
			logger.Warning("Category not found", zap.Int("category_id", id))
			return nil, fmt.Errorf("category not found")
		}
		logger.Error("Failed to get category", zap.Int("category_id", id), zap.Error(err))
		return nil, fmt.Errorf("failed to get category: %w", err)
	}

	return &category, nil
}

func (db *DB) GetCategories() ([]models.Category, error) {
	rows, err := db.Query(
		"SELECT id, name, description, parent_id, depth, created FROM categories ORDER BY depth, name",
	)
	if err != nil {
		logger.Error("Failed to query categories", zap.Error(err))
		return nil, fmt.Errorf("failed to query categories: %w", err)
	}
	defer rows.Close()

	var categories []models.Category
	for rows.Next() {
		var category models.Category
		err := rows.Scan(&category.ID, &category.Name, &category.Description, &category.ParentID, &category.Depth, &category.Created)
		if err != nil {
			logger.Error("Failed to scan category", zap.Error(err))
			return nil, fmt.Errorf("failed to scan category: %w", err)
		}
		categories = append(categories, category)
	}

	return categories, nil
}

func (db *DB) UpdateCategory(id int, name, description string, parentID *int) (*models.Category, error) {
	name = strings.TrimSpace(name)
	if len(name) == 0 {
		logger.Warning("Attempted to update category with empty name", zap.Int("category_id", id))
		return nil, fmt.Errorf("category name cannot be empty")
	}

	if len(name) > config.MaxCategoryNameLength {
		logger.Warning("Category name exceeds maximum length on update", zap.Int("category_id", id), zap.String("name", name), zap.Int("length", len(name)))
		return nil, fmt.Errorf("category name must be %d characters or less", config.MaxCategoryNameLength)
	}

	if len(description) > config.MaxCategoryDescriptionLength {
		logger.Warning("Category description exceeds maximum length", zap.Int("category_id", id), zap.Int("length", len(description)))
		return nil, fmt.Errorf("description cannot exceed %d characters", config.MaxCategoryDescriptionLength)
	}

	// Get current category
	var currentParentID sql.NullInt64
	var currentDepth int
	err := db.QueryRow("SELECT parent_id, depth FROM categories WHERE id = ?", id).Scan(&currentParentID, &currentDepth)
	if err != nil {
		if err == sql.ErrNoRows {
			logger.Warning("Category not found for update", zap.Int("category_id", id))
			return nil, fmt.Errorf("category not found")
		}
		logger.Error("Failed to get category for update", zap.Int("category_id", id), zap.Error(err))
		return nil, fmt.Errorf("failed to get category: %w", err)
	}
	
	// Calculate new depth if parent changes
	newDepth := currentDepth

	// Check if parent is actually changing
	parentChanging := false
	if parentID == nil && currentParentID.Valid {
		// Changing from having a parent to no parent
		parentChanging = true
		newDepth = 0
	} else if parentID != nil && !currentParentID.Valid {
		// Changing from no parent to having a parent
		parentChanging = true
	} else if parentID != nil && currentParentID.Valid && *parentID != int(currentParentID.Int64) {
		// Changing from one parent to another
		parentChanging = true
	}

	if parentChanging {
		if parentID != nil {
			if *parentID == id {
				logger.Warning("Attempted to make category its own parent", zap.Int("category_id", id))
				return nil, fmt.Errorf("category cannot be its own parent")
			}

			// Check for circular reference only when parent is changing
			if db.isDescendant(id, *parentID) {
				logger.Warning("Attempted circular reference in category hierarchy", zap.Int("category_id", id), zap.Int("parent_id", *parentID))
				return nil, fmt.Errorf("cannot set category as parent of its ancestor")
			}

			var parentDepth int
			err = db.QueryRow("SELECT depth FROM categories WHERE id = ?", *parentID).Scan(&parentDepth)
			if err != nil {
				if err == sql.ErrNoRows {
					logger.Warning("Parent category not found for update", zap.Int("parent_id", *parentID))
					return nil, fmt.Errorf("parent category not found")
				}
				logger.Error("Failed to get parent depth for update", zap.Int("parent_id", *parentID), zap.Error(err))
				return nil, fmt.Errorf("failed to get parent depth: %w", err)
			}
			newDepth = parentDepth + 1
		} else {
			newDepth = 0
		}
	}

	if newDepth > config.MaxCategoryDepth {
		logger.Warning("Category update would exceed maximum depth", zap.Int("category_id", id), zap.Int("new_depth", newDepth))
		return nil, fmt.Errorf("maximum category depth exceeded")
	}

	// Begin transaction
	tx, err := db.Begin()
	if err != nil {
		logger.Error("Failed to begin transaction for category update", zap.Int("category_id", id), zap.Error(err))
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Update category
	_, err = tx.Exec(
		"UPDATE categories SET name = ?, description = ?, parent_id = ?, depth = ? WHERE id = ?",
		name, description, parentID, newDepth, id,
	)
	if err != nil {
		logger.Error("Failed to update category", zap.Int("category_id", id), zap.String("name", name), zap.Error(err))
		return nil, fmt.Errorf("failed to update category: %w", err)
	}

	// Update descendant depths if needed
	if newDepth != currentDepth {
		depthDiff := newDepth - currentDepth
		if err := db.updateDescendantDepthsTx(tx, id, depthDiff); err != nil {
			logger.Error("Failed to update descendant depths", zap.Int("category_id", id), zap.Error(err))
			return nil, fmt.Errorf("failed to update descendant depths: %w", err)
		}
	}

	if err = tx.Commit(); err != nil {
		logger.Error("Failed to commit category update transaction", zap.Int("category_id", id), zap.Error(err))
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}
	
	return db.GetCategory(id)
}

func (db *DB) DeleteCategory(id int) error {
	// Check if exists
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM categories WHERE id = ?)", id).Scan(&exists)
	if err != nil {
		logger.Error("Failed to check category existence for deletion", zap.Int("category_id", id), zap.Error(err))
		return fmt.Errorf("failed to check existence: %w", err)
	}
	if !exists {
		logger.Warning("Attempted to delete non-existent category", zap.Int("category_id", id))
		return fmt.Errorf("category not found")
	}

	// Delete (CASCADE will handle children and posts)
	_, err = db.Exec("DELETE FROM categories WHERE id = ?", id)
	if err != nil {
		logger.Error("Failed to delete category", zap.Int("category_id", id), zap.Error(err))
		return fmt.Errorf("failed to delete category: %w", err)
	}

	return nil
}

func (db *DB) GetAllCategoryPostCounts() (map[int]int, error) {
	rows, err := db.Query("SELECT category_id, COUNT(*) FROM posts GROUP BY category_id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	counts := make(map[int]int)
	for rows.Next() {
		var categoryID, count int
		if err := rows.Scan(&categoryID, &count); err != nil {
			return nil, err
		}
		counts[categoryID] = count
	}
	
	return counts, nil
}

func (db *DB) isDescendant(childID, parentID int) bool {
	var actualParentID sql.NullInt64
	err := db.QueryRow("SELECT parent_id FROM categories WHERE id = ?", childID).Scan(&actualParentID)
	if err != nil || !actualParentID.Valid {
		return false
	}
	
	if int(actualParentID.Int64) == parentID {
		return true
	}
	
	return db.isDescendant(int(actualParentID.Int64), parentID)
}

func (db *DB) updateDescendantDepthsTx(tx *sql.Tx, parentID int, depthDiff int) error {
	rows, err := tx.Query("SELECT id FROM categories WHERE parent_id = ?", parentID)
	if err != nil {
		return err
	}
	defer rows.Close()
	
	var childIDs []int
	for rows.Next() {
		var childID int
		if err := rows.Scan(&childID); err != nil {
			return err
		}
		childIDs = append(childIDs, childID)
	}
	
	for _, childID := range childIDs {
		_, err = tx.Exec("UPDATE categories SET depth = depth + ? WHERE id = ?", depthDiff, childID)
		if err != nil {
			return err
		}
		
		if err := db.updateDescendantDepthsTx(tx, childID, depthDiff); err != nil {
			return err
		}
	}
	
	return nil
}