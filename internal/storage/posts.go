package storage

import (
	"backthynk/internal/models"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

func (db *DB) CreatePost(categoryID int, content string) (*models.Post, error) {
	return db.CreatePostWithTimestamp(categoryID, content, time.Now().UnixMilli())
}

func (db *DB) CreatePostWithTimestamp(categoryID int, content string, timestampMillis int64) (*models.Post, error) {
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM categories WHERE id = ?)", categoryID).Scan(&exists)
	if err != nil {
		return nil, fmt.Errorf("failed to check category existence: %w", err)
	}
	if !exists {
		return nil, fmt.Errorf("category not found")
	}

	result, err := db.Exec(
		"INSERT INTO posts (category_id, content, created) VALUES (?, ?, ?)",
		categoryID, content, timestampMillis,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create post: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get last insert id: %w", err)
	}

	return db.GetPost(int(id))
}

func (db *DB) GetPost(id int) (*models.Post, error) {
	var post models.Post
	err := db.QueryRow(
		"SELECT id, category_id, content, created FROM posts WHERE id = ?",
		id,
	).Scan(&post.ID, &post.CategoryID, &post.Content, &post.Created)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("post not found")
		}
		return nil, fmt.Errorf("failed to get post: %w", err)
	}

	return &post, nil
}

func (db *DB) GetPostsByCategory(categoryID int, limit, offset int) ([]models.PostWithAttachments, error) {
	return db.GetPostsByCategoryRecursive(categoryID, false, limit, offset)
}

func (db *DB) GetPostsByCategoryRecursive(categoryID int, recursive bool, limit, offset int) ([]models.PostWithAttachments, error) {
	var query string
	var args []interface{}

	if recursive {
		// Get all descendant category IDs including the current one
		descendants, err := db.GetDescendantCategories(categoryID)
		if err != nil {
			return nil, fmt.Errorf("failed to get descendant categories: %w", err)
		}
		descendants = append(descendants, categoryID)

		// Build IN clause for category IDs
		placeholders := make([]string, len(descendants))
		args = make([]interface{}, len(descendants)+2) // +2 for limit and offset
		for i, id := range descendants {
			placeholders[i] = "?"
			args[i] = id
		}
		args[len(descendants)] = limit
		args[len(descendants)+1] = offset

		query = fmt.Sprintf(
			"SELECT id, category_id, content, created FROM posts WHERE category_id IN (%s) ORDER BY created DESC LIMIT ? OFFSET ?",
			strings.Join(placeholders, ","),
		)
	} else {
		query = "SELECT id, category_id, content, created FROM posts WHERE category_id = ? ORDER BY created DESC LIMIT ? OFFSET ?"
		args = []interface{}{categoryID, limit, offset}
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query posts: %w", err)
	}
	defer rows.Close()

	var posts []models.PostWithAttachments
	for rows.Next() {
		var post models.PostWithAttachments
		err := rows.Scan(&post.ID, &post.CategoryID, &post.Content, &post.Created)
		if err != nil {
			return nil, fmt.Errorf("failed to scan post: %w", err)
		}

		attachments, err := db.GetAttachmentsByPost(post.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to get attachments for post %d: %w", post.ID, err)
		}
		post.Attachments = attachments

		linkPreviews, err := db.GetLinkPreviewsByPostID(post.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to get link previews for post %d: %w", post.ID, err)
		}
		post.LinkPreviews = linkPreviews

		posts = append(posts, post)
	}

	return posts, nil
}


