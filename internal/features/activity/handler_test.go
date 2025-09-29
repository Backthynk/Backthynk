package activity

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
)

func TestNewHandler(t *testing.T) {
	service := &Service{enabled: true}
	handler := NewHandler(service)

	if handler == nil {
		t.Fatal("Expected handler to be created")
	}

	if handler.service != service {
		t.Error("Expected handler to have the provided service")
	}
}

func TestRegisterRoutesEnabled(t *testing.T) {
	service := &Service{enabled: true}
	handler := NewHandler(service)
	router := mux.NewRouter()

	handler.RegisterRoutes(router)

	// Check if the route was registered
	req := httptest.NewRequest("GET", "/api/activity/1", nil)
	match := &mux.RouteMatch{}
	matched := router.Match(req, match)

	if !matched {
		t.Error("Expected activity route to be registered when enabled")
	}
}

func TestRegisterRoutesDisabled(t *testing.T) {
	service := &Service{enabled: false}
	handler := NewHandler(service)
	router := mux.NewRouter()

	handler.RegisterRoutes(router)

	// Check if the route was NOT registered
	req := httptest.NewRequest("GET", "/api/activity/1", nil)
	match := &mux.RouteMatch{}
	matched := router.Match(req, match)

	if matched {
		t.Error("Expected activity route NOT to be registered when disabled")
	}
}

func TestGetActivityPeriodInvalidCategoryID(t *testing.T) {
	service := &Service{enabled: true}
	handler := NewHandler(service)
	router := mux.NewRouter()
	handler.RegisterRoutes(router)

	req := httptest.NewRequest("GET", "/api/activity/invalid", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}

	body := w.Body.String()
	if body != "Invalid category ID\n" {
		t.Errorf("Expected 'Invalid category ID' error message, got '%s'", body)
	}
}

func TestGetActivityPeriodValidRequest(t *testing.T) {
	service := &Service{
		enabled:  true,
		activity: make(map[int]*CategoryActivity),
	}
	handler := NewHandler(service)
	router := mux.NewRouter()
	handler.RegisterRoutes(router)

	req := httptest.NewRequest("GET", "/api/activity/1", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	contentType := w.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("Expected Content-Type 'application/json', got '%s'", contentType)
	}

	var response ActivityPeriodResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.CategoryID != 1 {
		t.Errorf("Expected category ID 1, got %d", response.CategoryID)
	}
}

func TestGetActivityPeriodQueryParameters(t *testing.T) {
	service := &Service{
		enabled:  true,
		activity: make(map[int]*CategoryActivity),
	}
	handler := NewHandler(service)
	router := mux.NewRouter()
	handler.RegisterRoutes(router)

	testCases := []struct {
		name           string
		url            string
		expectedStatus int
	}{
		{
			name:           "Basic request",
			url:            "/api/activity/1",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "With recursive parameter",
			url:            "/api/activity/1?recursive=true",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "With period parameter",
			url:            "/api/activity/1?period=2",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "With period_months parameter",
			url:            "/api/activity/1?period_months=12",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "With start_date parameter",
			url:            "/api/activity/1?start_date=2023-01-01",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "With end_date parameter",
			url:            "/api/activity/1?end_date=2023-12-31",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "With all parameters",
			url:            "/api/activity/1?recursive=true&period=1&period_months=6&start_date=2023-01-01&end_date=2023-12-31",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Invalid period parameter",
			url:            "/api/activity/1?period=invalid",
			expectedStatus: http.StatusOK, // Should use default value
		},
		{
			name:           "Invalid period_months parameter",
			url:            "/api/activity/1?period_months=invalid",
			expectedStatus: http.StatusOK, // Should use default value
		},
		{
			name:           "Zero period_months parameter",
			url:            "/api/activity/1?period_months=0",
			expectedStatus: http.StatusOK, // Should use default value
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
				var response ActivityPeriodResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				if err != nil {
					t.Fatalf("Failed to unmarshal response: %v", err)
				}

				if response.CategoryID != 1 {
					t.Errorf("Expected category ID 1, got %d", response.CategoryID)
				}
			}
		})
	}
}

func TestGetActivityPeriodDefaultValues(t *testing.T) {
	service := &Service{
		enabled:  true,
		activity: make(map[int]*CategoryActivity),
	}
	handler := NewHandler(service)
	router := mux.NewRouter()
	handler.RegisterRoutes(router)

	req := httptest.NewRequest("GET", "/api/activity/1", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var response ActivityPeriodResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	// Verify default values are used
	if response.CategoryID != 1 {
		t.Errorf("Expected category ID 1, got %d", response.CategoryID)
	}

	if response.Period != 0 {
		t.Errorf("Expected default period 0, got %d", response.Period)
	}
}

func TestGetActivityPeriodMethodNotAllowed(t *testing.T) {
	service := &Service{enabled: true}
	handler := NewHandler(service)
	router := mux.NewRouter()
	handler.RegisterRoutes(router)

	req := httptest.NewRequest("POST", "/api/activity/1", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected status 405, got %d", w.Code)
	}
}

func TestGetActivityPeriodRecursiveParameter(t *testing.T) {
	service := &Service{
		enabled:  true,
		activity: make(map[int]*CategoryActivity),
	}
	handler := NewHandler(service)
	router := mux.NewRouter()
	handler.RegisterRoutes(router)

	// Test recursive=true
	req := httptest.NewRequest("GET", "/api/activity/1?recursive=true", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var response ActivityPeriodResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	// Test recursive=false (default)
	req = httptest.NewRequest("GET", "/api/activity/1", nil)
	w = httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	err = json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}
}

func TestGetActivityPeriodGlobalStats(t *testing.T) {
	service := &Service{
		enabled:  true,
		activity: make(map[int]*CategoryActivity),
	}
	handler := NewHandler(service)
	router := mux.NewRouter()
	handler.RegisterRoutes(router)

	req := httptest.NewRequest("GET", "/api/activity/0", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var response ActivityPeriodResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.CategoryID != 0 {
		t.Errorf("Expected category ID 0 for global stats, got %d", response.CategoryID)
	}
}

func TestActivityPeriodResponseStructure(t *testing.T) {
	service := &Service{
		enabled:  true,
		activity: make(map[int]*CategoryActivity),
	}
	handler := NewHandler(service)
	router := mux.NewRouter()
	handler.RegisterRoutes(router)

	req := httptest.NewRequest("GET", "/api/activity/1?recursive=true", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	// Check that the response can be unmarshaled into our struct
	var response ActivityPeriodResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	// Verify all expected fields are present
	if response.CategoryID != 1 {
		t.Errorf("Expected category ID 1, got %d", response.CategoryID)
	}

	if response.Period != 0 {
		t.Errorf("Expected default period 0, got %d", response.Period)
	}

	// Check JSON field names are correctly formatted
	jsonData := w.Body.Bytes()
	jsonStr := string(jsonData)

	expectedFields := []string{
		`"category_id"`,
		`"start_date"`,
		`"end_date"`,
		`"period"`,
		`"days"`,
		`"stats"`,
		`"max_periods"`,
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