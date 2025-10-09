package models

import "backthynk/internal/core/utils"

type Space struct {
	ID          int    `json:"id" db:"id"`
	Name        string `json:"name" db:"name"`
	Description string `json:"description" db:"description"`
	ParentID    *int   `json:"parent_id" db:"parent_id"`
	Depth       int    `json:"depth" db:"depth"`
	Created     int64  `json:"created" db:"created"`

	// Cached fields
	PostCount          int `json:"post_count"`
	RecursivePostCount int `json:"recursive_post_count"`
}

// GetSlug generates a URL-safe slug from the space name
func (s *Space) GetSlug() string {
	return utils.GenerateSlug(s.Name)
}

type SpaceTree struct {
	Space
	Children []*SpaceTree `json:"children,omitempty"`
}