package storage

import (
	"backthynk/internal/models"
)

func (db *DB) CreateLinkPreview(preview *models.LinkPreview) error {
	query := `INSERT INTO link_previews (post_id, url, title, description, image_url, site_name)
			  VALUES (?, ?, ?, ?, ?, ?)`

	result, err := db.Exec(query, preview.PostID, preview.URL, preview.Title,
		preview.Description, preview.ImageURL, preview.SiteName)
	if err != nil {
		return err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return err
	}

	preview.ID = int(id)
	return nil
}

func (db *DB) GetLinkPreviewsByPostID(postID int) ([]models.LinkPreview, error) {
	query := `SELECT id, post_id, url, title, description, image_url, site_name
			  FROM link_previews WHERE post_id = ?`

	rows, err := db.Query(query, postID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var previews []models.LinkPreview
	for rows.Next() {
		var preview models.LinkPreview
		err := rows.Scan(&preview.ID, &preview.PostID, &preview.URL, &preview.Title,
			&preview.Description, &preview.ImageURL, &preview.SiteName)
		if err != nil {
			return nil, err
		}
		previews = append(previews, preview)
	}

	return previews, rows.Err()
}

func (db *DB) DeleteLinkPreviewsByPostID(postID int) error {
	query := `DELETE FROM link_previews WHERE post_id = ?`
	_, err := db.Exec(query, postID)
	return err
}