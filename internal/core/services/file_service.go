package services

import (
	"backthynk/internal/config"
	"backthynk/internal/core/events"
	"backthynk/internal/core/models"
	"backthynk/internal/storage"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"os"
	"path/filepath"
	"time"
)

type FileService struct {
	db         *storage.DB
	dispatcher *events.Dispatcher
	uploadPath string
}

func NewFileService(db *storage.DB, dispatcher *events.Dispatcher) *FileService {
	uploadPath := filepath.Join(config.GetServiceConfig().Files.StoragePath, config.GetServiceConfig().Files.UploadsSubdir)
	return &FileService{
		db:         db,
		dispatcher: dispatcher,
		uploadPath: uploadPath,
	}
}

func (s *FileService) UploadFile(postID int, file io.Reader, filename string, fileSize int64) (*models.Attachment, error) {
	// Create unique filename
	timestamp := time.Now().Unix()
	storedFilename := fmt.Sprintf("%d_%s", timestamp, filename)
	filePath := filepath.Join(s.uploadPath, storedFilename)
	
	// Ensure upload directory exists
	if err := os.MkdirAll(s.uploadPath, config.DirectoryPermissions); err != nil {
		return nil, fmt.Errorf("failed to create upload directory: %w", err)
	}
	
	// Save file
	dst, err := os.Create(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to create file: %w", err)
	}
	defer dst.Close()
	
	written, err := io.Copy(dst, file)
	if err != nil {
		os.Remove(filePath)
		return nil, fmt.Errorf("failed to save file: %w", err)
	}
	
	// Detect file type
	fileType := mime.TypeByExtension(filepath.Ext(filename))
	if fileType == "" {
		fileType = "application/octet-stream"
	}
	
	// Save to database
	attachment, err := s.db.CreateAttachment(postID, filename, storedFilename, fileType, written)
	if err != nil {
		os.Remove(filePath)
		return nil, fmt.Errorf("failed to save attachment info: %w", err)
	}
	
	// Get post to find category for event
	post, err := s.db.GetPost(postID)
	if err == nil {
		// Dispatch event
		s.dispatcher.Dispatch(events.Event{
			Type: events.FileUploaded,
			Data: events.PostEvent{
				PostID:     postID,
				CategoryID: post.CategoryID,
				FileSize:   written,
				FileCount:  1,
			},
		})
	}
	
	return attachment, nil
}

func (s *FileService) GetPostWithAttachments(postID int) (*models.PostWithAttachments, error) {
	post, err := s.db.GetPost(postID)
	if err != nil {
		return nil, err
	}
	
	attachments, err := s.db.GetAttachmentsByPost(postID)
	if err != nil {
		return nil, err
	}
	
	linkPreviews, err := s.db.GetLinkPreviewsByPostID(postID)
	if err != nil {
		return nil, err
	}
	
	return &models.PostWithAttachments{
		Post:         *post,
		Attachments:  attachments,
		LinkPreviews: linkPreviews,
	}, nil
}

func (s *FileService) SaveLinkPreview(postID int, preview interface{}) error {
	// Convert preview data to LinkPreview model
	switch p := preview.(type) {
	case map[string]interface{}:
		linkPreview := &models.LinkPreview{
			PostID:      postID,
			URL:         getString(p, "url"),
			Title:       getString(p, "title"),
			Description: getString(p, "description"),
			ImageURL:    getString(p, "image_url"),
			SiteName:    getString(p, "site_name"),
		}
		return s.db.CreateLinkPreview(linkPreview)
	default:
		// Try reflection for any struct with proper field names
		if preview != nil {
			// Use JSON marshaling/unmarshaling to convert
			jsonData, err := json.Marshal(preview)
			if err != nil {
				return fmt.Errorf("failed to marshal preview: %w", err)
			}

			var previewMap map[string]interface{}
			if err := json.Unmarshal(jsonData, &previewMap); err != nil {
				return fmt.Errorf("failed to unmarshal preview: %w", err)
			}

			linkPreview := &models.LinkPreview{
				PostID:      postID,
				URL:         getString(previewMap, "url"),
				Title:       getString(previewMap, "title"),
				Description: getString(previewMap, "description"),
				ImageURL:    getString(previewMap, "image_url"),
				SiteName:    getString(previewMap, "site_name"),
			}
			return s.db.CreateLinkPreview(linkPreview)
		}
		return fmt.Errorf("unsupported preview type: %T", preview)
	}
}

func getString(m map[string]interface{}, key string) string {
	if val, ok := m[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return ""
}

func (s *FileService) GetTotalPostCount() (int, error) {
	return s.db.GetTotalPostCount()
}