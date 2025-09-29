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
			MaxContentLength          int  `json:"maxContentLength"`
			MaxFileSizeMB             int  `json:"maxFileSizeMB"`
			MaxFilesPerPost           int  `json:"maxFilesPerPost"`
			RetroactivePostingEnabled bool `json:"retroactivePostingEnabled"`
		}{
			MaxContentLength:          1000,
			MaxFileSizeMB:             10,
			MaxFilesPerPost:           5,
			RetroactivePostingEnabled: true,
		},
		Features: struct {
			Activity struct {
				Enabled      bool `json:"enabled"`
				PeriodMonths int  `json:"periodMonths"`
			} `json:"activity"`
			DetailedStats struct {
				Enabled        bool `json:"enabled"`
			} `json:"detailedStats"`
		}{
			Activity: struct {
				Enabled      bool `json:"enabled"`
				PeriodMonths int  `json:"periodMonths"`
			}{
				Enabled:      true,
				PeriodMonths: 4,
			},
			DetailedStats: struct {
				Enabled        bool `json:"enabled"`
			}{
				Enabled: true,
			},
		},
	}

	// Setup handlers
	categoryHandler := NewCategoryHandler(categoryService)
	postHandler := NewPostHandler(postService, fileService, options)

	return &circularTestSetup{
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

	// Create categories: A -> B
	catA, err := setup.categoryService.Create("Category A", nil, "Category A")
	if err != nil {
		t.Fatalf("Failed to create Category A: %v", err)
	}
	catB, err := setup.categoryService.Create("Category B", &catA.ID, "Category B")
	if err != nil {
		t.Fatalf("Failed to create Category B: %v", err)
	}

	// Try to create circular reference: A -> B -> A
	requestBody := map[string]interface{}{
		"name":        "Category A Updated",
		"description": "Updated description",
		"parent_id":   catB.ID,
	}

	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest("PUT", "/api/categories/"+strconv.Itoa(catA.ID), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(catA.ID)})
	w := httptest.NewRecorder()

	// This should complete without hanging
	done := make(chan bool, 1)
	go func() {
		setup.categoryHandler.UpdateCategory(w, req)
		done <- true
	}()

	// Set timeout to detect if operation hangs
	select {
	case <-done:
		// Operation completed - test passed
	case <-time.After(5 * time.Second):
		t.Fatal("UpdateCategory operation hanged - possible infinite loop")
	}

	// If update succeeded, test that GetCategories doesn't hang
	if w.Code == http.StatusOK {
		req2 := httptest.NewRequest("GET", "/api/categories", nil)
		w2 := httptest.NewRecorder()

		done2 := make(chan bool, 1)
		go func() {
			setup.categoryHandler.GetCategories(w2, req2)
			done2 <- true
		}()

		select {
		case <-done2:
			// Operation completed
		case <-time.After(5 * time.Second):
			t.Fatal("GetCategories operation hanged after circular reference creation")
		}

		// Test GetCategoriesByParent
		req3 := httptest.NewRequest("GET", "/api/categories/by-parent", nil)
		w3 := httptest.NewRecorder()

		done3 := make(chan bool, 1)
		go func() {
			setup.categoryHandler.GetCategoriesByParent(w3, req3)
			done3 <- true
		}()

		select {
		case <-done3:
			// Operation completed
		case <-time.After(5 * time.Second):
			t.Fatal("GetCategoriesByParent operation hanged after circular reference creation")
		}
	}
}

