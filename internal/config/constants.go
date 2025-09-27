package config

// Application Configuration Constants
const (

	// File Permissions
	DirectoryPermissions = 0755
	FilePermissions      = 0644

	// Default Application Settings
	DefaultMaxFileSizeMB             = 100
	DefaultMaxContentLength          = 15000
	DefaultMaxFilesPerPost           = 20
	DefaultActivityEnabled           = true
	DefaultFileStatsEnabled          = true
	DefaultCategoryCacheEnabled      = true
	DefaultRetroactivePostingEnabled = false

	// Validation Limits
	MinFileSizeMB    = 1
	MaxFileSizeMB    = 10240 // 10GB
	MinContentLength = 100
	MaxContentLength = 50000
	MinFilesPerPost  = 1
	MaxFilesPerPost  = 50

	// Category Configuration
	MaxCategoryDepth             = 2
	DefaultDepth                 = 0
	ALL_CATEGORIES_ID            = 0 // Special category ID representing "all categories" view
	MaxCategoryNameLength        = 30
	MaxCategoryDescriptionLength = 280

	// Post Pagination
	DefaultPostLimit = 20
	MaxPostLimit     = 100
	DefaultOffset    = 0

	// HTTP Configuration
	LinkPreviewTimeout = 10 // seconds
	UserAgent          = "Mozilla/5.0 (compatible; LinkPreviewBot/1.0)"

	// Database Configuration
	SQLiteConnectionOptions = "?_fk=1"

	// Retroactive Posting Configuration
	MinRetroactivePostTimestamp = 946684800000 // 01/01/2000 00:00:00 UTC in milliseconds

	// Activity Configuration
	DefaultActivityPeriodMonths = 4 // Number of months to show in activity heatmap
)

// Error Messages
const (
	ErrMaxDepthExceeded        = "maximum category depth (3) exceeded"
	ErrFileSizeValidation      = "maxFileSizeMB must be between 1 and 10240 (10GB)"
	ErrContentLengthValidation = "maxContentLength must be between 100 and 50000"
	ErrFilesPerPostValidation  = "maxFilesPerPost must be between 1 and 50"
)

// Configuration getters that use service.json values
func ServerPort() string {
	return GetServiceConfig().Server.Port
}

func ConfigFilename() string {
	return GetServiceConfig().Files.ConfigFilename
}

func DatabaseFilename() string {
	return GetServiceConfig().Files.DatabaseFilename
}

func UploadsSubdir() string {
	return GetServiceConfig().Files.UploadsSubdir
}

func StoragePath() string {
	return GetServiceConfig().Files.StoragePath
}
