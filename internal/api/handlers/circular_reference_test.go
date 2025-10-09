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
	"testing"
	"time"

	"github.com/gorilla/mux"
)

type circularTestSetup struct {
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

func setupCircularTest() (*circularTestSetup, error) {
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
	tempDir, err := os.MkdirTemp("", "backthynk_test_*")
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

	return &circularTestSetup{
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

func (setup *circularTestSetup) cleanup() {
	if setup.db != nil {
		setup.db.Close()
	}
	if setup.tempDir != "" {
		os.RemoveAll(setup.tempDir)
	}
}

func TestCircularReference_SimpleLoop(t *testing.T) {
	setup, err := setupCircularTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create spaces: A -> B
	catA, err := setup.spaceService.Create("Space A", nil, "Space A")
	if err != nil {
		t.Fatalf("Failed to create Space A: %v", err)
	}
	catB, err := setup.spaceService.Create("Space B", &catA.ID, "Space B")
	if err != nil {
		t.Fatalf("Failed to create Space B: %v", err)
	}

	// Try to create circular reference: A -> B -> A
	requestBody := map[string]interface{}{
		"name":        "Space A Updated",
		"description": "Updated description",
		"parent_id":   catB.ID,
	}

	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest("PUT", "/api/spaces/"+strconv.Itoa(catA.ID), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(catA.ID)})
	w := httptest.NewRecorder()

	// This should complete without hanging
	done := make(chan bool, 1)
	go func() {
		setup.spaceHandler.UpdateSpace(w, req)
		done <- true
	}()

	// Set timeout to detect if operation hangs
	select {
	case <-done:
		// Operation completed - test passed
	case <-time.After(5 * time.Second):
		t.Fatal("UpdateSpace operation hanged - possible infinite loop")
	}

	// If update succeeded, test that GetSpaces doesn't hang
	if w.Code == http.StatusOK {
		req2 := httptest.NewRequest("GET", "/api/spaces", nil)
		w2 := httptest.NewRecorder()

		done2 := make(chan bool, 1)
		go func() {
			setup.spaceHandler.GetSpaces(w2, req2)
			done2 <- true
		}()

		select {
		case <-done2:
			// Operation completed
		case <-time.After(5 * time.Second):
			t.Fatal("GetSpaces operation hanged after circular reference creation")
		}

		// Test GetSpacesByParent
		req3 := httptest.NewRequest("GET", "/api/spaces/by-parent", nil)
		w3 := httptest.NewRecorder()

		done3 := make(chan bool, 1)
		go func() {
			setup.spaceHandler.GetSpacesByParent(w3, req3)
			done3 <- true
		}()

		select {
		case <-done3:
			// Operation completed
		case <-time.After(5 * time.Second):
			t.Fatal("GetSpacesByParent operation hanged after circular reference creation")
		}
	}
}

func TestCircularReference_ComplexLoop(t *testing.T) {
	setup, err := setupCircularTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create spaces: A -> B -> C (within depth limit)
	catA, err := setup.spaceService.Create("Space A", nil, "Space A")
	if err != nil {
		t.Fatalf("Failed to create Space A: %v", err)
	}
	catB, err := setup.spaceService.Create("Space B", &catA.ID, "Space B")
	if err != nil {
		t.Fatalf("Failed to create Space B: %v", err)
	}
	catC, err := setup.spaceService.Create("Space C", &catB.ID, "Space C")
	if err != nil {
		t.Fatalf("Failed to create Space C: %v", err)
	}

	// Try to create circular reference: A -> B -> C -> A
	requestBody := map[string]interface{}{
		"name":        "Space A Updated",
		"description": "Updated description",
		"parent_id":   catC.ID,
	}

	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest("PUT", "/api/spaces/"+strconv.Itoa(catA.ID), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(catA.ID)})
	w := httptest.NewRecorder()

	// This should complete without hanging
	done := make(chan bool, 1)
	go func() {
		setup.spaceHandler.UpdateSpace(w, req)
		done <- true
	}()

	select {
	case <-done:
		// Operation completed
	case <-time.After(5 * time.Second):
		t.Fatal("UpdateSpace operation hanged with complex circular reference")
	}

	// Test all space operations with the potential circular reference
	operations := []struct {
		name string
		test func() error
	}{
		{
			name: "GetSpaces",
			test: func() error {
				req := httptest.NewRequest("GET", "/api/spaces", nil)
				w := httptest.NewRecorder()

				done := make(chan bool, 1)
				go func() {
					setup.spaceHandler.GetSpaces(w, req)
					done <- true
				}()

				select {
				case <-done:
					return nil
				case <-time.After(3 * time.Second):
					return fmt.Errorf("operation hanged")
				}
			},
		},
		{
			name: "GetSpacesByParent",
			test: func() error {
				req := httptest.NewRequest("GET", "/api/spaces/by-parent", nil)
				w := httptest.NewRecorder()

				done := make(chan bool, 1)
				go func() {
					setup.spaceHandler.GetSpacesByParent(w, req)
					done <- true
				}()

				select {
				case <-done:
					return nil
				case <-time.After(3 * time.Second):
					return fmt.Errorf("operation hanged")
				}
			},
		},
		{
			name: "GetSpace",
			test: func() error {
				req := httptest.NewRequest("GET", "/api/spaces/"+strconv.Itoa(catA.ID), nil)
				req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(catA.ID)})
				w := httptest.NewRecorder()

				done := make(chan bool, 1)
				go func() {
					setup.spaceHandler.GetSpace(w, req)
					done <- true
				}()

				select {
				case <-done:
					return nil
				case <-time.After(3 * time.Second):
					return fmt.Errorf("operation hanged")
				}
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

func TestCircularReference_SelfReference(t *testing.T) {
	setup, err := setupCircularTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create space
	cat, err := setup.spaceService.Create("Self Reference Space", nil, "Test space")
	if err != nil {
		t.Fatalf("Failed to create space: %v", err)
	}

	// Try to create self-reference
	requestBody := map[string]interface{}{
		"name":        "Self Reference Space Updated",
		"description": "Updated description",
		"parent_id":   cat.ID,
	}

	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest("PUT", "/api/spaces/"+strconv.Itoa(cat.ID), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(cat.ID)})
	w := httptest.NewRecorder()

	done := make(chan bool, 1)
	go func() {
		setup.spaceHandler.UpdateSpace(w, req)
		done <- true
	}()

	select {
	case <-done:
		// Self-reference should be prevented or handled gracefully
		if w.Code == http.StatusOK {
			// If it's allowed, verify no infinite loops occur
			req2 := httptest.NewRequest("GET", "/api/spaces", nil)
			w2 := httptest.NewRecorder()

			done2 := make(chan bool, 1)
			go func() {
				setup.spaceHandler.GetSpaces(w2, req2)
				done2 <- true
			}()

			select {
			case <-done2:
				// OK
			case <-time.After(3 * time.Second):
				t.Fatal("GetSpaces hanged after self-reference creation")
			}
		}
	case <-time.After(5 * time.Second):
		t.Fatal("UpdateSpace operation hanged with self-reference")
	}
}

func TestCircularReference_PostOperationsWithCircularSpaces(t *testing.T) {
	setup, err := setupCircularTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create spaces with potential circular reference
	catA, err := setup.spaceService.Create("Space A", nil, "Space A")
	if err != nil {
		t.Fatalf("Failed to create Space A: %v", err)
	}
	catB, err := setup.spaceService.Create("Space B", &catA.ID, "Space B")
	if err != nil {
		t.Fatalf("Failed to create Space B: %v", err)
	}
	catC, err := setup.spaceService.Create("Space C", &catB.ID, "Space C")
	if err != nil {
		t.Fatalf("Failed to create Space C: %v", err)
	}

	// Create posts in these spaces
	post1, err := setup.postService.Create(catA.ID, "Post in A", nil)
	if err != nil {
		t.Fatalf("Failed to create post in Space A: %v", err)
	}
	_, err = setup.postService.Create(catB.ID, "Post in B", nil)
	if err != nil {
		t.Fatalf("Failed to create post in Space B: %v", err)
	}
	post3, err := setup.postService.Create(catC.ID, "Post in C", nil)
	if err != nil {
		t.Fatalf("Failed to create post in Space C: %v", err)
	}

	// Try to create a circular reference: C -> A (A -> B -> C -> A)
	requestBody := map[string]interface{}{
		"name":        "Space C Updated",
		"description": "Updated description",
		"parent_id":   catA.ID,
	}

	// First, update C to point to A, creating potential circular reference
	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest("PUT", "/api/spaces/"+strconv.Itoa(catC.ID), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(catC.ID)})
	w := httptest.NewRecorder()

	done := make(chan bool, 1)
	go func() {
		setup.spaceHandler.UpdateSpace(w, req)
		done <- true
	}()

	select {
	case <-done:
		// Update completed
	case <-time.After(5 * time.Second):
		t.Fatal("Space update hanged when creating potential circular reference")
	}

	// Now test post operations with potential circular spaces
	postOperations := []struct {
		name string
		test func() error
	}{
		{
			name: "GetPostsBySpace_Recursive",
			test: func() error {
				req := httptest.NewRequest("GET", "/api/spaces/"+strconv.Itoa(catA.ID)+"/posts?recursive=true", nil)
				req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(catA.ID)})
				w := httptest.NewRecorder()

				done := make(chan bool, 1)
				go func() {
					setup.postHandler.GetPostsBySpace(w, req)
					done <- true
				}()

				select {
				case <-done:
					return nil
				case <-time.After(5 * time.Second):
					return fmt.Errorf("recursive post retrieval hanged")
				}
			},
		},
		{
			name: "CreatePost",
			test: func() error {
				requestBody := map[string]interface{}{
					"space_id": catA.ID,
					"content":     "New post in potentially circular space",
				}

				body, _ := json.Marshal(requestBody)
				req := httptest.NewRequest("POST", "/api/posts", bytes.NewBuffer(body))
				req.Header.Set("Content-Type", "application/json")
				w := httptest.NewRecorder()

				done := make(chan bool, 1)
				go func() {
					setup.postHandler.CreatePost(w, req)
					done <- true
				}()

				select {
				case <-done:
					return nil
				case <-time.After(5 * time.Second):
					return fmt.Errorf("post creation hanged")
				}
			},
		},
		{
			name: "MovePost",
			test: func() error {
				requestBody := map[string]interface{}{
					"space_id": catB.ID,
				}

				body, _ := json.Marshal(requestBody)
				req := httptest.NewRequest("PUT", "/api/posts/"+strconv.Itoa(post1.ID)+"/move", bytes.NewBuffer(body))
				req.Header.Set("Content-Type", "application/json")
				req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(post1.ID)})
				w := httptest.NewRecorder()

				done := make(chan bool, 1)
				go func() {
					setup.postHandler.MovePost(w, req)
					done <- true
				}()

				select {
				case <-done:
					return nil
				case <-time.After(5 * time.Second):
					return fmt.Errorf("post move hanged")
				}
			},
		},
		{
			name: "DeletePost",
			test: func() error {
				req := httptest.NewRequest("DELETE", "/api/posts/"+strconv.Itoa(post3.ID), nil)
				req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(post3.ID)})
				w := httptest.NewRecorder()

				done := make(chan bool, 1)
				go func() {
					setup.postHandler.DeletePost(w, req)
					done <- true
				}()

				select {
				case <-done:
					return nil
				case <-time.After(5 * time.Second):
					return fmt.Errorf("post deletion hanged")
				}
			},
		},
	}

	for _, op := range postOperations {
		t.Run(op.name, func(t *testing.T) {
			if err := op.test(); err != nil {
				t.Errorf("%s failed: %v", op.name, err)
			}
		})
	}
}

