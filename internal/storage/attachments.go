package storage

import (
	"backthynk/internal/models"
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

