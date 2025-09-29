package events

type EventType string

const (
	// Post events
	PostCreated EventType = "post.created"
	PostDeleted EventType = "post.deleted"
	PostMoved   EventType = "post.moved"
	
	// Category events
	CategoryCreated EventType = "category.created"
	CategoryUpdated EventType = "category.updated"
	CategoryDeleted EventType = "category.deleted"
	
	// File events
	FileUploaded EventType = "file.uploaded"
	FileDeleted  EventType = "file.deleted"
)

type Event struct {
	Type EventType
	Data interface{}
}

// Event data structures
type PostEvent struct {
	PostID     int
	CategoryID int
	OldCategoryID *int // For move events
	Timestamp  int64
	FileSize   int64  // For file events
	FileCount  int    // For file events
}

type CategoryEvent struct {
	CategoryID    int
	OldParentID   *int
	NewParentID   *int
	AffectedPosts []int
}