func TestCircularReference_SpaceDeletionWithCircularReference(t *testing.T) {
	setup, err := setupCircularTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create spaces: A -> B -> C
	catA, err := setup.spaceService.Create("Space A", nil, "Space A")
	if err != nil {
		t.Fatalf("Failed to create Space A: %v", err)
	}
	catB, err := setup.spaceService.Create("Space B", &catA.ID, "Space B")
	if err != nil {
		t.Fatalf("Failed to create Space B: %v", err)
	}
	catC, err := setup.spaceService.Create("Space C", &catB.ID, "Space C")
	if err != nil {
		t.Fatalf("Failed to create Space C: %v", err)
	}

	// Create posts in each space
	_, err = setup.postService.Create(catA.ID, "Post in A", nil)
	if err != nil {
		t.Fatalf("Failed to create post in Space A: %v", err)
	}
	_, err = setup.postService.Create(catB.ID, "Post in B", nil)
	if err != nil {
		t.Fatalf("Failed to create post in Space B: %v", err)
	}
	_, err = setup.postService.Create(catC.ID, "Post in C", nil)
	if err != nil {
		t.Fatalf("Failed to create post in Space C: %v", err)
	}

	// Create potential circular reference by making A point to C (A -> C -> B -> A)
	requestBody := map[string]interface{}{
		"name":        "Space A Updated",
		"description": "Updated description",
		"parent_id":   catC.ID,
	}

	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest("PUT", "/api/spaces/"+strconv.Itoa(catA.ID), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(catA.ID)})
	w := httptest.NewRecorder()

	// Update to create potential circular reference
	done := make(chan bool, 1)
	go func() {
		setup.spaceHandler.UpdateSpace(w, req)
		done <- true
	}()

	select {
	case <-done:
		// Update completed
	case <-time.After(5 * time.Second):
		t.Fatal("Space update hanged when creating circular reference")
	}

	// Try to delete one of the spaces in the potential circular structure
	req2 := httptest.NewRequest("DELETE", "/api/spaces/"+strconv.Itoa(catB.ID), nil)
	req2 = mux.SetURLVars(req2, map[string]string{"id": strconv.Itoa(catB.ID)})
	w2 := httptest.NewRecorder()

	done2 := make(chan bool, 1)
	go func() {
		setup.spaceHandler.DeleteSpace(w2, req2)
		done2 <- true
	}()

	select {
	case <-done2:
		// Deletion completed - should handle circular reference gracefully
	case <-time.After(10 * time.Second):
		t.Fatal("Space deletion hanged with circular reference")
	}

	// Verify system is still functional after deletion
	req3 := httptest.NewRequest("GET", "/api/spaces", nil)
	w3 := httptest.NewRecorder()

	done3 := make(chan bool, 1)
	go func() {
		setup.spaceHandler.GetSpaces(w3, req3)
		done3 <- true
	}()

	select {
	case <-done3:
		// Should work
	case <-time.After(3 * time.Second):
		t.Fatal("GetSpaces hanged after deletion with circular reference")
	}
}

