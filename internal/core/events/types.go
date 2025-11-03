package events

type EventType string

const (
	// Post events
	PostCreated EventType = "post.created"
	PostDeleted EventType = "post.deleted"
	PostMoved   EventType = "post.moved"
	
	// Space events
	SpaceCreated EventType = "space.created"
	SpaceUpdated EventType = "space.updated"
	SpaceDeleted EventType = "space.deleted"
	
	// File events
	FileUploaded EventType = "file.uploaded"
	FileDeleted  EventType = "file.deleted"

	PreviewGenerated EventType = "preview.generated"
)

type Event struct {
	Type EventType
	Data interface{}
}

// Event data structures
type PostEvent struct {
	PostID     int
	SpaceID int
	OldSpaceID *int // For move events
	Timestamp  int64
	FileSize   int64  // For file events
	FileCount  int    // For file events
}

type SpaceEvent struct {
	SpaceID    int
	OldParentID   *int
	NewParentID   *int
	AffectedPosts []int
}

type PreviewEvent struct {
	Filename     string
	Size         string // "large", "medium", "small"
	OriginalPath string
	PreviewPath  string
	Error        error
}