package handlers

import (
	"backthynk/internal/config"
	"backthynk/internal/core/cache"
	"backthynk/internal/core/events"
	"backthynk/internal/core/models"
	"backthynk/internal/core/services"
	"backthynk/internal/storage"
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/mux"
)

type concurrentTestSetup struct {
	categoryHandler *CategoryHandler
	postHandler     *PostHandler
	categoryService *services.CategoryService
	postService     *services.PostService
	fileService     *services.FileService
	db              *storage.DB
	cache           *cache.CategoryCache
	dispatcher      *events.Dispatcher
	tempDir         string
}

func setupConcurrentTest() (*concurrentTestSetup, error) {
	// Initialize minimal service config for tests
	testConfig := &config.ServiceConfig{
		Files: struct {
			ConfigFilename   string `json:"configFilename"`
			DatabaseFilename string `json:"databaseFilename"`
			UploadsSubdir    string `json:"uploadsSubdir"`
			StoragePath      string `json:"storagePath"`
		}{
			DatabaseFilename: "test.db",
		},
	}
	config.SetServiceConfigForTest(testConfig)

	// Setup test database with temp directory for SQLite file
	tempDir, err := os.MkdirTemp("", "backthynk_concurrent_test_*")
	if err != nil {
		return nil, err
	}

	db, err := storage.NewDB(tempDir)
	if err != nil {
		os.RemoveAll(tempDir)
		return nil, err
	}

	// The database is already initialized with tables in NewDB

	// Setup cache and dispatcher
	categoryCache := cache.NewCategoryCache()
	dispatcher := events.NewDispatcher()

	// Setup services
	categoryService := services.NewCategoryService(db, categoryCache, dispatcher)
	postService := services.NewPostService(db, categoryCache, dispatcher)
	fileService := services.NewFileService(db, dispatcher)

	// Initialize cache
	if err := categoryService.InitializeCache(); err != nil {
		return nil, err
	}

	// Setup test options
	options := &config.OptionsConfig{
		Core: struct {
			MaxContentLength int `json:"maxContentLength"`
			MaxFileSizeMB    int `json:"maxFileSizeMB"`
			MaxFilesPerPost  int `json:"maxFilesPerPost"`
		}{
			MaxContentLength: 1000,
			MaxFileSizeMB:    10,
			MaxFilesPerPost:  5,
		},
		Features: struct {
			Activity struct {
				Enabled      bool `json:"enabled"`
				PeriodMonths int  `json:"periodMonths"`
			} `json:"activity"`
			DetailedStats struct {
				Enabled bool `json:"enabled"`
			} `json:"detailedStats"`
			RetroactivePosting struct {
				Enabled    bool   `json:"enabled"`
				TimeFormat string `json:"timeFormat"`
			} `json:"retroactivePosting"`
			Markdown struct {
				Enabled bool `json:"enabled"`
			} `json:"markdown"`
		}{
			Activity: struct {
				Enabled      bool `json:"enabled"`
				PeriodMonths int  `json:"periodMonths"`
			}{
				Enabled:      true,
				PeriodMonths: 4,
			},
			DetailedStats: struct {
				Enabled bool `json:"enabled"`
			}{
				Enabled: true,
			},
			RetroactivePosting: struct {
				Enabled    bool   `json:"enabled"`
				TimeFormat string `json:"timeFormat"`
			}{
				Enabled:    true,
				TimeFormat: "24h",
			},
			Markdown: struct {
				Enabled bool `json:"enabled"`
			}{
				Enabled: false,
			},
		},
	}

	// Setup handlers
	categoryHandler := NewCategoryHandler(categoryService)
	postHandler := NewPostHandler(postService, fileService, options)

	return &concurrentTestSetup{
		categoryHandler: categoryHandler,
		postHandler:     postHandler,
		categoryService: categoryService,
		postService:     postService,
		fileService:     fileService,
		db:              db,
		cache:           categoryCache,
		dispatcher:      dispatcher,
		tempDir:         tempDir,
	}, nil
}

func (setup *concurrentTestSetup) cleanup() {
	if setup.db != nil {
		setup.db.Close()
	}
	if setup.tempDir != "" {
		os.RemoveAll(setup.tempDir)
	}
}

