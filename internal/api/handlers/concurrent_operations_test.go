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
	spaceHandler *SpaceHandler
	postHandler     *PostHandler
	spaceService *services.SpaceService
	postService     *services.PostService
	fileService     *services.FileService
	db              *storage.DB
	cache           *cache.SpaceCache
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
	spaceCache := cache.NewSpaceCache()
	dispatcher := events.NewDispatcher()

	// Setup services
	spaceService := services.NewSpaceService(db, spaceCache, dispatcher)
	postService := services.NewPostService(db, spaceCache, dispatcher)
	fileService := services.NewFileService(db, dispatcher)

	// Initialize cache
	if err := spaceService.InitializeCache(); err != nil {
		return nil, err
	}

	// Setup test options
	options := config.NewTestOptionsConfig().
		WithMaxContentLength(1000).
		WithMaxFileSizeMB(10).
		WithMaxFilesPerPost(5).
		WithRetroactivePostingEnabled(true).
		WithMarkdownEnabled(false)

	// Setup handlers
	spaceHandler := NewSpaceHandler(spaceService)
	postHandler := NewPostHandler(postService, fileService, options)

	return &concurrentTestSetup{
		spaceHandler: spaceHandler,
		postHandler:     postHandler,
		spaceService: spaceService,
		postService:     postService,
		fileService:     fileService,
		db:              db,
		cache:           spaceCache,
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

func TestConcurrentSpaceCreation(t *testing.T) {
	setup, err := setupConcurrentTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	numGoroutines := 50
	wg := sync.WaitGroup{}
	results := make(chan error, numGoroutines)
	createdSpaces := make(chan *models.Space, numGoroutines)

	// Create parent space
	parent, err := setup.spaceService.Create("Parent Space", nil, "Parent for concurrent test")
	if err != nil {
		t.Fatalf("Failed to create parent space: %v", err)
	}

	// Concurrent space creation
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()

			requestBody := map[string]interface{}{
				"name":        fmt.Sprintf("Concurrent Space %d", i),
				"description": fmt.Sprintf("Description %d", i),
				"parent_id":   parent.ID,
			}

			body, _ := json.Marshal(requestBody)
			req := httptest.NewRequest("POST", "/api/spaces", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			setup.spaceHandler.CreateSpace(w, req)

			if w.Code != http.StatusCreated {
				results <- fmt.Errorf("goroutine %d: expected 201, got %d", i, w.Code)
				return
			}

			var cat models.Space
			if err := json.Unmarshal(w.Body.Bytes(), &cat); err != nil {
				results <- fmt.Errorf("goroutine %d: failed to unmarshal: %v", i, err)
				return
			}

			createdSpaces <- &cat
			results <- nil
		}(i)
	}

	// Wait for all goroutines
	wg.Wait()
	close(results)
	close(createdSpaces)

	// Check results
	errorCount := 0
	for err := range results {
		if err != nil {
			t.Errorf("Concurrent creation error: %v", err)
			errorCount++
		}
	}

	// Collect created spaces
	spaces := make([]*models.Space, 0, numGoroutines)
	for cat := range createdSpaces {
		spaces = append(spaces, cat)
	}

	if len(spaces) != numGoroutines-errorCount {
		t.Errorf("Expected %d successful spaces, got %d", numGoroutines-errorCount, len(spaces))
	}

	// Verify all spaces have unique IDs
	ids := make(map[int]bool)
	for _, cat := range spaces {
		if ids[cat.ID] {
			t.Errorf("Duplicate space ID found: %d", cat.ID)
		}
		ids[cat.ID] = true
	}

	// Verify data consistency by retrieving all spaces
	req := httptest.NewRequest("GET", "/api/spaces", nil)
	w := httptest.NewRecorder()
	setup.spaceHandler.GetSpaces(w, req)

	var allSpaces []*models.Space
	json.Unmarshal(w.Body.Bytes(), &allSpaces)

	// Should have parent + successfully created children
	expectedTotal := 1 + len(spaces)
	if len(allSpaces) != expectedTotal {
		t.Errorf("Expected %d total spaces, got %d", expectedTotal, len(allSpaces))
	}
}

