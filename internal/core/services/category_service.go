package services

import (
	"backthynk/internal/core/cache"
	"backthynk/internal/core/events"
	"backthynk/internal/core/models"
	"backthynk/internal/storage"
	"fmt"
	"os"
	"path/filepath"
)

type CategoryService struct {
	db         *storage.DB
	cache      *cache.CategoryCache
	dispatcher *events.Dispatcher
}

func NewCategoryService(db *storage.DB, cache *cache.CategoryCache, dispatcher *events.Dispatcher) *CategoryService {
	return &CategoryService{
		db:         db,
		cache:      cache,
		dispatcher: dispatcher,
	}
}

func (s *CategoryService) InitializeCache() error {
	categories, err := s.db.GetCategories()
	if err != nil {
		return fmt.Errorf("failed to load categories: %w", err)
	}
	
	// Load post counts
	postCounts, err := s.db.GetAllCategoryPostCounts()
	if err != nil {
		return fmt.Errorf("failed to load post counts: %w", err)
	}
	
	// Build cache
	for _, cat := range categories {
		if count, ok := postCounts[cat.ID]; ok {
			cat.PostCount = count
		}
		s.cache.Set(&cat)
	}
	
	// Calculate recursive counts
	for _, cat := range categories {
		recursiveCount := s.calculateRecursivePostCount(cat.ID)
		if cached, ok := s.cache.Get(cat.ID); ok {
			cached.RecursivePostCount = recursiveCount
		}
	}
	
	return nil
}

func (s *CategoryService) calculateRecursivePostCount(categoryID int) int {
	cat, ok := s.cache.Get(categoryID)
	if !ok {
		return 0
	}
	
	count := cat.PostCount
	descendants := s.cache.GetDescendants(categoryID)
	
	for _, descID := range descendants {
		if descCat, ok := s.cache.Get(descID); ok {
			count += descCat.PostCount
		}
	}
	
	return count
}

func (s *CategoryService) GetAll() []*models.Category {
	return s.cache.GetAll()
}

func (s *CategoryService) Get(id int) (*models.Category, error) {
	if cat, ok := s.cache.Get(id); ok {
		return cat, nil
	}
	
	// Fallback to database
	cat, err := s.db.GetCategory(id)
	if err != nil {
		return nil, err
	}
	
	// Update cache
	s.cache.Set(cat)
	return cat, nil
}

func (s *CategoryService) Create(name string, parentID *int, description string) (*models.Category, error) {
	cat, err := s.db.CreateCategory(name, parentID, description)
	if err != nil {
		return nil, err
	}
	
	// Update cache
	cat.PostCount = 0
	cat.RecursivePostCount = 0
	s.cache.Set(cat)
	
	// Dispatch event
	s.dispatcher.Dispatch(events.Event{
		Type: events.CategoryCreated,
		Data: events.CategoryEvent{CategoryID: cat.ID},
	})
	
	return cat, nil
}

func (s *CategoryService) Update(id int, name, description string, parentID *int) (*models.Category, error) {
	oldCat, _ := s.cache.Get(id)
	
	cat, err := s.db.UpdateCategory(id, name, description, parentID)
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
		Type: events.CategoryUpdated,
		Data: events.CategoryEvent{
			CategoryID:  cat.ID,
			OldParentID: oldCat.ParentID,
			NewParentID: parentID,
		},
	})
	
	return cat, nil
}

func (s *CategoryService) Delete(id int) error {
	// Get parent information before deletion for event
	var parentID *int
	if cat, ok := s.cache.Get(id); ok {
		parentID = cat.ParentID
	}

	// Get all affected categories (including descendants)
	descendants := s.cache.GetDescendants(id)
	allCategories := append([]int{id}, descendants...)

	// Fire PostDeleted events and handle file cleanup for all posts
	// This must happen BEFORE database deletion so detailed stats service gets the events
	var affectedPosts []int
	for _, catID := range allCategories {
		postIDs, _ := s.db.GetPostIDsByCategory(catID)
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
	if err := s.db.DeleteCategory(id); err != nil {
		return err
	}

	// Update cache - remove deleted categories
	for _, catID := range allCategories {
		s.cache.Delete(catID)
	}

	// Dispatch CategoryDeleted event (for any services that need to know about category deletion itself)
	s.dispatcher.Dispatch(events.Event{
		Type: events.CategoryDeleted,
		Data: events.CategoryEvent{
			CategoryID:    id,
			OldParentID:   parentID, // Include parent info for stats updates
			AffectedPosts: affectedPosts,
		},
	})

	return nil
}

// firePostDeletedEvent fires a PostDeleted event for a specific post, including file information
func (s *CategoryService) firePostDeletedEvent(postID, categoryID int) error {
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
			CategoryID: categoryID,
			Timestamp:  post.Created,
			FileSize:   totalSize,
			FileCount:  len(attachments),
		},
	})

	return nil
}