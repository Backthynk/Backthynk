package storage

import (
	"backthynk/internal/core/models"
	"fmt"
)

func (db *DB) CreateAttachment(postID int, filename, filePath, fileType string, fileSize int64) (*models.Attachment, error) {
	result, err := db.Exec(
		"INSERT INTO attachments (post_id, filename, file_path, file_type, file_size) VALUES (?, ?, ?, ?, ?)",
		postID, filename, filePath, fileType, fileSize,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create attachment: %w", err)
	}
	
	id, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get last insert id: %w", err)
	}
	
	return &models.Attachment{
		ID:       int(id),
		PostID:   postID,
		Filename: filename,
		FilePath: filePath,
		FileType: fileType,
		FileSize: fileSize,
	}, nil
}

func (db *DB) GetAttachmentsByPost(postID int) ([]models.Attachment, error) {
	rows, err := db.Query(
		"SELECT id, post_id, filename, file_path, file_type, file_size FROM attachments WHERE post_id = ?",
		postID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query attachments: %w", err)
	}
	defer rows.Close()
	
	var attachments []models.Attachment
	for rows.Next() {
		var attachment models.Attachment
		err := rows.Scan(&attachment.ID, &attachment.PostID, &attachment.Filename, &attachment.FilePath, &attachment.FileType, &attachment.FileSize)
		if err != nil {
			return nil, fmt.Errorf("failed to scan attachment: %w", err)
		}
		attachments = append(attachments, attachment)
	}
	
	return attachments, nil
}

func (db *DB) CreateLinkPreview(preview *models.LinkPreview) error {
	query := `INSERT INTO link_previews (post_id, url, title, description, image_url, site_name)
			  VALUES (?, ?, ?, ?, ?, ?)`
	
	result, err := db.Exec(query, preview.PostID, preview.URL, preview.Title,
		preview.Description, preview.ImageURL, preview.SiteName)
	if err != nil {
		return err
	}
	
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	
	preview.ID = int(id)
	return nil
}

func (db *DB) GetLinkPreviewsByPostID(postID int) ([]models.LinkPreview, error) {
	query := `SELECT id, post_id, url, title, description, image_url, site_name
			  FROM link_previews WHERE post_id = ?`
	
	rows, err := db.Query(query, postID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var previews []models.LinkPreview
	for rows.Next() {
		var preview models.LinkPreview
		err := rows.Scan(&preview.ID, &preview.PostID, &preview.URL, &preview.Title,
			&preview.Description, &preview.ImageURL, &preview.SiteName)
		if err != nil {
			return nil, err
		}
		previews = append(previews, preview)
	}
	
	return previews, rows.Err()
}

// File stats for detailed stats feature
type FileStats struct {
	FileCount int64
	TotalSize int64
}

func (db *DB) GetAllFileStats() (map[int]FileStats, error) {
	query := `
		SELECT p.category_id, COUNT(a.id), COALESCE(SUM(a.file_size), 0)
		FROM posts p
		LEFT JOIN attachments a ON p.id = a.post_id
		GROUP BY p.category_id
	`
	
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	stats := make(map[int]FileStats)
	for rows.Next() {
		var categoryID int
		var fileCount int64
		var totalSize int64
		
		if err := rows.Scan(&categoryID, &fileCount, &totalSize); err != nil {
			return nil, err
		}
		
		stats[categoryID] = FileStats{
			FileCount: fileCount,
			TotalSize: totalSize,
		}
	}
	
	return stats, nil
}

// PostFileStats represents file stats for a specific post
type PostFileStats struct {
	PostID     int
	CategoryID int
	FileCount  int64
	TotalSize  int64
}

// GetAllPostFileStats returns file statistics for all posts grouped by category and post
func (db *DB) GetAllPostFileStats() ([]PostFileStats, error) {
	query := `
		SELECT p.id, p.category_id, COUNT(a.id), COALESCE(SUM(a.file_size), 0)
		FROM posts p
		LEFT JOIN attachments a ON p.id = a.post_id
		GROUP BY p.id, p.category_id
		HAVING COUNT(a.id) > 0
	`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var postStats []PostFileStats
	for rows.Next() {
		var stat PostFileStats
		if err := rows.Scan(&stat.PostID, &stat.CategoryID, &stat.FileCount, &stat.TotalSize); err != nil {
			return nil, err
		}
		postStats = append(postStats, stat)
	}

	return postStats, nil
}