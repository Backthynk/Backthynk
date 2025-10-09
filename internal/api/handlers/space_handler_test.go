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

	"github.com/gorilla/mux"
	_ "github.com/mattn/go-sqlite3"
)

type spaceTestSetup struct {
	handler     *SpaceHandler
	service     *services.SpaceService
	db          *storage.DB
	cache       *cache.SpaceCache
	dispatcher  *events.Dispatcher
}

func setupSpaceTest() (*spaceTestSetup, error) {
	// Create a temporary directory for the test
	tempDir := "/tmp/backthynk_test_" + fmt.Sprintf("%d", os.Getpid())
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		return nil, err
	}

	// Initialize test config files
	serviceConfigContent := `{
		"server": {"port": "8080"},
		"files": {
			"configFilename": "options.json",
			"databaseFilename": "test.db",
			"uploadsSubdir": "uploads",
			"storagePath": "` + tempDir + `"
		}
	}`

	if err := os.WriteFile(tempDir+"/service.json", []byte(serviceConfigContent), 0644); err != nil {
		return nil, err
	}

	// Change to temp directory and load config
	originalDir, _ := os.Getwd()
	os.Chdir(tempDir)
	defer os.Chdir(originalDir)

	// Load config
	if err := config.LoadServiceConfig(); err != nil {
		return nil, err
	}

	// Setup test database
	db, err := storage.NewDB(tempDir)
	if err != nil {
		return nil, err
	}

	// Setup cache and dispatcher
	spaceCache := cache.NewSpaceCache()
	dispatcher := events.NewDispatcher()

	// Setup service
	spaceService := services.NewSpaceService(db, spaceCache, dispatcher)

	// Initialize cache
	if err := spaceService.InitializeCache(); err != nil {
		return nil, err
	}

	// Setup handler
	handler := NewSpaceHandler(spaceService)

	return &spaceTestSetup{
		handler:    handler,
		service:    spaceService,
		db:         db,
		cache:      spaceCache,
		dispatcher: dispatcher,
	}, nil
}

func (setup *spaceTestSetup) cleanup() {
	if setup.db != nil {
		setup.db.Close()
	}
	// Clean up test directory
	tempDir := "/tmp/backthynk_test_" + fmt.Sprintf("%d", os.Getpid())
	os.RemoveAll(tempDir)
}

