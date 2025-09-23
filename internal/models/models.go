package models

import "time"

type Category struct {
	ID       int    `json:"id" db:"id"`
	Name     string `json:"name" db:"name"`
	ParentID *int   `json:"parent_id" db:"parent_id"`
	Depth    int    `json:"depth" db:"depth"`
	Created  time.Time `json:"created" db:"created"`
}

type CategoryStats struct {
	PostCount    int        `json:"post_count"`
	FileCount    int        `json:"file_count"`
	TotalSize    int64      `json:"total_size"`
	LastPostTime *time.Time `json:"last_post_time,omitempty"`
}

type CategoryWithStats struct {
	Category
	PostCount    int        `json:"post_count"`
	FileCount    int        `json:"file_count"`
	TotalSize    int64      `json:"total_size"`
	LastPostTime *time.Time `json:"last_post_time,omitempty"`
}

type Post struct {
	ID         int       `json:"id" db:"id"`
	CategoryID int       `json:"category_id" db:"category_id"`
	Content    string    `json:"content" db:"content"`
	Created    time.Time `json:"created" db:"created"`
}

type Attachment struct {
	ID       int    `json:"id" db:"id"`
	PostID   int    `json:"post_id" db:"post_id"`
	Filename string `json:"filename" db:"filename"`
	FilePath string `json:"file_path" db:"file_path"`
	FileType string `json:"file_type" db:"file_type"`
	FileSize int64  `json:"file_size" db:"file_size"`
}

type PostWithAttachments struct {
	Post
	Attachments []Attachment `json:"attachments"`
}