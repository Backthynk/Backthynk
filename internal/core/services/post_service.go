package services

import (
	"backthynk/internal/config"
	"backthynk/internal/core/cache"
	"backthynk/internal/core/events"
	"backthynk/internal/core/models"
	"backthynk/internal/core/utils"
	"backthynk/internal/storage"
)

type PostService struct {
	db         *storage.DB
	cache      *cache.CategoryCache
	dispatcher *events.Dispatcher
	options    *config.OptionsConfig
}

func NewPostService(db *storage.DB, cache *cache.CategoryCache, dispatcher *events.Dispatcher) *PostService {
	return &PostService{
		db:         db,
		cache:      cache,
		dispatcher: dispatcher,
		options:    config.GetOptionsConfig(),
	}
}

func (s *PostService) Create(categoryID int, content string, customTimestamp *int64) (*models.Post, error) {
	var post *models.Post
	var err error

	if customTimestamp != nil {
		post, err = s.db.CreatePostWithTimestamp(categoryID, content, *customTimestamp)
	} else {
		post, err = s.db.CreatePost(categoryID, content)
	}

	if err != nil {
		return nil, err
	}

	// Process content on-the-fly for the response
	if s.options != nil && s.options.Features.Markdown.Enabled {
		post.Content = utils.ProcessMarkdown(post.Content)
	}

	// Update cache
	s.cache.UpdatePostCount(categoryID, 1)
	
	// Dispatch event
	s.dispatcher.Dispatch(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{
			PostID:     post.ID,
			CategoryID: categoryID,
			Timestamp:  post.Created,
		},
	})
	
	return post, nil
}

func (s *PostService) Delete(id int) error {
	post, err := s.db.GetPost(id)
	if err != nil {
		return err
	}
	
	// Get attachments before deletion
	attachments, _ := s.db.GetAttachmentsByPost(id)
	
	// Delete post
	if err := s.db.DeletePost(id); err != nil {
		return err
	}
	
	// Update cache
	s.cache.UpdatePostCount(post.CategoryID, -1)
	
	// Calculate total file size
	var totalSize int64
	for _, att := range attachments {
		totalSize += att.FileSize
	}
	
	// Dispatch event
	s.dispatcher.Dispatch(events.Event{
		Type: events.PostDeleted,
		Data: events.PostEvent{
			PostID:     id,
			CategoryID: post.CategoryID,
			Timestamp:  post.Created,
			FileSize:   totalSize,
			FileCount:  len(attachments),
		},
	})
	
	return nil
}


func (s *PostService) Move(postID int, newCategoryID int) error {
	post, err := s.db.GetPost(postID)
	if err != nil {
		return err
	}
	
	oldCategoryID := post.CategoryID
	
	// Update in database
	if err := s.db.UpdatePostCategory(postID, newCategoryID); err != nil {
		return err
	}
	
	// Update cache
	s.cache.UpdatePostCount(oldCategoryID, -1)
	s.cache.UpdatePostCount(newCategoryID, 1)
	
	// Get attachments for file stats
	attachments, _ := s.db.GetAttachmentsByPost(postID)
	var totalSize int64
	for _, att := range attachments {
		totalSize += att.FileSize
	}
	
	// Dispatch event
	s.dispatcher.Dispatch(events.Event{
		Type: events.PostMoved,
		Data: events.PostEvent{
			PostID:        postID,
			CategoryID:    newCategoryID,
			OldCategoryID: &oldCategoryID,
			Timestamp:     post.Created,
			FileSize:      totalSize,
			FileCount:     len(attachments),
		},
	})
	
	return nil
}

func (s *PostService) GetByCategory(categoryID int, recursive bool, limit, offset int) ([]models.PostWithAttachments, error) {
	var descendants []int
	if recursive {
		descendants = s.cache.GetDescendants(categoryID)
	}
	posts, err := s.db.GetPostsByCategoryRecursive(categoryID, recursive, limit, offset, descendants)
	if err != nil {
		return nil, err
	}

	// Process content on-the-fly for each post
	if s.options != nil && s.options.Features.Markdown.Enabled {
		for i := range posts {
			posts[i].Content = utils.ProcessMarkdown(posts[i].Content)
		}
	}

	return posts, nil
}

func (s *PostService) GetAllPosts(limit, offset int) ([]models.PostWithAttachments, error) {
	posts, err := s.db.GetAllPosts(limit, offset)
	if err != nil {
		return nil, err
	}

	// Process content on-the-fly for each post
	if s.options != nil && s.options.Features.Markdown.Enabled {
		for i := range posts {
			posts[i].Content = utils.ProcessMarkdown(posts[i].Content)
		}
	}

	return posts, nil
}

func (s *PostService) GetCategoryFromCache(categoryID int) (*models.Category, bool) {
	return s.cache.Get(categoryID)
}