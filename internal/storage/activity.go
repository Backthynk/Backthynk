package storage

// PostData represents post data for activity calculations
type PostData struct {
	ID         int
	CategoryID int
	Created    int64
}

func (db *DB) GetAllPostsForActivity() ([]PostData, error) {
	query := "SELECT id, category_id, created FROM posts ORDER BY created"
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var posts []PostData
	for rows.Next() {
		var post PostData
		err := rows.Scan(&post.ID, &post.CategoryID, &post.Created)
		if err != nil {
			return nil, err
		}
		posts = append(posts, post)
	}
	
	return posts, nil
}