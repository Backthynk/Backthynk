package main

import (
	"backthynk/internal/core/cache"
	"backthynk/internal/storage"
	"encoding/json"
	"os"
)

type SpaceExport struct {
	Path string 	  `json:"path"`
	Description string `json:"description"`
	ID int 		`json:"id"`
}

type LinkExport struct {
	SiteName string `json:"site_name,omitempty"`
	Title string `json:"title"`
	Description string `json:"description"`
}

type PostExport struct {
	Content string `json:"content"`
	ParentSpaceID int `json:"parent_space_id"`
	AttachmentsPath []string `json:"attachments_path,omitempty"`
	Links []LinkExport `json:"links,omitempty"`
}

type FullExport struct {
	Spaces []SpaceExport `json:"spaces"`
	Posts  []PostExport  `json:"posts"`
}

func Export(cache *cache.SpaceCache, db *storage.DB) {
	spaces := cache.GetAll()
	spaceExports := make([]SpaceExport, len(spaces))
	for i, space := range spaces {

		path := space.Name
		for _, id := range cache.GetAncestors(space.ID) {
			if ances, ok := cache.Get(id); ok {
				path = ances.Name + "/" + path
			}
		}
		spaceExports[i] = SpaceExport{
			Path:        path,
			Description: space.Description,
			ID:          space.ID,
		}
	}

	posts, err := db.GetAllPosts(10000, 0)
	if err != nil {
		panic(err)
	}
	postExports := make([]PostExport, len(posts))
	for i, post := range posts {
		postExports[i] = PostExport{
			Content: post.Content,
			ParentSpaceID: post.SpaceID,
		}
		for _, link := range post.LinkPreviews {
			postExports[i].Links = append(postExports[i].Links, LinkExport{
				Title:       link.Title,
				Description: link.Description,
				SiteName:    link.SiteName,
			})
		}
		for _, att := range post.Attachments {
			postExports[i].AttachmentsPath = append(postExports[i].AttachmentsPath,  att.FilePath)
		}
	}

	v := FullExport{
		Spaces: spaceExports,
		Posts:  postExports,
	}

	//write in test_data.json

	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		panic(err)
	}
	
	err = os.WriteFile("test_data.json", data, 0644)
	if err != nil {
		panic(err)
	}

}