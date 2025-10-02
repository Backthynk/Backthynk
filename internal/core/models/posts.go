package models

type Post struct {
	ID               int    `json:"id" db:"id"`
	CategoryID       int    `json:"category_id" db:"category_id"`
	Content          string `json:"content" db:"content"`
	Created          int64  `json:"created" db:"created"`
}

type PostWithAttachments struct {
	Post
	Attachments  []Attachment  `json:"attachments"`
	LinkPreviews []LinkPreview `json:"link_previews"`
}