func (db *DB) GetPostCountByCategoryRecursive(categoryID int, recursive bool) (int, error) {
	var count int
	var query string
	var args []interface{}

	if recursive {
		// Get all descendant category IDs including the current one
		descendants, err := db.GetDescendantCategories(categoryID)
		if err != nil {
			return 0, fmt.Errorf("failed to get descendant categories: %w", err)
		}
		descendants = append(descendants, categoryID)

		// Build IN clause for category IDs
		placeholders := make([]string, len(descendants))
		args = make([]interface{}, len(descendants))
		for i, id := range descendants {
			placeholders[i] = "?"
			args[i] = id
		}

		query = fmt.Sprintf("SELECT COUNT(*) FROM posts WHERE category_id IN (%s)", strings.Join(placeholders, ","))
	} else {
		query = "SELECT COUNT(*) FROM posts WHERE category_id = ?"
		args = []interface{}{categoryID}
	}

	err := db.QueryRow(query, args...).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to get post count: %w", err)
	}
	return count, nil
}

func (db *DB) DeletePost(id int) error {
	// First, get all attachments for this post to delete physical files
	attachments, err := db.GetAttachmentsByPost(id)
	if err != nil {
		return fmt.Errorf("failed to get attachments for post %d: %w", id, err)
	}

	// Delete physical files first
	for _, attachment := range attachments {
		if err := db.deletePhysicalFile(attachment.FilePath); err != nil {
			// Log error but continue with deletion
			fmt.Printf("Warning: failed to delete physical file %s: %v\n", attachment.FilePath, err)
		}
	}

	// Begin transaction
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Delete all attachments for this post
	_, err = tx.Exec("DELETE FROM attachments WHERE post_id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete attachments for post %d: %w", id, err)
	}

	// Delete the post
	result, err := tx.Exec("DELETE FROM posts WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete post: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get affected rows: %w", err)
	}

	if affected == 0 {
		return fmt.Errorf("post not found")
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// GetAllPosts gets all posts across all categories with pagination
func (db *DB) GetAllPosts(limit, offset int) ([]models.PostWithAttachments, error) {
	query := `
		SELECT p.id, p.category_id, p.content, p.created
		FROM posts p
		ORDER BY p.created DESC
		LIMIT ? OFFSET ?
	`

	rows, err := db.Query(query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query all posts: %w", err)
	}
	defer rows.Close()

	var posts []models.PostWithAttachments
	for rows.Next() {
		var post models.PostWithAttachments
		err := rows.Scan(&post.ID, &post.CategoryID, &post.Content, &post.Created)
		if err != nil {
			return nil, fmt.Errorf("failed to scan post: %w", err)
		}

		// Load attachments for this post
		attachments, err := db.GetAttachmentsByPost(post.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to get attachments for post %d: %w", post.ID, err)
		}
		post.Attachments = attachments

		// Load link previews for this post
		linkPreviews, err := db.GetLinkPreviewsByPostID(post.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to get link previews for post %d: %w", post.ID, err)
		}
		post.LinkPreviews = linkPreviews

		posts = append(posts, post)
	}

	return posts, nil
}

// UpdatePostCategory updates the category_id of a post
func (db *DB) UpdatePostCategory(postID int, newCategoryID int) error {
	// First verify the post exists
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM posts WHERE id = ?)", postID).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check post existence: %w", err)
	}
	if !exists {
		return fmt.Errorf("post not found")
	}

	// Verify the new category exists
	err = db.QueryRow("SELECT EXISTS(SELECT 1 FROM categories WHERE id = ?)", newCategoryID).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check category existence: %w", err)
	}
	if !exists {
		return fmt.Errorf("category not found")
	}

	// Update the post's category
	result, err := db.Exec("UPDATE posts SET category_id = ? WHERE id = ?", newCategoryID, postID)
	if err != nil {
		return fmt.Errorf("failed to update post category: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get affected rows: %w", err)
	}

	if affected == 0 {
		return fmt.Errorf("no rows were updated")
	}

	return nil
}

// GetTotalPostCount gets the total count of all posts across all categories
func (db *DB) GetTotalPostCount() (int, error) {
	var count int
	query := "SELECT COUNT(*) FROM posts"

	err := db.QueryRow(query).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count all posts: %w", err)
	}

	return count, nil
}
