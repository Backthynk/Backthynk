package models

type Attachment struct {
	ID       int    `json:"id" db:"id"`
	PostID   int    `json:"post_id" db:"post_id"`
	Filename string `json:"filename" db:"filename"`
	FilePath string `json:"file_path" db:"file_path"`
	FileType string `json:"file_type" db:"file_type"`
	FileSize int64  `json:"file_size" db:"file_size"`
}

type LinkPreview struct {
	ID          int    `json:"id" db:"id"`
	PostID      int    `json:"post_id" db:"post_id"`
	URL         string `json:"url" db:"url"`
	Title       string `json:"title" db:"title"`
	Description string `json:"description" db:"description"`
	ImageURL    string `json:"image_url" db:"image_url"`
	SiteName    string `json:"site_name" db:"site_name"`
}