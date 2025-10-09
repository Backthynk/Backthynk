package services

import (
	"backthynk/internal/core/cache"
	"backthynk/internal/core/events"
	"backthynk/internal/core/models"
	"backthynk/internal/storage"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type SpaceService struct {
	db         *storage.DB
	cache      *cache.SpaceCache
	dispatcher *events.Dispatcher
}

func NewSpaceService(db *storage.DB, cache *cache.SpaceCache, dispatcher *events.Dispatcher) *SpaceService {
	return &SpaceService{
		db:         db,
		cache:      cache,
		dispatcher: dispatcher,
	}
}

func (s *SpaceService) InitializeCache() error {
	spaces, err := s.db.GetSpaces()
	if err != nil {
		return fmt.Errorf("failed to load spaces: %w", err)
	}
	
	// Load post counts
	postCounts, err := s.db.GetAllSpacePostCounts()
	if err != nil {
		return fmt.Errorf("failed to load post counts: %w", err)
	}
	
	// Build cache
	for _, cat := range spaces {
		if count, ok := postCounts[cat.ID]; ok {
			cat.PostCount = count
		}
		s.cache.Set(&cat)
	}
	
	// Calculate recursive counts
	for _, cat := range spaces {
		recursiveCount := s.calculateRecursivePostCount(cat.ID)
		if cached, ok := s.cache.Get(cat.ID); ok {
			cached.RecursivePostCount = recursiveCount
		}
	}
	
	return nil
}

func (s *SpaceService) calculateRecursivePostCount(spaceID int) int {
	cat, ok := s.cache.Get(spaceID)
	if !ok {
		return 0
	}
	
	count := cat.PostCount
	descendants := s.cache.GetDescendants(spaceID)
	
	for _, descID := range descendants {
		if descCat, ok := s.cache.Get(descID); ok {
			count += descCat.PostCount
		}
	}
	
	return count
}

func (s *SpaceService) GetAll() []*models.Space {
	return s.cache.GetAll()
}

func (s *SpaceService) Get(id int) (*models.Space, error) {
	if cat, ok := s.cache.Get(id); ok {
		return cat, nil
	}
	
	// Fallback to database
	cat, err := s.db.GetSpace(id)
	if err != nil {
		return nil, err
	}
	
	// Update cache
	s.cache.Set(cat)
	return cat, nil
}

func (s *SpaceService) Create(name string, parentID *int, description string) (*models.Space, error) {
	cat, err := s.db.CreateSpace(name, parentID, description)
	if err != nil {
		return nil, err
	}
	
	// Update cache
	cat.PostCount = 0
	cat.RecursivePostCount = 0
	s.cache.Set(cat)
	
	// Dispatch event
	s.dispatcher.Dispatch(events.Event{
		Type: events.SpaceCreated,
		Data: events.SpaceEvent{SpaceID: cat.ID},
	})
	
	return cat, nil
}

func (s *SpaceService) Update(id int, name, description string, parentID *int) (*models.Space, error) {
	oldCat, _ := s.cache.Get(id)
	
	cat, err := s.db.UpdateSpace(id, name, description, parentID)
	if err != nil {
		return nil, err
	}
	
	// Check if hierarchy changed
	hierarchyChanged := false
	if oldCat != nil {
		if (oldCat.ParentID == nil && parentID != nil) ||
		   (oldCat.ParentID != nil && parentID == nil) ||
		   (oldCat.ParentID != nil && parentID != nil && *oldCat.ParentID != *parentID) {
			hierarchyChanged = true
		}
	}
	
	if hierarchyChanged {
		// Preserve post counts from the cached version
		cat.PostCount = oldCat.PostCount
		cat.RecursivePostCount = oldCat.RecursivePostCount
		// Update cache for hierarchy change
		s.cache.Set(cat)
		// Efficiently update recursive post counts
		s.cache.HandleHierarchyChange(cat.ID, oldCat.ParentID, parentID)
	} else {
		// Simple update
		cat.PostCount = oldCat.PostCount
		cat.RecursivePostCount = oldCat.RecursivePostCount
		s.cache.Set(cat)
	}
	
	// Dispatch event
	s.dispatcher.Dispatch(events.Event{
		Type: events.SpaceUpdated,
		Data: events.SpaceEvent{
			SpaceID:  cat.ID,
			OldParentID: oldCat.ParentID,
			NewParentID: parentID,
		},
	})
	
	return cat, nil
}

func (s *SpaceService) FindByNameAndParent(name string, parentID *int) *models.Space {
	allSpaces := s.cache.GetAll()
	nameLower := strings.ToLower(name)

	for _, cat := range allSpaces {
		if strings.ToLower(cat.Name) == nameLower {
			// Check if parent matches
			if (parentID == nil && cat.ParentID == nil) ||
				(parentID != nil && cat.ParentID != nil && *parentID == *cat.ParentID) {
				return cat
			}
		}
	}
	return nil
}

func (s *SpaceService) GetSpaceBreadcrumb(spaceID int) string {
	cat, ok := s.cache.Get(spaceID)
	if !ok {
		return ""
	}

	// Build breadcrumb from ancestors
	ancestors := s.cache.GetAncestors(spaceID)

	// Reverse ancestors to get root -> parent order
	breadcrumb := ""
	for i := len(ancestors) - 1; i >= 0; i-- {
		if ancestorCat, ok := s.cache.Get(ancestors[i]); ok {
			if breadcrumb != "" {
				breadcrumb += " > "
			}
			breadcrumb += ancestorCat.Name
		}
	}

	// Add current space
	if breadcrumb != "" {
		breadcrumb += " > "
	}
	breadcrumb += cat.Name

	return breadcrumb
}

func (s *SpaceService) Delete(id int) error {
	// Get parent information before deletion for event
	var parentID *int
	if cat, ok := s.cache.Get(id); ok {
		parentID = cat.ParentID
	}

	// Get all affected spaces (including descendants)
	descendants := s.cache.GetDescendants(id)
	allSpaces := append([]int{id}, descendants...)

	// Fire PostDeleted events and handle file cleanup for all posts
	// This must happen BEFORE database deletion so detailed stats service gets the events
	var affectedPosts []int
	for _, catID := range allSpaces {
		postIDs, _ := s.db.GetPostIDsBySpace(catID)
		affectedPosts = append(affectedPosts, postIDs...)

		// For each post, handle file cleanup and fire PostDeleted event
		for _, postID := range postIDs {
			// Fire PostDeleted event for statistics
			if err := s.firePostDeletedEvent(postID, catID); err != nil {
				// Log error but continue with other posts
				// TODO: Add proper logging
				continue
			}

			// Update cache post counts (same logic as PostService.Delete)
			s.cache.UpdatePostCount(catID, -1)
		}
	}

	// Delete from database (CASCADE will handle posts and attachments at DB level)
	if err := s.db.DeleteSpace(id); err != nil {
		return err
	}

	// Update cache - remove deleted spaces
	for _, catID := range allSpaces {
		s.cache.Delete(catID)
	}

	// Dispatch SpaceDeleted event (for any services that need to know about space deletion itself)
	s.dispatcher.Dispatch(events.Event{
		Type: events.SpaceDeleted,
		Data: events.SpaceEvent{
			SpaceID:    id,
			OldParentID:   parentID, // Include parent info for stats updates
			AffectedPosts: affectedPosts,
		},
	})

	return nil
}

// firePostDeletedEvent fires a PostDeleted event for a specific post, including file information
func (s *SpaceService) firePostDeletedEvent(postID, spaceID int) error {
	// Get post details
	post, err := s.db.GetPost(postID)
	if err != nil {
		return err
	}

	// Get attachments for file stats
	attachments, err := s.db.GetAttachmentsByPost(postID)
	if err != nil {
		return err
	}

	// Delete physical files (same pattern as in storage/posts.go)
	uploadsDir := filepath.Join(s.db.GetStoragePath(), "uploads")
	for _, attachment := range attachments {
		fullPath := filepath.Join(uploadsDir, attachment.FilePath)
		os.Remove(fullPath) // Ignore errors like in posts.go
	}



	// Calculate total file size
	var totalSize int64
	for _, att := range attachments {
		totalSize += att.FileSize
	}

	// Dispatch PostDeleted event (same as PostService.Delete does)
	s.dispatcher.Dispatch(events.Event{
		Type: events.PostDeleted,
		Data: events.PostEvent{
			PostID:     postID,
			SpaceID: spaceID,
			Timestamp:  post.Created,
			FileSize:   totalSize,
			FileCount:  len(attachments),
		},
	})

	return nil
}