func TestConcurrentCategoryCreation(t *testing.T) {
	setup, err := setupConcurrentTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	numGoroutines := 50
	wg := sync.WaitGroup{}
	results := make(chan error, numGoroutines)
	createdCategories := make(chan *models.Category, numGoroutines)

	// Create parent category
	parent, err := setup.categoryService.Create("Parent Category", nil, "Parent for concurrent test")
	if err != nil {
		t.Fatalf("Failed to create parent category: %v", err)
	}

	// Concurrent category creation
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()

			requestBody := map[string]interface{}{
				"name":        fmt.Sprintf("Concurrent Category %d", i),
				"description": fmt.Sprintf("Description %d", i),
				"parent_id":   parent.ID,
			}

			body, _ := json.Marshal(requestBody)
			req := httptest.NewRequest("POST", "/api/categories", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			setup.categoryHandler.CreateCategory(w, req)

			if w.Code != http.StatusCreated {
				results <- fmt.Errorf("goroutine %d: expected 201, got %d", i, w.Code)
				return
			}

			var cat models.Category
			if err := json.Unmarshal(w.Body.Bytes(), &cat); err != nil {
				results <- fmt.Errorf("goroutine %d: failed to unmarshal: %v", i, err)
				return
			}

			createdCategories <- &cat
			results <- nil
		}(i)
	}

	// Wait for all goroutines
	wg.Wait()
	close(results)
	close(createdCategories)

	// Check results
	errorCount := 0
	for err := range results {
		if err != nil {
			t.Errorf("Concurrent creation error: %v", err)
			errorCount++
		}
	}

	// Collect created categories
	categories := make([]*models.Category, 0, numGoroutines)
	for cat := range createdCategories {
		categories = append(categories, cat)
	}

	if len(categories) != numGoroutines-errorCount {
		t.Errorf("Expected %d successful categories, got %d", numGoroutines-errorCount, len(categories))
	}

	// Verify all categories have unique IDs
	ids := make(map[int]bool)
	for _, cat := range categories {
		if ids[cat.ID] {
			t.Errorf("Duplicate category ID found: %d", cat.ID)
		}
		ids[cat.ID] = true
	}

	// Verify data consistency by retrieving all categories
	req := httptest.NewRequest("GET", "/api/categories", nil)
	w := httptest.NewRecorder()
	setup.categoryHandler.GetCategories(w, req)

	var allCategories []*models.Category
	json.Unmarshal(w.Body.Bytes(), &allCategories)

	// Should have parent + successfully created children
	expectedTotal := 1 + len(categories)
	if len(allCategories) != expectedTotal {
		t.Errorf("Expected %d total categories, got %d", expectedTotal, len(allCategories))
	}
}

func TestConcurrentPostCreation(t *testing.T) {
	setup, err := setupConcurrentTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create test category
	category, err := setup.categoryService.Create("Test Category", nil, "Test category for concurrent posts")
	if err != nil {
		t.Fatalf("Failed to create test category: %v", err)
	}

	numGoroutines := 50
	wg := sync.WaitGroup{}
	results := make(chan error, numGoroutines)
	createdPosts := make(chan *models.Post, numGoroutines)

	// Concurrent post creation
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()

			requestBody := map[string]interface{}{
				"category_id": category.ID,
				"content":     fmt.Sprintf("Concurrent post content %d", i),
			}

			body, _ := json.Marshal(requestBody)
			req := httptest.NewRequest("POST", "/api/posts", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			setup.postHandler.CreatePost(w, req)

			if w.Code != http.StatusCreated {
				results <- fmt.Errorf("goroutine %d: expected 201, got %d", i, w.Code)
				return
			}

			var post models.Post
			if err := json.Unmarshal(w.Body.Bytes(), &post); err != nil {
				results <- fmt.Errorf("goroutine %d: failed to unmarshal: %v", i, err)
				return
			}

			createdPosts <- &post
			results <- nil
		}(i)
	}

	// Wait for all goroutines
	wg.Wait()
	close(results)
	close(createdPosts)

	// Check results
	errorCount := 0
	for err := range results {
		if err != nil {
			t.Errorf("Concurrent post creation error: %v", err)
			errorCount++
		}
	}

	// Collect created posts
	posts := make([]*models.Post, 0, numGoroutines)
	for post := range createdPosts {
		posts = append(posts, post)
	}

	if len(posts) != numGoroutines-errorCount {
		t.Errorf("Expected %d successful posts, got %d", numGoroutines-errorCount, len(posts))
	}

	// Verify all posts have unique IDs
	ids := make(map[int]bool)
	for _, post := range posts {
		if ids[post.ID] {
			t.Errorf("Duplicate post ID found: %d", post.ID)
		}
		ids[post.ID] = true
	}

	// Verify category post count is correct
	updatedCategory, _ := setup.categoryService.Get(category.ID)
	if updatedCategory.PostCount != len(posts) {
		t.Errorf("Expected category post count %d, got %d", len(posts), updatedCategory.PostCount)
	}
}

