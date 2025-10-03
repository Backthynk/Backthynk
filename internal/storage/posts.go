package storage

import (
	"backthynk/internal/core/logger"
	"backthynk/internal/core/models"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"go.uber.org/zap"
)

type PostData struct {
	ID         int
	CategoryID int
	Created    int64
}

func (db *DB) CreatePost(categoryID int, content string) (*models.Post, error) {
	return db.CreatePostWithTimestamp(categoryID, content, time.Now().UnixMilli())
}

func (db *DB) CreatePostWithTimestamp(categoryID int, content string, timestampMillis int64) (*models.Post, error) {
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM categories WHERE id = ?)", categoryID).Scan(&exists)
	if err != nil {
		logger.Error("Failed to check category existence for post creation", zap.Int("category_id", categoryID), zap.Error(err))
		return nil, fmt.Errorf("failed to check category existence: %w", err)
	}
	if !exists {
		logger.Warning("Attempted to create post in non-existent category", zap.Int("category_id", categoryID))
		return nil, fmt.Errorf("category not found")
	}

	result, err := db.Exec(
		"INSERT INTO posts (category_id, content, created) VALUES (?, ?, ?)",
		categoryID, content, timestampMillis,
	)

	if err != nil {
		logger.Error("Failed to create post", zap.Int("category_id", categoryID), zap.Error(err))
		return nil, fmt.Errorf("failed to create post: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		logger.Error("Failed to get last insert ID after post creation", zap.Int("category_id", categoryID), zap.Error(err))
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
			logger.Warning("Post not found", zap.Int("post_id", id))
			return nil, fmt.Errorf("post not found")
		}
		logger.Error("Failed to get post", zap.Int("post_id", id), zap.Error(err))
		return nil, fmt.Errorf("failed to get post: %w", err)
	}

	return &post, nil
}

func (db *DB) GetPostIDsByCategory(categoryID int) ([]int, error) {
	rows, err := db.Query("SELECT id FROM posts WHERE category_id = ?", categoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var ids []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	
	return ids, nil
}

func (db *DB) GetPostsByCategoryRecursive(categoryID int, recursive bool, limit, offset int, descendants []int) ([]models.PostWithAttachments, error) {
	var query string
	var args []interface{}
	if recursive {
		// Use provided descendants from cache instead of database query
		categoryIDs := append(descendants, categoryID)

		placeholders := make([]string, len(categoryIDs))
		args = make([]interface{}, len(categoryIDs)+2)
		for i, id := range categoryIDs {
			placeholders[i] = "?"
			args[i] = id
		}
		args[len(categoryIDs)] = limit
		args[len(categoryIDs)+1] = offset

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
		logger.Error("Failed to query posts by category", zap.Int("category_id", categoryID), zap.Bool("recursive", recursive), zap.Error(err))
		return nil, fmt.Errorf("failed to query posts: %w", err)
	}
	defer rows.Close()

	var posts []models.PostWithAttachments
	for rows.Next() {
		var post models.PostWithAttachments
		err := rows.Scan(&post.ID, &post.CategoryID, &post.Content, &post.Created)
		if err != nil {
			logger.Error("Failed to scan post", zap.Error(err))
			return nil, fmt.Errorf("failed to scan post: %w", err)
		}

		// Get attachments
		attachments, err := db.GetAttachmentsByPost(post.ID)
		if err != nil {
			logger.Error("Failed to get attachments for post", zap.Int("post_id", post.ID), zap.Error(err))
			return nil, fmt.Errorf("failed to get attachments: %w", err)
		}
		post.Attachments = attachments

		// Get link previews
		linkPreviews, err := db.GetLinkPreviewsByPostID(post.ID)
		if err != nil {
			logger.Error("Failed to get link previews for post", zap.Int("post_id", post.ID), zap.Error(err))
			return nil, fmt.Errorf("failed to get link previews: %w", err)
		}
		post.LinkPreviews = linkPreviews

		posts = append(posts, post)
	}

	return posts, nil
}

func (db *DB) GetAllPosts(limit, offset int) ([]models.PostWithAttachments, error) {
	query := `
		SELECT p.id, p.category_id, p.content, p.created
		FROM posts p
		ORDER BY p.created DESC
		LIMIT ? OFFSET ?
	`

	rows, err := db.Query(query, limit, offset)
	if err != nil {
		logger.Error("Failed to query all posts", zap.Int("limit", limit), zap.Int("offset", offset), zap.Error(err))
		return nil, fmt.Errorf("failed to query posts: %w", err)
	}
	defer rows.Close()

	var posts []models.PostWithAttachments
	for rows.Next() {
		var post models.PostWithAttachments
		err := rows.Scan(&post.ID, &post.CategoryID, &post.Content, &post.Created)
		if err != nil {
			logger.Error("Failed to scan post", zap.Error(err))
			return nil, fmt.Errorf("failed to scan post: %w", err)
		}

		attachments, err := db.GetAttachmentsByPost(post.ID)
		if err != nil {
			logger.Error("Failed to get attachments for post", zap.Int("post_id", post.ID), zap.Error(err))
			return nil, fmt.Errorf("failed to get attachments: %w", err)
		}
		post.Attachments = attachments

		linkPreviews, err := db.GetLinkPreviewsByPostID(post.ID)
		if err != nil {
			logger.Error("Failed to get link previews for post", zap.Int("post_id", post.ID), zap.Error(err))
			return nil, fmt.Errorf("failed to get link previews: %w", err)
		}
		post.LinkPreviews = linkPreviews

		posts = append(posts, post)
	}

	return posts, nil
}

func (db *DB) UpdatePostCategory(postID int, newCategoryID int) error {
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM posts WHERE id = ?)", postID).Scan(&exists)
	if err != nil {
		logger.Error("Failed to check post existence for category update", zap.Int("post_id", postID), zap.Error(err))
		return fmt.Errorf("failed to check post existence: %w", err)
	}
	if !exists {
		logger.Warning("Post not found for category update", zap.Int("post_id", postID))
		return fmt.Errorf("post not found")
	}

	err = db.QueryRow("SELECT EXISTS(SELECT 1 FROM categories WHERE id = ?)", newCategoryID).Scan(&exists)
	if err != nil {
		logger.Error("Failed to check category existence for post move", zap.Int("category_id", newCategoryID), zap.Error(err))
		return fmt.Errorf("failed to check category existence: %w", err)
	}
	if !exists {
		logger.Warning("Category not found for post move", zap.Int("category_id", newCategoryID))
		return fmt.Errorf("category not found")
	}

	_, err = db.Exec("UPDATE posts SET category_id = ? WHERE id = ?", newCategoryID, postID)
	if err != nil {
		logger.Error("Failed to update post category", zap.Int("post_id", postID), zap.Int("new_category_id", newCategoryID), zap.Error(err))
		return fmt.Errorf("failed to update post category: %w", err)
	}

	return nil
}