func TestSpaceHandler_GetSpaces(t *testing.T) {
	setup, err := setupSpaceTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create test spaces
	cat1, _ := setup.service.Create("Space 1", nil, "Description 1")
	setup.service.Create("Space 2", nil, "Description 2")
	setup.service.Create("Subspace", &cat1.ID, "Subspace desc")

	req := httptest.NewRequest("GET", "/api/spaces", nil)
	w := httptest.NewRecorder()

	setup.handler.GetSpaces(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var spaces []*models.Space
	if err := json.Unmarshal(w.Body.Bytes(), &spaces); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if len(spaces) != 3 {
		t.Errorf("Expected 3 spaces, got %d", len(spaces))
	}

	// Verify content-type
	if w.Header().Get("Content-Type") != "application/json" {
		t.Errorf("Expected application/json content type")
	}

	// Verify spaces are returned with proper structure
	foundNames := make(map[string]bool)
	for _, cat := range spaces {
		foundNames[cat.Name] = true
		if cat.Name == "Space 1" && cat.ParentID != nil {
			t.Errorf("Space 1 should have nil parent")
		}
		if cat.Name == "Subspace" && (cat.ParentID == nil || *cat.ParentID != cat1.ID) {
			t.Errorf("Subspace should have Space 1 as parent")
		}
	}

	expectedNames := []string{"Space 1", "Space 2", "Subspace"}
	for _, name := range expectedNames {
		if !foundNames[name] {
			t.Errorf("Expected to find space: %s", name)
		}
	}
}

func TestSpaceHandler_GetSpace(t *testing.T) {
	setup, err := setupSpaceTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create test space
	cat, _ := setup.service.Create("Test Space", nil, "Test Description")

	tests := []struct {
		name           string
		spaceID     string
		expectedStatus int
		expectError    bool
	}{
		{
			name:           "Valid space ID",
			spaceID:     strconv.Itoa(cat.ID),
			expectedStatus: http.StatusOK,
			expectError:    false,
		},
		{
			name:           "Invalid space ID format",
			spaceID:     "invalid",
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name:           "Non-existent space ID",
			spaceID:     "999",
			expectedStatus: http.StatusNotFound,
			expectError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/spaces/"+tt.spaceID, nil)
			w := httptest.NewRecorder()

			// Setup mux vars
			req = mux.SetURLVars(req, map[string]string{"id": tt.spaceID})

			setup.handler.GetSpace(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if !tt.expectError {
				var returnedCat models.Space
				if err := json.Unmarshal(w.Body.Bytes(), &returnedCat); err != nil {
					t.Fatalf("Failed to unmarshal response: %v", err)
				}

				if returnedCat.ID != cat.ID {
					t.Errorf("Expected space ID %d, got %d", cat.ID, returnedCat.ID)
				}
				if returnedCat.Name != cat.Name {
					t.Errorf("Expected space name %s, got %s", cat.Name, returnedCat.Name)
				}
			}
		})
	}
}

func TestSpaceHandler_GetSpacesByParent(t *testing.T) {
	setup, err := setupSpaceTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create test spaces
	parent1, _ := setup.service.Create("Parent 1", nil, "Parent 1 desc")
	parent2, _ := setup.service.Create("Parent 2", nil, "Parent 2 desc")
	setup.service.Create("Child 1", &parent1.ID, "Child 1 desc")
	setup.service.Create("Child 2", &parent1.ID, "Child 2 desc")
	setup.service.Create("Child 3", &parent2.ID, "Child 3 desc")

	tests := []struct {
		name           string
		parentID       string
		expectedCount  int
		expectedStatus int
		expectError    bool
	}{
		{
			name:           "Get root spaces (no parent_id)",
			parentID:       "",
			expectedCount:  2, // parent1 and parent2
			expectedStatus: http.StatusOK,
			expectError:    false,
		},
		{
			name:           "Get children of parent1",
			parentID:       strconv.Itoa(parent1.ID),
			expectedCount:  2, // child1 and child2
			expectedStatus: http.StatusOK,
			expectError:    false,
		},
		{
			name:           "Get children of parent2",
			parentID:       strconv.Itoa(parent2.ID),
			expectedCount:  1, // child3
			expectedStatus: http.StatusOK,
			expectError:    false,
		},
		{
			name:           "Invalid parent_id format",
			parentID:       "invalid",
			expectedCount:  0,
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name:           "Non-existent parent",
			parentID:       "999",
			expectedCount:  0,
			expectedStatus: http.StatusOK,
			expectError:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url := "/api/spaces/by-parent"
			if tt.parentID != "" {
				url += "?parent_id=" + tt.parentID
			}

			req := httptest.NewRequest("GET", url, nil)
			w := httptest.NewRecorder()

			setup.handler.GetSpacesByParent(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if !tt.expectError {
				var spaces []*models.Space
				if err := json.Unmarshal(w.Body.Bytes(), &spaces); err != nil {
					t.Fatalf("Failed to unmarshal response: %v", err)
				}

				if len(spaces) != tt.expectedCount {
					t.Errorf("Expected %d spaces, got %d", tt.expectedCount, len(spaces))
				}
			}
		})
	}
}

func TestSpaceHandler_CreateSpace(t *testing.T) {
	setup, err := setupSpaceTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create a parent space for testing
	parent, _ := setup.service.Create("Parent Space", nil, "Parent desc")

	tests := []struct {
		name           string
		requestBody    interface{}
		expectedStatus int
		expectError    bool
	}{
		{
			name: "Valid space creation",
			requestBody: map[string]interface{}{
				"name":        "Test Space",
				"description": "Test Description",
			},
			expectedStatus: http.StatusCreated,
			expectError:    false,
		},
		{
			name: "Valid space with parent",
			requestBody: map[string]interface{}{
				"name":        "Child Space",
				"description": "Child Description",
				"parent_id":   parent.ID,
			},
			expectedStatus: http.StatusCreated,
			expectError:    false,
		},
		{
			name: "Missing name",
			requestBody: map[string]interface{}{
				"description": "Test Description",
			},
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name: "Empty name",
			requestBody: map[string]interface{}{
				"name":        "",
				"description": "Test Description",
			},
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name:           "Invalid JSON",
			requestBody:    "invalid json",
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var body []byte
			if str, ok := tt.requestBody.(string); ok {
				body = []byte(str)
			} else {
				body, _ = json.Marshal(tt.requestBody)
			}

			req := httptest.NewRequest("POST", "/api/spaces", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			setup.handler.CreateSpace(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if !tt.expectError && w.Code == http.StatusCreated {
				var createdCat models.Space
				if err := json.Unmarshal(w.Body.Bytes(), &createdCat); err != nil {
					t.Fatalf("Failed to unmarshal response: %v", err)
				}

				if req, ok := tt.requestBody.(map[string]interface{}); ok {
					if name, exists := req["name"]; exists && createdCat.Name != name {
						t.Errorf("Expected name %s, got %s", name, createdCat.Name)
					}
					if desc, exists := req["description"]; exists && createdCat.Description != desc {
						t.Errorf("Expected description %s, got %s", desc, createdCat.Description)
					}
				}

				if createdCat.ID == 0 {
					t.Error("Expected non-zero ID for created space")
				}
			}
		})
	}
}

func TestSpaceHandler_UpdateSpace(t *testing.T) {
	setup, err := setupSpaceTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create test spaces
	cat, _ := setup.service.Create("Original Space", nil, "Original desc")
	parent, _ := setup.service.Create("Parent Space", nil, "Parent desc")

	tests := []struct {
		name           string
		spaceID     string
		requestBody    interface{}
		expectedStatus int
		expectError    bool
	}{
		{
			name:       "Valid update",
			spaceID: strconv.Itoa(cat.ID),
			requestBody: map[string]interface{}{
				"name":        "Updated Space",
				"description": "Updated Description",
			},
			expectedStatus: http.StatusOK,
			expectError:    false,
		},
		{
			name:       "Update with parent",
			spaceID: strconv.Itoa(cat.ID),
			requestBody: map[string]interface{}{
				"name":        "Updated with Parent",
				"description": "Updated Description",
				"parent_id":   parent.ID,
			},
			expectedStatus: http.StatusOK,
			expectError:    false,
		},
		{
			name:       "Invalid space ID",
			spaceID: "invalid",
			requestBody: map[string]interface{}{
				"name":        "Updated Space",
				"description": "Updated Description",
			},
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name:       "Non-existent space",
			spaceID: "999",
			requestBody: map[string]interface{}{
				"name":        "Updated Space",
				"description": "Updated Description",
			},
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name:       "Empty name",
			spaceID: strconv.Itoa(cat.ID),
			requestBody: map[string]interface{}{
				"name":        "",
				"description": "Updated Description",
			},
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var body []byte
			if str, ok := tt.requestBody.(string); ok {
				body = []byte(str)
			} else {
				body, _ = json.Marshal(tt.requestBody)
			}

			req := httptest.NewRequest("PUT", "/api/spaces/"+tt.spaceID, bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			req = mux.SetURLVars(req, map[string]string{"id": tt.spaceID})
			w := httptest.NewRecorder()

			setup.handler.UpdateSpace(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if !tt.expectError && w.Code == http.StatusOK {
				var updatedCat models.Space
				if err := json.Unmarshal(w.Body.Bytes(), &updatedCat); err != nil {
					t.Fatalf("Failed to unmarshal response: %v", err)
				}

				if req, ok := tt.requestBody.(map[string]interface{}); ok {
					if name, exists := req["name"]; exists && updatedCat.Name != name {
						t.Errorf("Expected name %s, got %s", name, updatedCat.Name)
					}
				}
			}
		})
	}
}

func TestSpaceHandler_DeleteSpace(t *testing.T) {
	setup, err := setupSpaceTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create test spaces
	parent, _ := setup.service.Create("Parent Space", nil, "Parent desc")
	setup.service.Create("Child Space", &parent.ID, "Child desc")

	tests := []struct {
		name           string
		spaceID     string
		expectedStatus int
		expectError    bool
	}{
		{
			name:           "Delete parent space (should cascade)",
			spaceID:     strconv.Itoa(parent.ID),
			expectedStatus: http.StatusNoContent,
			expectError:    false,
		},
		{
			name:           "Invalid space ID",
			spaceID:     "invalid",
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name:           "Non-existent space",
			spaceID:     "999",
			expectedStatus: http.StatusNotFound,
			expectError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("DELETE", "/api/spaces/"+tt.spaceID, nil)
			req = mux.SetURLVars(req, map[string]string{"id": tt.spaceID})
			w := httptest.NewRecorder()

			setup.handler.DeleteSpace(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			// For successful deletions, verify the space is actually deleted
			if !tt.expectError && w.Code == http.StatusNoContent {
				id, _ := strconv.Atoi(tt.spaceID)
				_, err := setup.service.Get(id)
				if err == nil {
					t.Error("Expected space to be deleted, but it still exists")
				}
			}
		})
	}
}

func TestSpaceHandler_CircularReferenceProtection(t *testing.T) {
	setup, err := setupSpaceTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create a chain of spaces
	cat1, _ := setup.service.Create("Space 1", nil, "Cat 1")
	cat2, _ := setup.service.Create("Space 2", &cat1.ID, "Cat 2")
	cat3, _ := setup.service.Create("Space 3", &cat2.ID, "Cat 3")

	// Try to create a circular reference: cat1 -> cat3 (which would create cat1 -> cat3 -> cat2 -> cat1)
	requestBody := map[string]interface{}{
		"name":        "Space 1 Updated",
		"description": "Updated",
		"parent_id":   cat3.ID,
	}

	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest("PUT", "/api/spaces/"+strconv.Itoa(cat1.ID), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(cat1.ID)})
	w := httptest.NewRecorder()

	setup.handler.UpdateSpace(w, req)

	// This should either fail with BadRequest or succeed with proper circular reference handling
	if w.Code != http.StatusBadRequest && w.Code != http.StatusOK {
		t.Errorf("Expected either 400 or 200 status, got %d", w.Code)
	}

	// If it succeeded, verify no infinite loops occur when getting spaces
	if w.Code == http.StatusOK {
		// Test that GetSpaces doesn't hang
		req2 := httptest.NewRequest("GET", "/api/spaces", nil)
		w2 := httptest.NewRecorder()

		// This should complete without hanging
		setup.handler.GetSpaces(w2, req2)

		if w2.Code != http.StatusOK {
			t.Errorf("GetSpaces failed after potential circular reference: %d", w2.Code)
		}
	}
}

func TestSpaceHandler_ConcurrentOperations(t *testing.T) {
	setup, err := setupSpaceTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create initial space
	parent, _ := setup.service.Create("Parent", nil, "Parent desc")

	// Test concurrent creates
	numGoroutines := 10
	done := make(chan error, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		go func(i int) {
			requestBody := map[string]interface{}{
				"name":        fmt.Sprintf("Concurrent Space %d", i),
				"description": fmt.Sprintf("Description %d", i),
				"parent_id":   parent.ID,
			}

			body, _ := json.Marshal(requestBody)
			req := httptest.NewRequest("POST", "/api/spaces", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			setup.handler.CreateSpace(w, req)

			if w.Code != http.StatusCreated {
				done <- fmt.Errorf("concurrent create failed with status %d", w.Code)
				return
			}
			done <- nil
		}(i)
	}

	// Wait for all goroutines
	for i := 0; i < numGoroutines; i++ {
		if err := <-done; err != nil {
			t.Errorf("Concurrent operation failed: %v", err)
		}
	}

	// Verify all spaces were created
	req := httptest.NewRequest("GET", "/api/spaces", nil)
	w := httptest.NewRecorder()
	setup.handler.GetSpaces(w, req)

	var spaces []*models.Space
	json.Unmarshal(w.Body.Bytes(), &spaces)

	// Should have 1 parent + 10 children = 11 total
	if len(spaces) != 11 {
		t.Errorf("Expected 11 spaces after concurrent creates, got %d", len(spaces))
	}
}

func TestSpaceHandler_DataConsistency(t *testing.T) {
	setup, err := setupSpaceTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create spaces and verify consistent state
	parent, _ := setup.service.Create("Parent", nil, "Parent desc")
	child1, _ := setup.service.Create("Child 1", &parent.ID, "Child 1 desc")
	setup.service.Create("Child 2", &parent.ID, "Child 2 desc")

	// Test 1: Verify hierarchy consistency
	req := httptest.NewRequest("GET", "/api/spaces/by-parent?parent_id="+strconv.Itoa(parent.ID), nil)
	w := httptest.NewRecorder()
	setup.handler.GetSpacesByParent(w, req)

	var children []*models.Space
	json.Unmarshal(w.Body.Bytes(), &children)

	if len(children) != 2 {
		t.Errorf("Expected 2 children, got %d", len(children))
	}

	// Test 2: Verify depth calculation
	grandchild, _ := setup.service.Create("Grandchild", &child1.ID, "Grandchild desc")

	req = httptest.NewRequest("GET", "/api/spaces/"+strconv.Itoa(grandchild.ID), nil)
	req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(grandchild.ID)})
	w = httptest.NewRecorder()
	setup.handler.GetSpace(w, req)

	var retrievedGrandchild models.Space
	json.Unmarshal(w.Body.Bytes(), &retrievedGrandchild)

	if retrievedGrandchild.Depth != 2 {
		t.Errorf("Expected grandchild depth 2, got %d", retrievedGrandchild.Depth)
	}

	// Test 3: Verify deletion cascade
	req = httptest.NewRequest("DELETE", "/api/spaces/"+strconv.Itoa(parent.ID), nil)
	req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(parent.ID)})
	w = httptest.NewRecorder()
	setup.handler.DeleteSpace(w, req)

	if w.Code != http.StatusNoContent {
		t.Errorf("Expected successful deletion, got %d", w.Code)
	}

	// Verify all related spaces are deleted
	req = httptest.NewRequest("GET", "/api/spaces", nil)
	w = httptest.NewRecorder()
	setup.handler.GetSpaces(w, req)

	var remainingSpaces []*models.Space
	json.Unmarshal(w.Body.Bytes(), &remainingSpaces)

	if len(remainingSpaces) != 0 {
		t.Errorf("Expected 0 spaces after cascade delete, got %d", len(remainingSpaces))
	}
}