func TestConcurrentPostMoves(t *testing.T) {
	setup, err := setupConcurrentTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create test categories
	category1, err := setup.categoryService.Create("Category 1", nil, "Category 1")
	if err != nil {
		t.Fatalf("Failed to create Category 1: %v", err)
	}
	category2, err := setup.categoryService.Create("Category 2", nil, "Category 2")
	if err != nil {
		t.Fatalf("Failed to create Category 2: %v", err)
	}

	// Create posts in category1
	numPosts := 20
	posts := make([]*models.Post, numPosts)
	for i := 0; i < numPosts; i++ {
		var err error
		posts[i], err = setup.postService.Create(category1.ID, fmt.Sprintf("Post %d", i), nil)
		if err != nil {
			t.Fatalf("Failed to create post %d: %v", i, err)
		}
	}

	numGoroutines := numPosts
	wg := sync.WaitGroup{}
	results := make(chan error, numGoroutines)

	// Concurrent post moves from category1 to category2
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()

			requestBody := map[string]interface{}{
				"category_id": category2.ID,
			}

			body, _ := json.Marshal(requestBody)
			req := httptest.NewRequest("PUT", "/api/posts/"+strconv.Itoa(posts[i].ID)+"/move", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(posts[i].ID)})
			w := httptest.NewRecorder()

			setup.postHandler.MovePost(w, req)

			if w.Code != http.StatusOK {
				results <- fmt.Errorf("goroutine %d: expected 200, got %d", i, w.Code)
				return
			}

			results <- nil
		}(i)
	}

	// Wait for all goroutines
	wg.Wait()
	close(results)

	// Check results
	errorCount := 0
	for err := range results {
		if err != nil {
			t.Errorf("Concurrent move error: %v", err)
			errorCount++
		}
	}

	// Verify final post counts
	cat1, _ := setup.categoryService.Get(category1.ID)
	cat2, _ := setup.categoryService.Get(category2.ID)

	successfulMoves := numPosts - errorCount
	if cat1.PostCount != errorCount {
		t.Errorf("Expected category1 post count %d, got %d", errorCount, cat1.PostCount)
	}
	if cat2.PostCount != successfulMoves {
		t.Errorf("Expected category2 post count %d, got %d", successfulMoves, cat2.PostCount)
	}

	// Verify total posts remain consistent
	if cat1.PostCount+cat2.PostCount != numPosts {
		t.Errorf("Total post count inconsistent: cat1=%d, cat2=%d, expected total=%d",
			cat1.PostCount, cat2.PostCount, numPosts)
	}
}

func TestConcurrentCategoryUpdates(t *testing.T) {
	setup, err := setupConcurrentTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create test categories
	category, err := setup.categoryService.Create("Original Category", nil, "Original description")
	if err != nil {
		t.Fatalf("Failed to create test category: %v", err)
	}

	numGoroutines := 20
	wg := sync.WaitGroup{}
	results := make(chan error, numGoroutines)

	// Concurrent category updates
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()

			requestBody := map[string]interface{}{
				"name":        fmt.Sprintf("Updated Category %d", i),
				"description": fmt.Sprintf("Updated description %d", i),
			}

			body, _ := json.Marshal(requestBody)
			req := httptest.NewRequest("PUT", "/api/categories/"+strconv.Itoa(category.ID), bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(category.ID)})
			w := httptest.NewRecorder()

			setup.categoryHandler.UpdateCategory(w, req)

			if w.Code != http.StatusOK {
				results <- fmt.Errorf("goroutine %d: expected 200, got %d", i, w.Code)
				return
			}

			results <- nil
		}(i)
	}

	// Wait for all goroutines
	wg.Wait()
	close(results)

	// Check results
	for err := range results {
		if err != nil {
			t.Errorf("Concurrent update error: %v", err)
		}
	}

	// Verify final state is consistent
	finalCategory, err := setup.categoryService.Get(category.ID)
	if err != nil {
		t.Fatalf("Failed to get final category state: %v", err)
	}

	// Category should exist and have a valid state
	if finalCategory.ID != category.ID {
		t.Errorf("Category ID changed during concurrent updates")
	}
	if finalCategory.Name == "Original Category" {
		t.Error("Category name was not updated by any concurrent operation")
	}
}

