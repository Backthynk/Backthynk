package preview

import (
	"backthynk/internal/config"
	"backthynk/internal/core/events"
	"backthynk/internal/core/logger"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/disintegration/imaging"
	"github.com/unidoc/unipdf/v3/model"
	"github.com/unidoc/unipdf/v3/render"
	"go.uber.org/zap"
)

const PreviewSubdir = "previews"

type Service struct {
	uploadPath  string
	previewPath string
	dispatcher  *events.Dispatcher
	options     *config.OptionsConfig
}

func NewService(uploadPath string, dispatcher *events.Dispatcher, options *config.OptionsConfig) *Service {
	previewPath := filepath.Join(uploadPath, PreviewSubdir)
	return &Service{
		uploadPath:  uploadPath,
		previewPath: previewPath,
		dispatcher:  dispatcher,
		options:     options,
	}
}

// IsPreviewSupported checks if the file extension supports preview generation
func (s *Service) IsPreviewSupported(filename string) bool {
	if !s.options.Features.Preview.Enabled {
		return false
	}

	ext := strings.ToLower(filepath.Ext(filename))
	if ext != "" {
		ext = ext[1:] // Remove the leading dot
	}

	for _, format := range s.options.Features.Preview.SupportedFormats {
		if ext == format {
			return true
		}
	}
	return false
}

// GetPreviewPath returns the path for a preview file
func (s *Service) GetPreviewPath(originalFilename string, size string) string {
	// Normalize size to canonical name
	normalizedSize := s.normalizeSize(size)
	if normalizedSize == "" {
		normalizedSize = size // fallback to original if not recognized
	}

	baseFilename := strings.TrimSuffix(originalFilename, filepath.Ext(originalFilename))
	previewFilename := fmt.Sprintf("%s_preview_%s.jpg", baseFilename, normalizedSize)
	return filepath.Join(PreviewSubdir, previewFilename)
}

// PreviewExists checks if a preview file already exists
func (s *Service) PreviewExists(previewPath string) bool {
	fullPath := filepath.Join(s.uploadPath, previewPath)
	_, err := os.Stat(fullPath)
	return err == nil
}

// GeneratePreview creates a preview image at the specified size
func (s *Service) GeneratePreview(originalPath string, originalFilename string, size string) (string, error) {
	if !s.options.Features.Preview.Enabled {
		return "", fmt.Errorf("preview feature is disabled")
	}

	// Normalize size to canonical name (e.g., "big" -> "large")
	size = s.normalizeSize(size)
	if size == "" {
		return "", fmt.Errorf("invalid preview size")
	}

	// Get the target width for this size
	width := s.getWidthForSize(size)
	if width == 0 {
		err := fmt.Errorf("invalid preview size: %s", size)
		return "", err
	}

	// Ensure preview directory exists
	if err := os.MkdirAll(s.previewPath, config.DirectoryPermissions); err != nil {
		logger.Error("Failed to create preview directory", zap.String("path", s.previewPath), zap.Error(err))
		return "", fmt.Errorf("failed to create preview directory: %w", err)
	}

	// Determine the file type and generate preview accordingly
	ext := strings.ToLower(filepath.Ext(originalPath))

	var previewPath string
	var err error

	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp":
		previewPath, err = s.generateImagePreview(originalPath, originalFilename, size, width)
	case ".pdf":
		previewPath, err = s.generatePDFPreview(originalPath, originalFilename, size, width)
	default:
		err = fmt.Errorf("unsupported format for preview: %s", ext)
	}

	if err != nil {
		return "", err
	}

	// Dispatch preview generated event
	s.dispatcher.Dispatch(events.Event{
		Type: events.PreviewGenerated,
		Data: events.PreviewEvent{
			Filename:     originalFilename,
			Size:         size,
			OriginalPath: originalPath,
			PreviewPath:  previewPath,
		},
	})

	return previewPath, nil
}

