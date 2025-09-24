package config

// Application Configuration Constants
const (
	// Server Configuration
	DefaultServerPort = "8080"
	ConfigFilename    = "options.json"
	DatabaseFilename  = "app.db"
	UploadsSubdir     = "uploads"

	// File Permissions
	DirectoryPermissions = 0755
	FilePermissions      = 0644

	// Default Application Settings
	DefaultMaxFileSizeMB    = 100
	DefaultMaxContentLength = 15000
	DefaultMaxFilesPerPost  = 20
	DefaultStoragePath      = ".storage"

	// Validation Limits
	MinFileSizeMB    = 1
	MaxFileSizeMB    = 10240 // 10GB
	MinContentLength = 100
	MaxContentLength = 50000
	MinFilesPerPost  = 1
	MaxFilesPerPost  = 50

	// Category Configuration
	MaxCategoryDepth = 2
	DefaultDepth     = 0

	// Post Pagination
	DefaultPostLimit = 20
	MaxPostLimit     = 100
	DefaultOffset    = 0

	// HTTP Configuration
	LinkPreviewTimeout = 10 // seconds
	UserAgent         = "Mozilla/5.0 (compatible; LinkPreviewBot/1.0)"

	// Database Configuration
	SQLiteConnectionOptions = "?_fk=1"
)

// Error Messages
const (
	ErrMaxDepthExceeded     = "maximum category depth (3) exceeded"
	ErrFileSizeValidation   = "maxFileSizeMB must be between 1 and 10240 (10GB)"
	ErrContentLengthValidation = "maxContentLength must be between 100 and 50000"
	ErrFilesPerPostValidation  = "maxFilesPerPost must be between 1 and 50"
)