func (db *DB) DeletePost(id int) error {
	// Get attachments first
	attachments, err := db.GetAttachmentsByPost(id)
	if err != nil {
		logger.Error("Failed to get attachments for post deletion", zap.Int("post_id", id), zap.Error(err))
		return fmt.Errorf("failed to get attachments: %w", err)
	}

	// Delete physical files
	uploadsDir := filepath.Join(db.storagePath, "uploads")
	for _, attachment := range attachments {
		fullPath := filepath.Join(uploadsDir, attachment.FilePath)
		os.Remove(fullPath) // Ignore errors
	}

	// Delete post (CASCADE handles attachments and link previews)
	result, err := db.Exec("DELETE FROM posts WHERE id = ?", id)
	if err != nil {
		logger.Error("Failed to delete post", zap.Int("post_id", id), zap.Error(err))
		return fmt.Errorf("failed to delete post: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		logger.Error("Failed to get affected rows after post deletion", zap.Int("post_id", id), zap.Error(err))
		return fmt.Errorf("failed to get affected rows: %w", err)
	}

	if affected == 0 {
		logger.Warning("Attempted to delete non-existent post", zap.Int("post_id", id))
		return fmt.Errorf("post not found")
	}

	return nil
}

func (db *DB) GetTotalPostCount() (int, error) {
	var count int
	query := "SELECT COUNT(*) FROM posts"

	err := db.QueryRow(query).Scan(&count)
	if err != nil {
		logger.Error("Failed to count posts", zap.Error(err))
		return 0, fmt.Errorf("failed to count posts: %w", err)
	}

	return count, nil
}


func (db *DB) GetAllPostsHeader() ([]PostData, error) {
	query := "SELECT id, category_id, created FROM posts ORDER BY created"
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var posts []PostData
	for rows.Next() {
		var post PostData
		err := rows.Scan(&post.ID, &post.CategoryID, &post.Created)
		if err != nil {
			return nil, err
		}
		posts = append(posts, post)
	}
	
	return posts, nil
}