func (s *Service) generateImagePreview(originalPath string, originalFilename string, size string, width int) (string, error) {
	// Open the image
	img, err := imaging.Open(originalPath)
	if err != nil {
		logger.Error("Failed to open image for preview", zap.String("path", originalPath), zap.Error(err))
		return "", fmt.Errorf("failed to open image: %w", err)
	}

	// Generate preview filename and path
	previewRelPath := s.GetPreviewPath(originalFilename, size)
	previewAbsPath := filepath.Join(s.uploadPath, previewRelPath)

	// Resize maintaining aspect ratio
	resized := imaging.Resize(img, width, 0, imaging.Lanczos)

	// Save as JPEG with configured quality
	quality := s.options.Features.Preview.JpegQuality
	if quality == 0 {
		quality = 85 // Default
	}

	if err := imaging.Save(resized, previewAbsPath, imaging.JPEGQuality(quality)); err != nil {
		logger.Error("Failed to save preview image",
			zap.String("path", previewAbsPath),
			zap.Int("width", width),
			zap.Error(err))
		return "", fmt.Errorf("failed to save preview: %w", err)
	}

	logger.Info("Generated preview",
		zap.String("original", originalFilename),
		zap.String("size", size),
		zap.Int("width", width),
		zap.String("preview", previewRelPath))

	return previewRelPath, nil
}

func (s *Service) generatePDFPreview(originalPath string, originalFilename string, size string, width int) (string, error) {
	// Open the PDF file
	f, err := os.Open(originalPath)
	if err != nil {
		logger.Error("Failed to open PDF", zap.String("path", originalPath), zap.Error(err))
		return "", fmt.Errorf("failed to open PDF: %w", err)
	}
	defer f.Close()

	// Read the PDF
	pdfReader, err := model.NewPdfReader(f)
	if err != nil {
		logger.Error("Failed to read PDF", zap.String("path", originalPath), zap.Error(err))
		return "", fmt.Errorf("failed to read PDF: %w", err)
	}

	// Get the first page
	numPages, err := pdfReader.GetNumPages()
	if err != nil || numPages == 0 {
		logger.Error("Failed to get PDF pages", zap.String("path", originalPath), zap.Error(err))
		return "", fmt.Errorf("failed to get PDF pages: %w", err)
	}

	page, err := pdfReader.GetPage(1)
	if err != nil {
		logger.Error("Failed to get first page", zap.String("path", originalPath), zap.Error(err))
		return "", fmt.Errorf("failed to get first page: %w", err)
	}

	// Create a device for rendering
	device := render.NewImageDevice()

	// Render the page to an image
	img, err := device.Render(page)
	if err != nil {
		logger.Error("Failed to render PDF page", zap.String("path", originalPath), zap.Error(err))
		return "", fmt.Errorf("failed to render PDF page: %w", err)
	}

	// Generate preview filename and path
	previewRelPath := s.GetPreviewPath(originalFilename, size)
	previewAbsPath := filepath.Join(s.uploadPath, previewRelPath)

	// Resize the rendered image maintaining aspect ratio
	resized := imaging.Resize(img, width, 0, imaging.Lanczos)

	// Save as JPEG with configured quality
	quality := s.options.Features.Preview.JpegQuality
	if quality == 0 {
		quality = 85 // Default
	}

	if err := imaging.Save(resized, previewAbsPath, imaging.JPEGQuality(quality)); err != nil {
		logger.Error("Failed to save PDF preview",
			zap.String("path", previewAbsPath),
			zap.Int("width", width),
			zap.Error(err))
		return "", fmt.Errorf("failed to save PDF preview: %w", err)
	}

	logger.Info("Generated PDF preview",
		zap.String("original", originalFilename),
		zap.String("size", size),
		zap.Int("width", width),
		zap.String("preview", previewRelPath))

	return previewRelPath, nil
}

// normalizeSize converts size adjectives to canonical size names
func (s *Service) normalizeSize(size string) string {
	switch size {
	case "large", "big":
		return "large"
	case "medium", "med":
		return "medium"
	case "small":
		return "small"
	default:
		return ""
	}
}

func (s *Service) getWidthForSize(size string) int {
	normalized := s.normalizeSize(size)
	switch normalized {
	case "large":
		return s.options.Features.Preview.Sizes.Large
	case "medium":
		return s.options.Features.Preview.Sizes.Medium
	case "small":
		return s.options.Features.Preview.Sizes.Small
	default:
		return 0
	}
}
// CleanupPreviews removes all preview files for a given original filename
func (s *Service) CleanupPreviews(originalFilename string) error {
	sizes := []string{"large", "medium", "small"}
	var errs []error

	for _, size := range sizes {
		previewPath := s.GetPreviewPath(originalFilename, size)
		fullPath := filepath.Join(s.uploadPath, previewPath)

		if err := os.Remove(fullPath); err != nil && !os.IsNotExist(err) {
			logger.Error("Failed to remove preview file", zap.String("path", fullPath), zap.Error(err))
			errs = append(errs, err)
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("failed to cleanup %d preview files", len(errs))
	}

	return nil
}
