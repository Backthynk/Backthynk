package config

// Error messages for API handlers
const (
	// JSON and Request Errors
	ErrInvalidJSON        = "Invalid JSON"
	ErrInvalidRequestBody = "Invalid request body"

	// ID Validation Errors
	ErrInvalidPostID     = "Invalid post ID"
	ErrInvalidCategoryID = "Invalid category ID"
	ErrInvalidParentID   = "Invalid parent_id"

	// Required Field Errors
	ErrContentRequired          = "Content is required"
	ErrNameRequired             = "Name is required"
	ErrPostIDRequired           = "post_id is required"
	ErrValidCategoryIDRequired  = "Valid category_id is required"

	// Feature Disabled Errors
	ErrFileUploadDisabled        = "File upload is disabled"
	ErrRetroactivePostingDisabled = "Retroactive posting is disabled"

	// File Upload Errors
	ErrFailedToParseForm = "Failed to parse multipart form"
	ErrFailedToGetFile   = "Failed to get file"
	ErrAccessDenied      = "Access denied"

	// Post Errors
	ErrPostNotFound            = "Post not found"
	ErrFailedToRetrievePost    = "Failed to retrieve updated post"
	ErrFailedToGetPosts        = "Failed to get posts"
	ErrTimestampTooEarly       = "Custom timestamp cannot be earlier than 01/01/2000"

	// Settings Errors
	ErrFailedToMarshalSettings = "Failed to marshal settings"

	// Template Errors
	ErrTemplateParsingError   = "Template parsing error"
	ErrTemplateExecutionError = "Template execution error"

	// Link Preview Errors
	ErrInvalidURL      = "Invalid URL"
	ErrURLNotHTML      = "URL does not return HTML content"

	// Activity Feature Errors
	ErrFailedToGetActivity = "Failed to get activity data: "
)

// Error message format strings (for dynamic error messages)
const (
	ErrFmtFailedToSaveSettings     = "Failed to save settings: %v"
	ErrFmtContentExceedsMaxLength  = "Content exceeds maximum length of %d characters"
	ErrFmtFileSizeExceedsMax       = "File size exceeds maximum allowed (%dMB)"
	ErrFmtFileExtensionNotAllowed  = "File extension '%s' is not allowed"
)

// Validation error messages
const (
	ErrValidationMaxFileSizeRange     = "maxFileSizeMB must be between 1 and 10240"
	ErrValidationMaxContentLengthRange = "maxContentLength must be between 100 and 50000"
	ErrValidationMaxFilesPerPostRange  = "maxFilesPerPost must be between 1 and 50"
	ErrValidationSiteTitleRange        = "siteTitle must be between 1 and 100 characters"
	ErrValidationSiteDescriptionMax    = "siteDescription must not exceed 160 characters"
)