func TestCircularReference_StressTestWithManyOperations(t *testing.T) {
	setup, err := setupCircularTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create spaces within depth limit: Root -> A, Root -> B, A -> C
	spaces := make([]*models.Space, 4)
	spaces[0], err = setup.spaceService.Create("Root Space", nil, "Root")
	if err != nil {
		t.Fatalf("Failed to create root space: %v", err)
	}

	// Create two spaces under root
	spaces[1], err = setup.spaceService.Create("Space A", &spaces[0].ID, "Space A")
	if err != nil {
		t.Fatalf("Failed to create Space A: %v", err)
	}

	spaces[2], err = setup.spaceService.Create("Space B", &spaces[0].ID, "Space B")
	if err != nil {
		t.Fatalf("Failed to create Space B: %v", err)
	}

	// Create one more at depth 2
	spaces[3], err = setup.spaceService.Create("Space C", &spaces[1].ID, "Space C")
	if err != nil {
		t.Fatalf("Failed to create Space C: %v", err)
	}

	// Create posts in each space
	for i, cat := range spaces {
		_, err := setup.postService.Create(cat.ID, fmt.Sprintf("Post in space %d", i), nil)
		if err != nil {
			t.Fatalf("Failed to create post in space %d: %v", i, err)
		}
	}

	// Try to create circular reference by making Root point to Space C
	// This creates: Root -> A -> C -> Root
	requestBody := map[string]interface{}{
		"name":        "Root Space Updated",
		"description": "Updated with circular reference",
		"parent_id":   spaces[3].ID,
	}

	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest("PUT", "/api/spaces/"+strconv.Itoa(spaces[0].ID), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(spaces[0].ID)})
	w := httptest.NewRecorder()

	done := make(chan bool, 1)
	go func() {
		setup.spaceHandler.UpdateSpace(w, req)
		done <- true
	}()

	select {
	case <-done:
		// Update completed
	case <-time.After(10 * time.Second):
		t.Fatal("Complex circular reference update hanged")
	}

	// Perform stress test with multiple operations
	numOperations := 100
	operationsDone := make(chan bool, numOperations)

	for i := 0; i < numOperations; i++ {
		go func(i int) {
			switch i % 4 {
			case 0:
				// Get spaces
				req := httptest.NewRequest("GET", "/api/spaces", nil)
				w := httptest.NewRecorder()
				setup.spaceHandler.GetSpaces(w, req)
			case 1:
				// Get posts by space
				catIdx := i % len(spaces)
				req := httptest.NewRequest("GET", "/api/spaces/"+strconv.Itoa(spaces[catIdx].ID)+"/posts?recursive=true", nil)
				req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(spaces[catIdx].ID)})
				w := httptest.NewRecorder()
				setup.postHandler.GetPostsBySpace(w, req)
			case 2:
				// Create new post
				catIdx := i % len(spaces)
				requestBody := map[string]interface{}{
					"space_id": spaces[catIdx].ID,
					"content":     fmt.Sprintf("Stress test post %d", i),
				}
				body, _ := json.Marshal(requestBody)
				req := httptest.NewRequest("POST", "/api/posts", bytes.NewBuffer(body))
				req.Header.Set("Content-Type", "application/json")
				w := httptest.NewRecorder()
				setup.postHandler.CreatePost(w, req)
			case 3:
				// Get spaces by parent
				req := httptest.NewRequest("GET", "/api/spaces/by-parent", nil)
				w := httptest.NewRecorder()
				setup.spaceHandler.GetSpacesByParent(w, req)
			}
			operationsDone <- true
		}(i)
	}

	// Wait for all operations with timeout
	completed := 0
	timeout := time.After(30 * time.Second)

	for completed < numOperations {
		select {
		case <-operationsDone:
			completed++
		case <-timeout:
			t.Fatalf("Stress test failed: only %d/%d operations completed before timeout", completed, numOperations)
		}
	}

	// All operations completed successfully
	t.Logf("Stress test passed: %d operations completed successfully with circular reference", numOperations)
}