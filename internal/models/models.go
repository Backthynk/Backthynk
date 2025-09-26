package models

type Category struct {
	ID          int    `json:"id" db:"id"`
	Name        string `json:"name" db:"name"`
	Description string `json:"description" db:"description"`
	ParentID    *int   `json:"parent_id" db:"parent_id"`
	Depth       int    `json:"depth" db:"depth"`
	Created     int64  `json:"created" db:"created"`
}


type Post struct {
	ID         int       `json:"id" db:"id"`
	CategoryID int       `json:"category_id" db:"category_id"`
	Content    string    `json:"content" db:"content"`
	Created    int64 `json:"created" db:"created"`
}

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

type PostWithAttachments struct {
	Post
	Attachments  []Attachment  `json:"attachments"`
	LinkPreviews []LinkPreview `json:"link_previews"`
}

type Options struct {
	MaxFileSizeMB            int  `json:"maxFileSizeMB"`
	MaxContentLength         int  `json:"maxContentLength"`
	MaxFilesPerPost          int  `json:"maxFilesPerPost"`
	ActivityEnabled          bool `json:"activityEnabled"`
	FileStatsEnabled         bool `json:"fileStatsEnabled"`
	RetroactivePostingEnabled bool `json:"retroactivePostingEnabled"`
}