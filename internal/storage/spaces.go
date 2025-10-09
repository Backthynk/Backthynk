package storage

import (
	"backthynk/internal/config"
	"backthynk/internal/core/logger"
	"backthynk/internal/core/models"
	"backthynk/internal/core/utils"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"go.uber.org/zap"
)

func (db *DB) CreateSpace(name string, parentID *int, description string) (*models.Space, error) {
	name = strings.TrimSpace(name)
	if len(name) == 0 {
		logger.Warning("Attempted to create space with empty name")
		return nil, fmt.Errorf("space name cannot be empty")
	}

	if len(name) > config.MaxSpaceNameLength {
		logger.Warning("Space name exceeds maximum length", zap.String("name", name), zap.Int("length", len(name)), zap.Int("max", config.MaxSpaceNameLength))
		return nil, fmt.Errorf("space name must be %d characters or less", config.MaxSpaceNameLength)
	}

	// Validate display name format
	if !utils.ValidateDisplayName(name) {
		logger.Warning("Space name contains invalid characters", zap.String("name", name))
		return nil, fmt.Errorf(config.ErrSpaceNameInvalidFormat)
	}

	// Generate slug from name
	slug := utils.GenerateSlug(name)
	if slug == "" {
		logger.Warning("Generated slug is empty", zap.String("name", name))
		return nil, fmt.Errorf("space name must contain at least one alphanumeric character")
	}

	// Check for duplicate slugs at same level (slugs must be unique per parent)
	var existingID int
	var query string
	var args []interface{}

	if parentID == nil {
		query = "SELECT id FROM spaces WHERE LOWER(name) = LOWER(?) AND parent_id IS NULL"
		args = []interface{}{name}
	} else {
		query = "SELECT id FROM spaces WHERE LOWER(name) = LOWER(?) AND parent_id = ?"
		args = []interface{}{name, *parentID}
	}

	// First check if exact name exists at this level
	err := db.QueryRow(query, args...).Scan(&existingID)
	if err == nil {
		logger.Warning("Space already exists at this level", zap.String("name", name))
		return nil, fmt.Errorf("space '%s' already exists at this level", name)
	} else if err != sql.ErrNoRows {
		logger.Error("Failed to check for duplicate space", zap.String("name", name), zap.Error(err))
		return nil, fmt.Errorf("failed to check for duplicate: %w", err)
	}

	// Now check if slug would collide at this level
	// Get all spaces at the same level and check their slugs
	var existingSlugsQuery string
	var existingArgs []interface{}
	if parentID == nil {
		existingSlugsQuery = "SELECT name FROM spaces WHERE parent_id IS NULL"
		existingArgs = []interface{}{}
	} else {
		existingSlugsQuery = "SELECT name FROM spaces WHERE parent_id = ?"
		existingArgs = []interface{}{*parentID}
	}

	rows, err := db.Query(existingSlugsQuery, existingArgs...)
	if err != nil {
		logger.Error("Failed to query existing spaces for slug check", zap.Error(err))
		return nil, fmt.Errorf("failed to check for slug collision: %w", err)
	}
	defer rows.Close()

	existingSlugs := make(map[string]bool)
	for rows.Next() {
		var existingName string
		if err := rows.Scan(&existingName); err != nil {
			continue
		}
		existingSlug := utils.GenerateSlug(existingName)
		existingSlugs[existingSlug] = true
	}

	if existingSlugs[slug] {
		logger.Warning("Space slug already exists at this level", zap.String("name", name), zap.String("slug", slug))
		return nil, fmt.Errorf("a space with a similar name already exists at this level")
	}

	// Calculate depth
	depth := 0
	if parentID != nil {
		var parentDepth int
		err := db.QueryRow("SELECT depth FROM spaces WHERE id = ?", *parentID).Scan(&parentDepth)
		if err != nil {
			if err == sql.ErrNoRows {
				logger.Warning("Parent space not found", zap.Int("parent_id", *parentID))
				return nil, fmt.Errorf("parent space not found")
			}
			logger.Error("Failed to get parent space depth", zap.Int("parent_id", *parentID), zap.Error(err))
			return nil, fmt.Errorf("failed to get parent depth: %w", err)
		}
		depth = parentDepth + 1
		if depth > config.MaxSpaceDepth {
			logger.Warning("Maximum space depth exceeded", zap.String("name", name), zap.Int("depth", depth), zap.Int("max", config.MaxSpaceDepth))
			return nil, fmt.Errorf("maximum space depth exceeded")
		}
	}

	result, err := db.Exec(
		"INSERT INTO spaces (name, description, parent_id, depth, created) VALUES (?, ?, ?, ?, ?)",
		name, description, parentID, depth, time.Now().UnixMilli(),
	)
	if err != nil {
		logger.Error("Failed to create space", zap.String("name", name), zap.Error(err))
		return nil, fmt.Errorf("failed to create space: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		logger.Error("Failed to get last insert ID after space creation", zap.String("name", name), zap.Error(err))
		return nil, fmt.Errorf("failed to get last insert id: %w", err)
	}
	
	return db.GetSpace(int(id))
}

func (db *DB) GetSpace(id int) (*models.Space, error) {
	var space models.Space
	err := db.QueryRow(
		"SELECT id, name, description, parent_id, depth, created FROM spaces WHERE id = ?",
		id,
	).Scan(&space.ID, &space.Name, &space.Description, &space.ParentID, &space.Depth, &space.Created)

	if err != nil {
		if err == sql.ErrNoRows {
			logger.Warning("Space not found", zap.Int("space_id", id))
			return nil, fmt.Errorf("space not found")
		}
		logger.Error("Failed to get space", zap.Int("space_id", id), zap.Error(err))
		return nil, fmt.Errorf("failed to get space: %w", err)
	}

	return &space, nil
}

func (db *DB) GetSpaces() ([]models.Space, error) {
	rows, err := db.Query(
		"SELECT id, name, description, parent_id, depth, created FROM spaces ORDER BY depth, name",
	)
	if err != nil {
		logger.Error("Failed to query spaces", zap.Error(err))
		return nil, fmt.Errorf("failed to query spaces: %w", err)
	}
	defer rows.Close()

	var spaces []models.Space
	for rows.Next() {
		var space models.Space
		err := rows.Scan(&space.ID, &space.Name, &space.Description, &space.ParentID, &space.Depth, &space.Created)
		if err != nil {
			logger.Error("Failed to scan space", zap.Error(err))
			return nil, fmt.Errorf("failed to scan space: %w", err)
		}
		spaces = append(spaces, space)
	}

	return spaces, nil
}

func (db *DB) UpdateSpace(id int, name, description string, parentID *int) (*models.Space, error) {
	name = strings.TrimSpace(name)
	if len(name) == 0 {
		logger.Warning("Attempted to update space with empty name", zap.Int("space_id", id))
		return nil, fmt.Errorf("space name cannot be empty")
	}

	if len(name) > config.MaxSpaceNameLength {
		logger.Warning("Space name exceeds maximum length on update", zap.Int("space_id", id), zap.String("name", name), zap.Int("length", len(name)))
		return nil, fmt.Errorf("space name must be %d characters or less", config.MaxSpaceNameLength)
	}

	// Validate display name format
	if !utils.ValidateDisplayName(name) {
		logger.Warning("Space name contains invalid characters on update", zap.Int("space_id", id), zap.String("name", name))
		return nil, fmt.Errorf(config.ErrSpaceNameInvalidFormat)
	}

	// Generate slug from name
	slug := utils.GenerateSlug(name)
	if slug == "" {
		logger.Warning("Generated slug is empty on update", zap.Int("space_id", id), zap.String("name", name))
		return nil, fmt.Errorf("space name must contain at least one alphanumeric character")
	}

	if len(description) > config.MaxSpaceDescriptionLength {
		logger.Warning("Space description exceeds maximum length", zap.Int("space_id", id), zap.Int("length", len(description)))
		return nil, fmt.Errorf("description cannot exceed %d characters", config.MaxSpaceDescriptionLength)
	}

	// Get current space info including name for slug comparison
	var currentParentID sql.NullInt64
	var currentDepth int
	var currentName string
	err := db.QueryRow("SELECT name, parent_id, depth FROM spaces WHERE id = ?", id).Scan(&currentName, &currentParentID, &currentDepth)
	if err != nil {
		if err == sql.ErrNoRows {
			logger.Warning("Space not found for update", zap.Int("space_id", id))
			return nil, fmt.Errorf("space not found")
		}
		logger.Error("Failed to get space for update", zap.Int("space_id", id), zap.Error(err))
		return nil, fmt.Errorf("failed to get space: %w", err)
	}
	
	// Check slug uniqueness at the target level (either current or new parent)
	// We need to check if the new name/slug conflicts with siblings at the target level
	targetParentID := parentID // The parent level where we're checking for conflicts

	// Only check for slug collision if name is changing OR parent is changing
	nameChanging := name != currentName

	// Check if parent is actually changing
	parentChanging := false
	if parentID == nil && currentParentID.Valid {
		// Changing from having a parent to no parent
		parentChanging = true
	} else if parentID != nil && !currentParentID.Valid {
		// Changing from no parent to having a parent
		parentChanging = true
	} else if parentID != nil && currentParentID.Valid && *parentID != int(currentParentID.Int64) {
		// Changing from one parent to another
		parentChanging = true
	}

	// Check for slug collisions if name or parent is changing
	if nameChanging || parentChanging {
		var existingSlugsQuery string
		var existingArgs []interface{}
		if targetParentID == nil {
			existingSlugsQuery = "SELECT id, name FROM spaces WHERE parent_id IS NULL AND id != ?"
			existingArgs = []interface{}{id}
		} else {
			existingSlugsQuery = "SELECT id, name FROM spaces WHERE parent_id = ? AND id != ?"
			existingArgs = []interface{}{*targetParentID, id}
		}

		rows, err := db.Query(existingSlugsQuery, existingArgs...)
		if err != nil {
			logger.Error("Failed to query existing spaces for slug check on update", zap.Error(err))
			return nil, fmt.Errorf("failed to check for slug collision: %w", err)
		}
		defer rows.Close()

		existingSlugs := make(map[string]bool)
		for rows.Next() {
			var siblingID int
			var siblingName string
			if err := rows.Scan(&siblingID, &siblingName); err != nil {
				continue
			}
			siblingSlug := utils.GenerateSlug(siblingName)
			existingSlugs[siblingSlug] = true
		}

		if existingSlugs[slug] {
			logger.Warning("Space slug would collide on update", zap.Int("space_id", id), zap.String("name", name), zap.String("slug", slug))
			return nil, fmt.Errorf("a space with a similar name already exists at this level")
		}
	}

	// Calculate new depth if parent changes
	newDepth := currentDepth
	if parentChanging {
		if parentID == nil {
			newDepth = 0
		}
	}

	if parentChanging {
		if parentID != nil {
			if *parentID == id {
				logger.Warning("Attempted to make space its own parent", zap.Int("space_id", id))
				return nil, fmt.Errorf("space cannot be its own parent")
			}

			// Check for circular reference only when parent is changing
			if db.isDescendant(id, *parentID) {
				logger.Warning("Attempted circular reference in space hierarchy", zap.Int("space_id", id), zap.Int("parent_id", *parentID))
				return nil, fmt.Errorf("cannot set space as parent of its ancestor")
			}

			var parentDepth int
			err = db.QueryRow("SELECT depth FROM spaces WHERE id = ?", *parentID).Scan(&parentDepth)
			if err != nil {
				if err == sql.ErrNoRows {
					logger.Warning("Parent space not found for update", zap.Int("parent_id", *parentID))
					return nil, fmt.Errorf("parent space not found")
				}
				logger.Error("Failed to get parent depth for update", zap.Int("parent_id", *parentID), zap.Error(err))
				return nil, fmt.Errorf("failed to get parent depth: %w", err)
			}
			newDepth = parentDepth + 1
		} else {
			newDepth = 0
		}
	}

	if newDepth > config.MaxSpaceDepth {
		logger.Warning("Space update would exceed maximum depth", zap.Int("space_id", id), zap.Int("new_depth", newDepth))
		return nil, fmt.Errorf("maximum space depth exceeded")
	}

	// Begin transaction
	tx, err := db.Begin()
	if err != nil {
		logger.Error("Failed to begin transaction for space update", zap.Int("space_id", id), zap.Error(err))
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Update space
	_, err = tx.Exec(
		"UPDATE spaces SET name = ?, description = ?, parent_id = ?, depth = ? WHERE id = ?",
		name, description, parentID, newDepth, id,
	)
	if err != nil {
		logger.Error("Failed to update space", zap.Int("space_id", id), zap.String("name", name), zap.Error(err))
		return nil, fmt.Errorf("failed to update space: %w", err)
	}

	// Update descendant depths if needed
	if newDepth != currentDepth {
		depthDiff := newDepth - currentDepth
		if err := db.updateDescendantDepthsTx(tx, id, depthDiff); err != nil {
			logger.Error("Failed to update descendant depths", zap.Int("space_id", id), zap.Error(err))
			return nil, fmt.Errorf("failed to update descendant depths: %w", err)
		}
	}

	if err = tx.Commit(); err != nil {
		logger.Error("Failed to commit space update transaction", zap.Int("space_id", id), zap.Error(err))
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}
	
	return db.GetSpace(id)
}

func (db *DB) DeleteSpace(id int) error {
	// Check if exists
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM spaces WHERE id = ?)", id).Scan(&exists)
	if err != nil {
		logger.Error("Failed to check space existence for deletion", zap.Int("space_id", id), zap.Error(err))
		return fmt.Errorf("failed to check existence: %w", err)
	}
	if !exists {
		logger.Warning("Attempted to delete non-existent space", zap.Int("space_id", id))
		return fmt.Errorf("space not found")
	}

	// Delete (CASCADE will handle children and posts)
	_, err = db.Exec("DELETE FROM spaces WHERE id = ?", id)
	if err != nil {
		logger.Error("Failed to delete space", zap.Int("space_id", id), zap.Error(err))
		return fmt.Errorf("failed to delete space: %w", err)
	}

	return nil
}

func (db *DB) GetAllSpacePostCounts() (map[int]int, error) {
	rows, err := db.Query("SELECT space_id, COUNT(*) FROM posts GROUP BY space_id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	counts := make(map[int]int)
	for rows.Next() {
		var spaceID, count int
		if err := rows.Scan(&spaceID, &count); err != nil {
			return nil, err
		}
		counts[spaceID] = count
	}
	
	return counts, nil
}

func (db *DB) isDescendant(childID, parentID int) bool {
	var actualParentID sql.NullInt64
	err := db.QueryRow("SELECT parent_id FROM spaces WHERE id = ?", childID).Scan(&actualParentID)
	if err != nil || !actualParentID.Valid {
		return false
	}
	
	if int(actualParentID.Int64) == parentID {
		return true
	}
	
	return db.isDescendant(int(actualParentID.Int64), parentID)
}

func (db *DB) updateDescendantDepthsTx(tx *sql.Tx, parentID int, depthDiff int) error {
	rows, err := tx.Query("SELECT id FROM spaces WHERE parent_id = ?", parentID)
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
		_, err = tx.Exec("UPDATE spaces SET depth = depth + ? WHERE id = ?", depthDiff, childID)
		if err != nil {
			return err
		}
		
		if err := db.updateDescendantDepthsTx(tx, childID, depthDiff); err != nil {
			return err
		}
	}
	
	return nil
}