func TestCircularReference_ComplexLoop(t *testing.T) {
	setup, err := setupCircularTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create categories: A -> B -> C (within depth limit)
	catA, err := setup.categoryService.Create("Category A", nil, "Category A")
	if err != nil {
		t.Fatalf("Failed to create Category A: %v", err)
	}
	catB, err := setup.categoryService.Create("Category B", &catA.ID, "Category B")
	if err != nil {
		t.Fatalf("Failed to create Category B: %v", err)
	}
	catC, err := setup.categoryService.Create("Category C", &catB.ID, "Category C")
	if err != nil {
		t.Fatalf("Failed to create Category C: %v", err)
	}

	// Try to create circular reference: A -> B -> C -> A
	requestBody := map[string]interface{}{
		"name":        "Category A Updated",
		"description": "Updated description",
		"parent_id":   catC.ID,
	}

	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest("PUT", "/api/categories/"+strconv.Itoa(catA.ID), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(catA.ID)})
	w := httptest.NewRecorder()

	// This should complete without hanging
	done := make(chan bool, 1)
	go func() {
		setup.categoryHandler.UpdateCategory(w, req)
		done <- true
	}()

	select {
	case <-done:
		// Operation completed
	case <-time.After(5 * time.Second):
		t.Fatal("UpdateCategory operation hanged with complex circular reference")
	}

	// Test all category operations with the potential circular reference
	operations := []struct {
		name string
		test func() error
	}{
		{
			name: "GetCategories",
			test: func() error {
				req := httptest.NewRequest("GET", "/api/categories", nil)
				w := httptest.NewRecorder()

				done := make(chan bool, 1)
				go func() {
					setup.categoryHandler.GetCategories(w, req)
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
			name: "GetCategoriesByParent",
			test: func() error {
				req := httptest.NewRequest("GET", "/api/categories/by-parent", nil)
				w := httptest.NewRecorder()

				done := make(chan bool, 1)
				go func() {
					setup.categoryHandler.GetCategoriesByParent(w, req)
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
			name: "GetCategory",
			test: func() error {
				req := httptest.NewRequest("GET", "/api/categories/"+strconv.Itoa(catA.ID), nil)
				req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(catA.ID)})
				w := httptest.NewRecorder()

				done := make(chan bool, 1)
				go func() {
					setup.categoryHandler.GetCategory(w, req)
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

	// Create category
	cat, err := setup.categoryService.Create("Self Reference Category", nil, "Test category")
	if err != nil {
		t.Fatalf("Failed to create category: %v", err)
	}

	// Try to create self-reference
	requestBody := map[string]interface{}{
		"name":        "Self Reference Category Updated",
		"description": "Updated description",
		"parent_id":   cat.ID,
	}

	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest("PUT", "/api/categories/"+strconv.Itoa(cat.ID), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(cat.ID)})
	w := httptest.NewRecorder()

	done := make(chan bool, 1)
	go func() {
		setup.categoryHandler.UpdateCategory(w, req)
		done <- true
	}()

	select {
	case <-done:
		// Self-reference should be prevented or handled gracefully
		if w.Code == http.StatusOK {
			// If it's allowed, verify no infinite loops occur
			req2 := httptest.NewRequest("GET", "/api/categories", nil)
			w2 := httptest.NewRecorder()

			done2 := make(chan bool, 1)
			go func() {
				setup.categoryHandler.GetCategories(w2, req2)
				done2 <- true
			}()

			select {
			case <-done2:
				// OK
			case <-time.After(3 * time.Second):
				t.Fatal("GetCategories hanged after self-reference creation")
			}
		}
	case <-time.After(5 * time.Second):
		t.Fatal("UpdateCategory operation hanged with self-reference")
	}
}

func TestCircularReference_PostOperationsWithCircularCategories(t *testing.T) {
	setup, err := setupCircularTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create categories with potential circular reference
	catA, err := setup.categoryService.Create("Category A", nil, "Category A")
	if err != nil {
		t.Fatalf("Failed to create Category A: %v", err)
	}
	catB, err := setup.categoryService.Create("Category B", &catA.ID, "Category B")
	if err != nil {
		t.Fatalf("Failed to create Category B: %v", err)
	}
	catC, err := setup.categoryService.Create("Category C", &catB.ID, "Category C")
	if err != nil {
		t.Fatalf("Failed to create Category C: %v", err)
	}

	// Create posts in these categories
	post1, err := setup.postService.Create(catA.ID, "Post in A", nil)
	if err != nil {
		t.Fatalf("Failed to create post in Category A: %v", err)
	}
	_, err = setup.postService.Create(catB.ID, "Post in B", nil)
	if err != nil {
		t.Fatalf("Failed to create post in Category B: %v", err)
	}
	post3, err := setup.postService.Create(catC.ID, "Post in C", nil)
	if err != nil {
		t.Fatalf("Failed to create post in Category C: %v", err)
	}

	// Try to create a circular reference: C -> A (A -> B -> C -> A)
	requestBody := map[string]interface{}{
		"name":        "Category C Updated",
		"description": "Updated description",
		"parent_id":   catA.ID,
	}

	// First, update C to point to A, creating potential circular reference
	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest("PUT", "/api/categories/"+strconv.Itoa(catC.ID), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(catC.ID)})
	w := httptest.NewRecorder()

	done := make(chan bool, 1)
	go func() {
		setup.categoryHandler.UpdateCategory(w, req)
		done <- true
	}()

	select {
	case <-done:
		// Update completed
	case <-time.After(5 * time.Second):
		t.Fatal("Category update hanged when creating potential circular reference")
	}

	// Now test post operations with potential circular categories
	postOperations := []struct {
		name string
		test func() error
	}{
		{
			name: "GetPostsByCategory_Recursive",
			test: func() error {
				req := httptest.NewRequest("GET", "/api/categories/"+strconv.Itoa(catA.ID)+"/posts?recursive=true", nil)
				req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(catA.ID)})
				w := httptest.NewRecorder()

				done := make(chan bool, 1)
				go func() {
					setup.postHandler.GetPostsByCategory(w, req)
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
					"category_id": catA.ID,
					"content":     "New post in potentially circular category",
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
					"category_id": catB.ID,
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

func TestCircularReference_CategoryDeletionWithCircularReference(t *testing.T) {
	setup, err := setupCircularTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create categories: A -> B -> C
	catA, err := setup.categoryService.Create("Category A", nil, "Category A")
	if err != nil {
		t.Fatalf("Failed to create Category A: %v", err)
	}
	catB, err := setup.categoryService.Create("Category B", &catA.ID, "Category B")
	if err != nil {
		t.Fatalf("Failed to create Category B: %v", err)
	}
	catC, err := setup.categoryService.Create("Category C", &catB.ID, "Category C")
	if err != nil {
		t.Fatalf("Failed to create Category C: %v", err)
	}

	// Create posts in each category
	_, err = setup.postService.Create(catA.ID, "Post in A", nil)
	if err != nil {
		t.Fatalf("Failed to create post in Category A: %v", err)
	}
	_, err = setup.postService.Create(catB.ID, "Post in B", nil)
	if err != nil {
		t.Fatalf("Failed to create post in Category B: %v", err)
	}
	_, err = setup.postService.Create(catC.ID, "Post in C", nil)
	if err != nil {
		t.Fatalf("Failed to create post in Category C: %v", err)
	}

	// Create potential circular reference by making A point to C (A -> C -> B -> A)
	requestBody := map[string]interface{}{
		"name":        "Category A Updated",
		"description": "Updated description",
		"parent_id":   catC.ID,
	}

	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest("PUT", "/api/categories/"+strconv.Itoa(catA.ID), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(catA.ID)})
	w := httptest.NewRecorder()

	// Update to create potential circular reference
	done := make(chan bool, 1)
	go func() {
		setup.categoryHandler.UpdateCategory(w, req)
		done <- true
	}()

	select {
	case <-done:
		// Update completed
	case <-time.After(5 * time.Second):
		t.Fatal("Category update hanged when creating circular reference")
	}

	// Try to delete one of the categories in the potential circular structure
	req2 := httptest.NewRequest("DELETE", "/api/categories/"+strconv.Itoa(catB.ID), nil)
	req2 = mux.SetURLVars(req2, map[string]string{"id": strconv.Itoa(catB.ID)})
	w2 := httptest.NewRecorder()

	done2 := make(chan bool, 1)
	go func() {
		setup.categoryHandler.DeleteCategory(w2, req2)
		done2 <- true
	}()

	select {
	case <-done2:
		// Deletion completed - should handle circular reference gracefully
	case <-time.After(10 * time.Second):
		t.Fatal("Category deletion hanged with circular reference")
	}

	// Verify system is still functional after deletion
	req3 := httptest.NewRequest("GET", "/api/categories", nil)
	w3 := httptest.NewRecorder()

	done3 := make(chan bool, 1)
	go func() {
		setup.categoryHandler.GetCategories(w3, req3)
		done3 <- true
	}()

	select {
	case <-done3:
		// Should work
	case <-time.After(3 * time.Second):
		t.Fatal("GetCategories hanged after deletion with circular reference")
	}
}

func TestCircularReference_StressTestWithManyOperations(t *testing.T) {
	setup, err := setupCircularTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create categories within depth limit: Root -> A, Root -> B, A -> C
	categories := make([]*models.Category, 4)
	categories[0], err = setup.categoryService.Create("Root Category", nil, "Root")
	if err != nil {
		t.Fatalf("Failed to create root category: %v", err)
	}

	// Create two categories under root
	categories[1], err = setup.categoryService.Create("Category A", &categories[0].ID, "Category A")
	if err != nil {
		t.Fatalf("Failed to create Category A: %v", err)
	}

	categories[2], err = setup.categoryService.Create("Category B", &categories[0].ID, "Category B")
	if err != nil {
		t.Fatalf("Failed to create Category B: %v", err)
	}

	// Create one more at depth 2
	categories[3], err = setup.categoryService.Create("Category C", &categories[1].ID, "Category C")
	if err != nil {
		t.Fatalf("Failed to create Category C: %v", err)
	}

	// Create posts in each category
	for i, cat := range categories {
		_, err := setup.postService.Create(cat.ID, fmt.Sprintf("Post in category %d", i), nil)
		if err != nil {
			t.Fatalf("Failed to create post in category %d: %v", i, err)
		}
	}

	// Try to create circular reference by making Root point to Category C
	// This creates: Root -> A -> C -> Root
	requestBody := map[string]interface{}{
		"name":        "Root Category Updated",
		"description": "Updated with circular reference",
		"parent_id":   categories[3].ID,
	}

	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest("PUT", "/api/categories/"+strconv.Itoa(categories[0].ID), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(categories[0].ID)})
	w := httptest.NewRecorder()

	done := make(chan bool, 1)
	go func() {
		setup.categoryHandler.UpdateCategory(w, req)
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
				// Get categories
				req := httptest.NewRequest("GET", "/api/categories", nil)
				w := httptest.NewRecorder()
				setup.categoryHandler.GetCategories(w, req)
			case 1:
				// Get posts by category
				catIdx := i % len(categories)
				req := httptest.NewRequest("GET", "/api/categories/"+strconv.Itoa(categories[catIdx].ID)+"/posts?recursive=true", nil)
				req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(categories[catIdx].ID)})
				w := httptest.NewRecorder()
				setup.postHandler.GetPostsByCategory(w, req)
			case 2:
				// Create new post
				catIdx := i % len(categories)
				requestBody := map[string]interface{}{
					"category_id": categories[catIdx].ID,
					"content":     fmt.Sprintf("Stress test post %d", i),
				}
				body, _ := json.Marshal(requestBody)
				req := httptest.NewRequest("POST", "/api/posts", bytes.NewBuffer(body))
				req.Header.Set("Content-Type", "application/json")
				w := httptest.NewRecorder()
				setup.postHandler.CreatePost(w, req)
			case 3:
				// Get categories by parent
				req := httptest.NewRequest("GET", "/api/categories/by-parent", nil)
				w := httptest.NewRecorder()
				setup.categoryHandler.GetCategoriesByParent(w, req)
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