func TestConcurrentMixedOperations(t *testing.T) {
	setup, err := setupConcurrentTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create initial data
	parentCategory, err := setup.categoryService.Create("Parent Category", nil, "Parent category")
	if err != nil {
		t.Fatalf("Failed to create parent category: %v", err)
	}
	childCategory, err := setup.categoryService.Create("Child Category", &parentCategory.ID, "Child category")
	if err != nil {
		t.Fatalf("Failed to create child category: %v", err)
	}

	// Create some initial posts
	for i := 0; i < 5; i++ {
		_, err := setup.postService.Create(parentCategory.ID, fmt.Sprintf("Initial post %d", i), nil)
		if err != nil {
			t.Fatalf("Failed to create initial post %d: %v", i, err)
		}
		_, err = setup.postService.Create(childCategory.ID, fmt.Sprintf("Initial child post %d", i), nil)
		if err != nil {
			t.Fatalf("Failed to create initial child post %d: %v", i, err)
		}
	}

	numGoroutines := 50
	wg := sync.WaitGroup{}
	results := make(chan string, numGoroutines)

	// Mix of different operations
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()

			switch i % 6 {
			case 0:
				// Create new category
				requestBody := map[string]interface{}{
					"name":        fmt.Sprintf("New Category %d", i),
					"description": fmt.Sprintf("Description %d", i),
					"parent_id":   parentCategory.ID,
				}
				body, _ := json.Marshal(requestBody)
				req := httptest.NewRequest("POST", "/api/categories", bytes.NewBuffer(body))
				req.Header.Set("Content-Type", "application/json")
				w := httptest.NewRecorder()
				setup.categoryHandler.CreateCategory(w, req)
				results <- fmt.Sprintf("create_category_%d: %d", i, w.Code)

			case 1:
				// Create new post
				targetCat := parentCategory.ID
				if i%2 == 0 {
					targetCat = childCategory.ID
				}
				requestBody := map[string]interface{}{
					"category_id": targetCat,
					"content":     fmt.Sprintf("New post %d", i),
				}
				body, _ := json.Marshal(requestBody)
				req := httptest.NewRequest("POST", "/api/posts", bytes.NewBuffer(body))
				req.Header.Set("Content-Type", "application/json")
				w := httptest.NewRecorder()
				setup.postHandler.CreatePost(w, req)
				results <- fmt.Sprintf("create_post_%d: %d", i, w.Code)

			case 2:
				// Get categories
				req := httptest.NewRequest("GET", "/api/categories", nil)
				w := httptest.NewRecorder()
				setup.categoryHandler.GetCategories(w, req)
				results <- fmt.Sprintf("get_categories_%d: %d", i, w.Code)

			case 3:
				// Get posts by category
				targetCat := parentCategory.ID
				if i%2 == 0 {
					targetCat = childCategory.ID
				}
				req := httptest.NewRequest("GET", "/api/categories/"+strconv.Itoa(targetCat)+"/posts", nil)
				req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(targetCat)})
				w := httptest.NewRecorder()
				setup.postHandler.GetPostsByCategory(w, req)
				results <- fmt.Sprintf("get_posts_%d: %d", i, w.Code)

			case 4:
				// Get categories by parent
				req := httptest.NewRequest("GET", "/api/categories/by-parent?parent_id="+strconv.Itoa(parentCategory.ID), nil)
				w := httptest.NewRecorder()
				setup.categoryHandler.GetCategoriesByParent(w, req)
				results <- fmt.Sprintf("get_by_parent_%d: %d", i, w.Code)

			case 5:
				// Update category
				targetCat := childCategory.ID
				requestBody := map[string]interface{}{
					"name":        fmt.Sprintf("Updated Child %d", i),
					"description": fmt.Sprintf("Updated description %d", i),
				}
				body, _ := json.Marshal(requestBody)
				req := httptest.NewRequest("PUT", "/api/categories/"+strconv.Itoa(targetCat), bytes.NewBuffer(body))
				req.Header.Set("Content-Type", "application/json")
				req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(targetCat)})
				w := httptest.NewRecorder()
				setup.categoryHandler.UpdateCategory(w, req)
				results <- fmt.Sprintf("update_category_%d: %d", i, w.Code)
			}
		}(i)
	}

	// Wait for all goroutines with timeout
	done := make(chan bool)
	go func() {
		wg.Wait()
		close(results)
		done <- true
	}()

	select {
	case <-done:
		// All operations completed
	case <-time.After(30 * time.Second):
		t.Fatal("Mixed operations test timed out - possible deadlock or infinite loop")
	}

	// Collect and analyze results
	operationResults := make(map[string]int)
	for result := range results {
		operationResults[result]++
	}

	// Verify system is still functional after all operations
	req := httptest.NewRequest("GET", "/api/categories", nil)
	w := httptest.NewRecorder()
	setup.categoryHandler.GetCategories(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("System not functional after mixed operations: %d", w.Code)
	}

	var finalCategories []*models.Category
	json.Unmarshal(w.Body.Bytes(), &finalCategories)

	if len(finalCategories) < 2 {
		t.Errorf("Expected at least 2 categories after mixed operations, got %d", len(finalCategories))
	}

	t.Logf("Mixed operations completed. Final state: %d categories", len(finalCategories))
}

