package detailedstats

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
)

func TestNewStatsHandler(t *testing.T) {
	service := &Service{enabled: true}
	handler := NewHandler(service)

	if handler == nil {
		t.Fatal("Expected handler to be created")
	}

	if handler.service != service {
		t.Error("Expected handler to have the provided service")
	}
}

func TestStatsRegisterRoutesEnabled(t *testing.T) {
	service := &Service{enabled: true}
	handler := NewHandler(service)
	router := mux.NewRouter()

	handler.RegisterRoutes(router)

	// Check if the route was registered
	req := httptest.NewRequest("GET", "/api/space-stats/1", nil)
	match := &mux.RouteMatch{}
	matched := router.Match(req, match)

	if !matched {
		t.Error("Expected space-stats route to be registered when enabled")
	}
}

func TestStatsRegisterRoutesDisabled(t *testing.T) {
	service := &Service{enabled: false}
	handler := NewHandler(service)
	router := mux.NewRouter()

	handler.RegisterRoutes(router)

	// Check if the route was NOT registered
	req := httptest.NewRequest("GET", "/api/space-stats/1", nil)
	match := &mux.RouteMatch{}
	matched := router.Match(req, match)

	if matched {
		t.Error("Expected space-stats route NOT to be registered when disabled")
	}
}

func TestGetSpaceStatsInvalidSpaceID(t *testing.T) {
	service := &Service{enabled: true}
	handler := NewHandler(service)
	router := mux.NewRouter()
	handler.RegisterRoutes(router)

	req := httptest.NewRequest("GET", "/api/space-stats/invalid", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}

	body := w.Body.String()
	if body != "Invalid space ID\n" {
		t.Errorf("Expected 'Invalid space ID' error message, got '%s'", body)
	}
}

func TestGetSpaceStatsValidRequest(t *testing.T) {
	service := &Service{
		enabled: true,
		stats:   make(map[int]*SpaceStats),
	}
	handler := NewHandler(service)
	router := mux.NewRouter()
	handler.RegisterRoutes(router)

	// Create some test stats manually to avoid updateStats which requires catCache
	service.mu.Lock()
	service.stats[1] = &SpaceStats{
		Direct:    Stats{FileCount: 5, TotalSize: 1000},
		Recursive: Stats{FileCount: 5, TotalSize: 1000},
	}
	service.mu.Unlock()

	req := httptest.NewRequest("GET", "/api/space-stats/1", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	contentType := w.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("Expected Content-Type 'application/json', got '%s'", contentType)
	}

	var response StatsResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.SpaceID != 1 {
		t.Errorf("Expected space ID 1, got %d", response.SpaceID)
	}

	if response.FileCount != 5 {
		t.Errorf("Expected 5 files, got %d", response.FileCount)
	}

	if response.TotalSize != 1000 {
		t.Errorf("Expected 1000 total size, got %d", response.TotalSize)
	}

	if response.Recursive {
		t.Error("Expected recursive to be false by default")
	}
}