func TestConcurrentPostCreation(t *testing.T) {
	setup, err := setupConcurrentTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create test space
	space, err := setup.spaceService.Create("Test Space", nil, "Test space for concurrent posts")
	if err != nil {
		t.Fatalf("Failed to create test space: %v", err)
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
				"space_id": space.ID,
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

	// Verify space post count is correct
	updatedSpace, _ := setup.spaceService.Get(space.ID)
	if updatedSpace.PostCount != len(posts) {
		t.Errorf("Expected space post count %d, got %d", len(posts), updatedSpace.PostCount)
	}
}

func TestConcurrentPostMoves(t *testing.T) {
	setup, err := setupConcurrentTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create test spaces
	space1, err := setup.spaceService.Create("Space 1", nil, "Space 1")
	if err != nil {
		t.Fatalf("Failed to create Space 1: %v", err)
	}
	space2, err := setup.spaceService.Create("Space 2", nil, "Space 2")
	if err != nil {
		t.Fatalf("Failed to create Space 2: %v", err)
	}

	// Create posts in space1
	numPosts := 20
	posts := make([]*models.Post, numPosts)
	for i := 0; i < numPosts; i++ {
		var err error
		posts[i], err = setup.postService.Create(space1.ID, fmt.Sprintf("Post %d", i), nil)
		if err != nil {
			t.Fatalf("Failed to create post %d: %v", i, err)
		}
	}

	numGoroutines := numPosts
	wg := sync.WaitGroup{}
	results := make(chan error, numGoroutines)

	// Concurrent post moves from space1 to space2
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()

			requestBody := map[string]interface{}{
				"space_id": space2.ID,
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
	cat1, _ := setup.spaceService.Get(space1.ID)
	cat2, _ := setup.spaceService.Get(space2.ID)

	successfulMoves := numPosts - errorCount
	if cat1.PostCount != errorCount {
		t.Errorf("Expected space1 post count %d, got %d", errorCount, cat1.PostCount)
	}
	if cat2.PostCount != successfulMoves {
		t.Errorf("Expected space2 post count %d, got %d", successfulMoves, cat2.PostCount)
	}

	// Verify total posts remain consistent
	if cat1.PostCount+cat2.PostCount != numPosts {
		t.Errorf("Total post count inconsistent: cat1=%d, cat2=%d, expected total=%d",
			cat1.PostCount, cat2.PostCount, numPosts)
	}
}

func TestConcurrentSpaceUpdates(t *testing.T) {
	setup, err := setupConcurrentTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create test spaces
	space, err := setup.spaceService.Create("Original Space", nil, "Original description")
	if err != nil {
		t.Fatalf("Failed to create test space: %v", err)
	}

	numGoroutines := 20
	wg := sync.WaitGroup{}
	results := make(chan error, numGoroutines)

	// Concurrent space updates
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()

			requestBody := map[string]interface{}{
				"name":        fmt.Sprintf("Updated Space %d", i),
				"description": fmt.Sprintf("Updated description %d", i),
			}

			body, _ := json.Marshal(requestBody)
			req := httptest.NewRequest("PUT", "/api/spaces/"+strconv.Itoa(space.ID), bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(space.ID)})
			w := httptest.NewRecorder()

			setup.spaceHandler.UpdateSpace(w, req)

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
	finalSpace, err := setup.spaceService.Get(space.ID)
	if err != nil {
		t.Fatalf("Failed to get final space state: %v", err)
	}

	// Space should exist and have a valid state
	if finalSpace.ID != space.ID {
		t.Errorf("Space ID changed during concurrent updates")
	}
	if finalSpace.Name == "Original Space" {
		t.Error("Space name was not updated by any concurrent operation")
	}
}

func TestConcurrentMixedOperations(t *testing.T) {
	setup, err := setupConcurrentTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create initial data
	parentSpace, err := setup.spaceService.Create("Parent Space", nil, "Parent space")
	if err != nil {
		t.Fatalf("Failed to create parent space: %v", err)
	}
	childSpace, err := setup.spaceService.Create("Child Space", &parentSpace.ID, "Child space")
	if err != nil {
		t.Fatalf("Failed to create child space: %v", err)
	}

	// Create some initial posts
	for i := 0; i < 5; i++ {
		_, err := setup.postService.Create(parentSpace.ID, fmt.Sprintf("Initial post %d", i), nil)
		if err != nil {
			t.Fatalf("Failed to create initial post %d: %v", i, err)
		}
		_, err = setup.postService.Create(childSpace.ID, fmt.Sprintf("Initial child post %d", i), nil)
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
				// Create new space
				requestBody := map[string]interface{}{
					"name":        fmt.Sprintf("New Space %d", i),
					"description": fmt.Sprintf("Description %d", i),
					"parent_id":   parentSpace.ID,
				}
				body, _ := json.Marshal(requestBody)
				req := httptest.NewRequest("POST", "/api/spaces", bytes.NewBuffer(body))
				req.Header.Set("Content-Type", "application/json")
				w := httptest.NewRecorder()
				setup.spaceHandler.CreateSpace(w, req)
				results <- fmt.Sprintf("create_space_%d: %d", i, w.Code)

			case 1:
				// Create new post
				targetCat := parentSpace.ID
				if i%2 == 0 {
					targetCat = childSpace.ID
				}
				requestBody := map[string]interface{}{
					"space_id": targetCat,
					"content":     fmt.Sprintf("New post %d", i),
				}
				body, _ := json.Marshal(requestBody)
				req := httptest.NewRequest("POST", "/api/posts", bytes.NewBuffer(body))
				req.Header.Set("Content-Type", "application/json")
				w := httptest.NewRecorder()
				setup.postHandler.CreatePost(w, req)
				results <- fmt.Sprintf("create_post_%d: %d", i, w.Code)

			case 2:
				// Get spaces
				req := httptest.NewRequest("GET", "/api/spaces", nil)
				w := httptest.NewRecorder()
				setup.spaceHandler.GetSpaces(w, req)
				results <- fmt.Sprintf("get_spaces_%d: %d", i, w.Code)

			case 3:
				// Get posts by space
				targetCat := parentSpace.ID
				if i%2 == 0 {
					targetCat = childSpace.ID
				}
				req := httptest.NewRequest("GET", "/api/spaces/"+strconv.Itoa(targetCat)+"/posts", nil)
				req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(targetCat)})
				w := httptest.NewRecorder()
				setup.postHandler.GetPostsBySpace(w, req)
				results <- fmt.Sprintf("get_posts_%d: %d", i, w.Code)

			case 4:
				// Get spaces by parent
				req := httptest.NewRequest("GET", "/api/spaces/by-parent?parent_id="+strconv.Itoa(parentSpace.ID), nil)
				w := httptest.NewRecorder()
				setup.spaceHandler.GetSpacesByParent(w, req)
				results <- fmt.Sprintf("get_by_parent_%d: %d", i, w.Code)

			case 5:
				// Update space
				targetCat := childSpace.ID
				requestBody := map[string]interface{}{
					"name":        fmt.Sprintf("Updated Child %d", i),
					"description": fmt.Sprintf("Updated description %d", i),
				}
				body, _ := json.Marshal(requestBody)
				req := httptest.NewRequest("PUT", "/api/spaces/"+strconv.Itoa(targetCat), bytes.NewBuffer(body))
				req.Header.Set("Content-Type", "application/json")
				req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(targetCat)})
				w := httptest.NewRecorder()
				setup.spaceHandler.UpdateSpace(w, req)
				results <- fmt.Sprintf("update_space_%d: %d", i, w.Code)
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
	req := httptest.NewRequest("GET", "/api/spaces", nil)
	w := httptest.NewRecorder()
	setup.spaceHandler.GetSpaces(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("System not functional after mixed operations: %d", w.Code)
	}

	var finalSpaces []*models.Space
	json.Unmarshal(w.Body.Bytes(), &finalSpaces)

	if len(finalSpaces) < 2 {
		t.Errorf("Expected at least 2 spaces after mixed operations, got %d", len(finalSpaces))
	}

	t.Logf("Mixed operations completed. Final state: %d spaces", len(finalSpaces))
}

func TestConcurrentOperationsWithTimeout(t *testing.T) {
	setup, err := setupConcurrentTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create test data
	space, err := setup.spaceService.Create("Test Space", nil, "Test space")
	if err != nil {
		t.Fatalf("Failed to create test space: %v", err)
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
							"space_id": space.ID,
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
			name:    "Rapid_Space_Hierarchy_Changes",
			timeout: 15 * time.Second,
			test: func() error {
				// Create a small hierarchy
				cat1, err := setup.spaceService.Create("Cat1", nil, "Cat1")
				if err != nil {
					return fmt.Errorf("failed to create Cat1: %v", err)
				}
				cat2, err := setup.spaceService.Create("Cat2", &cat1.ID, "Cat2")
				if err != nil {
					return fmt.Errorf("failed to create Cat2: %v", err)
				}
				cat3, err := setup.spaceService.Create("Cat3", &cat2.ID, "Cat3")
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
						req := httptest.NewRequest("PUT", "/api/spaces/"+strconv.Itoa(targetCat), bytes.NewBuffer(body))
						req.Header.Set("Content-Type", "application/json")
						req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(targetCat)})
						w := httptest.NewRecorder()
						setup.spaceHandler.UpdateSpace(w, req)
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