func TestConcurrentOperationsWithTimeout(t *testing.T) {
	setup, err := setupConcurrentTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create test data
	category, err := setup.categoryService.Create("Test Category", nil, "Test category")
	if err != nil {
		t.Fatalf("Failed to create test category: %v", err)
	}

	// This test specifically checks for operations that might hang
	operations := []struct {
		name    string
		timeout time.Duration
		test    func() error
	}{
		{
			name:    "Concurrent_Creates_With_Timeout",
			timeout: 10 * time.Second,
			test: func() error {
				numOps := 100
				done := make(chan bool, numOps)

				for i := 0; i < numOps; i++ {
					go func(i int) {
						requestBody := map[string]interface{}{
							"category_id": category.ID,
							"content":     fmt.Sprintf("Timeout test post %d", i),
						}
						body, _ := json.Marshal(requestBody)
						req := httptest.NewRequest("POST", "/api/posts", bytes.NewBuffer(body))
						req.Header.Set("Content-Type", "application/json")
						w := httptest.NewRecorder()
						setup.postHandler.CreatePost(w, req)
						done <- true
					}(i)
				}

				completed := 0
				for completed < numOps {
					select {
					case <-done:
						completed++
					case <-time.After(15 * time.Second):
						return fmt.Errorf("only %d/%d operations completed before timeout", completed, numOps)
					}
				}
				return nil
			},
		},
		{
			name:    "Rapid_Category_Hierarchy_Changes",
			timeout: 15 * time.Second,
			test: func() error {
				// Create a small hierarchy
				cat1, err := setup.categoryService.Create("Cat1", nil, "Cat1")
				if err != nil {
					return fmt.Errorf("failed to create Cat1: %v", err)
				}
				cat2, err := setup.categoryService.Create("Cat2", &cat1.ID, "Cat2")
				if err != nil {
					return fmt.Errorf("failed to create Cat2: %v", err)
				}
				cat3, err := setup.categoryService.Create("Cat3", &cat2.ID, "Cat3")
				if err != nil {
					return fmt.Errorf("failed to create Cat3: %v", err)
				}

				numOps := 50
				done := make(chan bool, numOps)

				// Rapidly change hierarchy relationships
				for i := 0; i < numOps; i++ {
					go func(i int) {
						var requestBody map[string]interface{}
						var targetCat int

						switch i % 3 {
						case 0:
							// Move cat2 to different parents
							if i%2 == 0 {
								requestBody = map[string]interface{}{
									"name": "Cat2 Updated", "description": "Updated", "parent_id": cat3.ID,
								}
							} else {
								requestBody = map[string]interface{}{
									"name": "Cat2 Updated", "description": "Updated", "parent_id": cat1.ID,
								}
							}
							targetCat = cat2.ID
						case 1:
							// Update cat3
							requestBody = map[string]interface{}{
								"name": fmt.Sprintf("Cat3 Updated %d", i), "description": "Updated",
							}
							targetCat = cat3.ID
						case 2:
							// Update cat1
							requestBody = map[string]interface{}{
								"name": fmt.Sprintf("Cat1 Updated %d", i), "description": "Updated",
							}
							targetCat = cat1.ID
						}

						body, _ := json.Marshal(requestBody)
						req := httptest.NewRequest("PUT", "/api/categories/"+strconv.Itoa(targetCat), bytes.NewBuffer(body))
						req.Header.Set("Content-Type", "application/json")
						req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(targetCat)})
						w := httptest.NewRecorder()
						setup.categoryHandler.UpdateCategory(w, req)
						done <- true
					}(i)
				}

				completed := 0
				for completed < numOps {
					select {
					case <-done:
						completed++
					case <-time.After(20 * time.Second):
						return fmt.Errorf("hierarchy changes: only %d/%d operations completed", completed, numOps)
					}
				}
				return nil
			},
		},
	}

	for _, op := range operations {
		t.Run(op.name, func(t *testing.T) {
			if err := op.test(); err != nil {
				t.Errorf("%s failed: %v", op.name, err)
			}
		})
	}
}