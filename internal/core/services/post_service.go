package services

import (
	"backthynk/internal/config"
	"backthynk/internal/core/cache"
	"backthynk/internal/core/events"
	"backthynk/internal/core/models"
	"backthynk/internal/core/utils"
	"backthynk/internal/storage"
	"fmt"
)

type PostService struct {
	db         *storage.DB
	cache      *cache.SpaceCache
	dispatcher *events.Dispatcher
	options    *config.OptionsConfig
}

func NewPostService(db *storage.DB, cache *cache.SpaceCache, dispatcher *events.Dispatcher) *PostService {
	return &PostService{
		db:         db,
		cache:      cache,
		dispatcher: dispatcher,
		options:    config.GetOptionsConfig(),
	}
}

func (s *PostService) Create(spaceID int, content string, customTimestamp *int64) (*models.Post, error) {
	// Validate space exists using cache
	if _, ok := s.cache.Get(spaceID); !ok {
		return nil, fmt.Errorf(config.ErrSpaceNotFound)
	}

	var post *models.Post
	var err error

	if customTimestamp != nil {
		post, err = s.db.CreatePostWithTimestamp(spaceID, content, *customTimestamp)
	} else {
		post, err = s.db.CreatePost(spaceID, content)
	}

	if err != nil {
		return nil, err
	}

	// Process content on-the-fly for the response
	if s.options != nil && s.options.Features.Markdown.Enabled {
		post.Content = utils.ProcessMarkdown(post.Content)
	}

	// Update cache
	s.cache.UpdatePostCount(spaceID, 1)
	
	// Dispatch event
	s.dispatcher.Dispatch(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{
			PostID:     post.ID,
			SpaceID: spaceID,
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
	s.cache.UpdatePostCount(post.SpaceID, -1)
	
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
			SpaceID: post.SpaceID,
			Timestamp:  post.Created,
			FileSize:   totalSize,
			FileCount:  len(attachments),
		},
	})
	
	return nil
}


func (s *PostService) Move(postID int, newSpaceID int) error {
	// Validate new space exists using cache
	if _, ok := s.cache.Get(newSpaceID); !ok {
		return fmt.Errorf(config.ErrSpaceNotFound)
	}

	post, err := s.db.GetPost(postID)
	if err != nil {
		return err
	}

	oldSpaceID := post.SpaceID

	// Update in database
	if err := s.db.UpdatePostSpace(postID, newSpaceID); err != nil {
		return err
	}
	
	// Update cache
	s.cache.UpdatePostCount(oldSpaceID, -1)
	s.cache.UpdatePostCount(newSpaceID, 1)
	
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
			SpaceID:    newSpaceID,
			OldSpaceID: &oldSpaceID,
			Timestamp:     post.Created,
			FileSize:      totalSize,
			FileCount:     len(attachments),
		},
	})
	
	return nil
}

func (s *PostService) GetBySpace(spaceID int, recursive bool, limit, offset int) ([]models.PostWithAttachments, error) {
	var descendants []int
	if recursive {
		descendants = s.cache.GetDescendants(spaceID)
	}
	posts, err := s.db.GetPostsBySpaceRecursive(spaceID, recursive, limit, offset, descendants)
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

func (s *PostService) GetSpaceFromCache(spaceID int) (*models.Space, bool) {
	return s.cache.Get(spaceID)
}