func TestGetSpaceStatsRecursiveParameter(t *testing.T) {
	service := &Service{
		enabled: true,
		stats:   make(map[int]*SpaceStats),
	}
	handler := NewHandler(service)
	router := mux.NewRouter()
	handler.RegisterRoutes(router)

	// Create some test stats manually
	service.mu.Lock()
	service.stats[1] = &SpaceStats{
		Direct:    Stats{FileCount: 5, TotalSize: 1000},
		Recursive: Stats{FileCount: 5, TotalSize: 1000},
	}
	service.mu.Unlock()

	// Test recursive=true
	req := httptest.NewRequest("GET", "/api/space-stats/1?recursive=true", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var response StatsResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if !response.Recursive {
		t.Error("Expected recursive to be true")
	}

	if response.FileCount != 5 {
		t.Errorf("Expected 5 files with recursive=true, got %d", response.FileCount)
	}

	if response.TotalSize != 1000 {
		t.Errorf("Expected 1000 total size with recursive=true, got %d", response.TotalSize)
	}

	// Test recursive=false (default)
	req = httptest.NewRequest("GET", "/api/space-stats/1", nil)
	w = httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	err = json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.Recursive {
		t.Error("Expected recursive to be false by default")
	}

	if response.FileCount != 5 {
		t.Errorf("Expected 5 files with recursive=false, got %d", response.FileCount)
	}

	if response.TotalSize != 1000 {
		t.Errorf("Expected 1000 total size with recursive=false, got %d", response.TotalSize)
	}
}

func TestGetSpaceStatsGlobalStats(t *testing.T) {
	service := &Service{
		enabled: true,
		stats:   make(map[int]*SpaceStats),
	}
	handler := NewHandler(service)
	router := mux.NewRouter()
	handler.RegisterRoutes(router)

	// Create stats for multiple spaces manually
	service.mu.Lock()
	service.stats[1] = &SpaceStats{
		Direct:    Stats{FileCount: 5, TotalSize: 1000},
		Recursive: Stats{FileCount: 5, TotalSize: 1000},
	}
	service.stats[2] = &SpaceStats{
		Direct:    Stats{FileCount: 3, TotalSize: 500},
		Recursive: Stats{FileCount: 3, TotalSize: 500},
	}
	service.mu.Unlock()

	req := httptest.NewRequest("GET", "/api/space-stats/0", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var response StatsResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.SpaceID != 0 {
		t.Errorf("Expected space ID 0 for global stats, got %d", response.SpaceID)
	}

	// Should include files from all spaces
	if response.FileCount != 8 { // 5 + 3
		t.Errorf("Expected 8 files globally, got %d", response.FileCount)
	}

	if response.TotalSize != 1500 { // 1000 + 500
		t.Errorf("Expected 1500 total size globally, got %d", response.TotalSize)
	}
}

func TestGetSpaceStatsNonExistentSpace(t *testing.T) {
	service := &Service{
		enabled: true,
		stats:   make(map[int]*SpaceStats),
	}
	handler := NewHandler(service)
	router := mux.NewRouter()
	handler.RegisterRoutes(router)

	req := httptest.NewRequest("GET", "/api/space-stats/999", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var response StatsResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.SpaceID != 999 {
		t.Errorf("Expected space ID 999, got %d", response.SpaceID)
	}

	if response.FileCount != 0 {
		t.Errorf("Expected 0 files for non-existent space, got %d", response.FileCount)
	}

	if response.TotalSize != 0 {
		t.Errorf("Expected 0 total size for non-existent space, got %d", response.TotalSize)
	}
}

func TestGetSpaceStatsMethodNotAllowed(t *testing.T) {
	service := &Service{enabled: true}
	handler := NewHandler(service)
	router := mux.NewRouter()
	handler.RegisterRoutes(router)

	req := httptest.NewRequest("POST", "/api/space-stats/1", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected status 405, got %d", w.Code)
	}
}

func TestGetSpaceStatsQueryParameterParsing(t *testing.T) {
	service := &Service{
		enabled: true,
		stats:   make(map[int]*SpaceStats),
	}
	handler := NewHandler(service)
	router := mux.NewRouter()
	handler.RegisterRoutes(router)

	// Create some test stats manually
	service.mu.Lock()
	service.stats[1] = &SpaceStats{
		Direct:    Stats{FileCount: 5, TotalSize: 1000},
		Recursive: Stats{FileCount: 5, TotalSize: 1000},
	}
	service.mu.Unlock()

	testCases := []struct {
		name              string
		url               string
		expectedRecursive bool
		expectedStatus    int
	}{
		{
			name:              "No recursive parameter",
			url:               "/api/space-stats/1",
			expectedRecursive: false,
			expectedStatus:    http.StatusOK,
		},
		{
			name:              "Recursive true",
			url:               "/api/space-stats/1?recursive=true",
			expectedRecursive: true,
			expectedStatus:    http.StatusOK,
		},
		{
			name:              "Recursive false",
			url:               "/api/space-stats/1?recursive=false",
			expectedRecursive: false,
			expectedStatus:    http.StatusOK,
		},
		{
			name:              "Recursive invalid value",
			url:               "/api/space-stats/1?recursive=invalid",
			expectedRecursive: false,
			expectedStatus:    http.StatusOK,
		},
		{
			name:              "Multiple query parameters",
			url:               "/api/space-stats/1?recursive=true&other=value",
			expectedRecursive: true,
			expectedStatus:    http.StatusOK,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", tc.url, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code != tc.expectedStatus {
				t.Errorf("Expected status %d, got %d", tc.expectedStatus, w.Code)
			}

			if w.Code == http.StatusOK {
				var response StatsResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				if err != nil {
					t.Fatalf("Failed to unmarshal response: %v", err)
				}

				if response.Recursive != tc.expectedRecursive {
					t.Errorf("Expected recursive %v, got %v", tc.expectedRecursive, response.Recursive)
				}
			}
		})
	}
}

func TestStatsResponseStructure(t *testing.T) {
	service := &Service{
		enabled: true,
		stats:   make(map[int]*SpaceStats),
	}
	handler := NewHandler(service)
	router := mux.NewRouter()
	handler.RegisterRoutes(router)

	// Create some test stats manually
	service.mu.Lock()
	service.stats[1] = &SpaceStats{
		Direct:    Stats{FileCount: 5, TotalSize: 1000},
		Recursive: Stats{FileCount: 5, TotalSize: 1000},
	}
	service.mu.Unlock()

	req := httptest.NewRequest("GET", "/api/space-stats/1?recursive=true", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	// Check that the response can be unmarshaled into our struct
	var response StatsResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	// Verify all fields are present and correct
	if response.SpaceID != 1 {
		t.Errorf("Expected space ID 1, got %d", response.SpaceID)
	}

	if response.Recursive != true {
		t.Errorf("Expected recursive true, got %v", response.Recursive)
	}

	if response.FileCount != 5 {
		t.Errorf("Expected file count 5, got %d", response.FileCount)
	}

	if response.TotalSize != 1000 {
		t.Errorf("Expected total size 1000, got %d", response.TotalSize)
	}

	// Check JSON field names
	jsonData := w.Body.Bytes()
	jsonStr := string(jsonData)

	expectedFields := []string{
		`"space_id"`,
		`"recursive"`,
		`"file_count"`,
		`"total_size"`,
	}

	for _, field := range expectedFields {
		if !containsSubstring(jsonStr, field) {
			t.Errorf("Expected JSON to contain field %s", field)
		}
	}
}

// Helper function to check if a string contains a substring
func containsSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}