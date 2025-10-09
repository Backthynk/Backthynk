package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	_ "github.com/mattn/go-sqlite3"
)

func TestSpaceSlugUniqueness(t *testing.T) {
	setup, err := setupSpaceTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	tests := []struct {
		name        string
		spaces      []string // Names to create in order
		shouldFail  []bool   // Whether each create should fail
		description string
	}{
		{
			name:        "Different names same slug - should fail",
			spaces:      []string{"My Space", "My-Space", "My_Space"},
			shouldFail:  []bool{false, true, true},
			description: "Names that generate the same slug should fail",
		},
		{
			name:        "Apostrophes removed in slug",
			spaces:      []string{"Johns Space", "John's Space"},
			shouldFail:  []bool{false, true},
			description: "Apostrophes are removed so these collide",
		},
		{
			name:        "Periods converted to hyphens",
			spaces:      []string{"Version 1.0", "Version 1-0"},
			shouldFail:  []bool{false, true},
			description: "Periods become hyphens so these collide",
		},
		{
			name:        "Case insensitive collision",
			spaces:      []string{"MySpace", "myspace", "MYSPACE"},
			shouldFail:  []bool{false, true, true},
			description: "Slug generation is case insensitive",
		},
		{
			name:        "Similar names that don't collide",
			spaces:      []string{"Space A", "Space B", "Space C"},
			shouldFail:  []bool{false, false, false},
			description: "Different slugs should all succeed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create fresh test setup for each test
			testSetup, err := setupSpaceTest()
			if err != nil {
				t.Fatalf("Failed to setup test: %v", err)
			}
			defer testSetup.cleanup()

			for i, spaceName := range tt.spaces {
				requestBody := map[string]interface{}{
					"name":        spaceName,
					"description": fmt.Sprintf("Test space %d", i),
				}

				body, _ := json.Marshal(requestBody)
				req := httptest.NewRequest("POST", "/api/spaces", bytes.NewBuffer(body))
				req.Header.Set("Content-Type", "application/json")
				w := httptest.NewRecorder()

				testSetup.handler.CreateSpace(w, req)

				if tt.shouldFail[i] {
					if w.Code == 201 {
						t.Errorf("Expected space '%s' to fail creation but it succeeded (slug collision not detected)", spaceName)
					}
				} else {
					if w.Code != 201 {
						t.Errorf("Expected space '%s' to be created successfully but got status %d: %s", spaceName, w.Code, w.Body.String())
					}
				}
			}
		})
	}
}

func TestSpaceSlugUniquenessWithHierarchy(t *testing.T) {
	setup, err := setupSpaceTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create parent spaces
	parent1, _ := setup.service.Create("Parent 1", nil, "Parent 1")
	parent2, _ := setup.service.Create("Parent 2", nil, "Parent 2")

	tests := []struct {
		name        string
		spaceName   string
		parentID    *int
		shouldFail  bool
		description string
	}{
		{
			name:        "Same slug different parents - should succeed",
			spaceName:   "Child Space",
			parentID:    &parent1.ID,
			shouldFail:  false,
			description: "Same slug OK in different parents",
		},
		{
			name:        "Same slug different parents - should succeed",
			spaceName:   "Child Space",
			parentID:    &parent2.ID,
			shouldFail:  false,
			description: "Same slug OK in different parents",
		},
		{
			name:        "Duplicate slug same parent - should fail",
			spaceName:   "Child-Space", // Different name but same slug as "Child Space"
			parentID:    &parent1.ID,
			shouldFail:  true,
			description: "Same slug in same parent should fail",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			requestBody := map[string]interface{}{
				"name":        tt.spaceName,
				"description": "Test",
			}
			if tt.parentID != nil {
				requestBody["parent_id"] = *tt.parentID
			}

			body, _ := json.Marshal(requestBody)
			req := httptest.NewRequest("POST", "/api/spaces", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			setup.handler.CreateSpace(w, req)

			if tt.shouldFail {
				if w.Code == 201 {
					t.Errorf("Expected creation to fail but it succeeded")
				}
			} else {
				if w.Code != 201 {
					t.Errorf("Expected creation to succeed but got status %d: %s", w.Code, w.Body.String())
				}
			}
		})
	}
}

func TestSpaceUpdateSlugUniqueness(t *testing.T) {
	setup, err := setupSpaceTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create initial spaces
	space1, _ := setup.service.Create("Space One", nil, "First space")
	space2, _ := setup.service.Create("Space Two", nil, "Second space")

	tests := []struct {
		name        string
		spaceID     int
		newName     string
		shouldFail  bool
		description string
	}{
		{
			name:        "Rename to unique name - should succeed",
			spaceID:     space1.ID,
			newName:     "Space Alpha",
			shouldFail:  false,
			description: "Renaming to unique name should work",
		},
		{
			name:        "Rename causing slug collision - should fail",
			spaceID:     space2.ID,
			newName:     "Space-Alpha", // Generates same slug as "Space Alpha"
			shouldFail:  true,
			description: "Rename that would create slug collision should fail",
		},
		{
			name:        "Rename to same name - should succeed",
			spaceID:     space1.ID,
			newName:     "Space Alpha", // Same as current name
			shouldFail:  false,
			description: "Renaming to same name should work",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Get current state before update
			currentSpace, _ := setup.service.Get(tt.spaceID)

			requestBody := map[string]interface{}{
				"name":        tt.newName,
				"description": currentSpace.Description,
			}

			body, _ := json.Marshal(requestBody)
			req := httptest.NewRequest("PUT", fmt.Sprintf("/api/spaces/%d", tt.spaceID), bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			req = mux.SetURLVars(req, map[string]string{"id": fmt.Sprintf("%d", tt.spaceID)})
			w := httptest.NewRecorder()

			setup.handler.UpdateSpace(w, req)

			if tt.shouldFail {
				if w.Code == 200 {
					t.Errorf("Expected update to fail but it succeeded")
				}
			} else {
				if w.Code != 200 {
					t.Errorf("Expected update to succeed but got status %d: %s", w.Code, w.Body.String())
				}
			}
		})
	}
}

func TestSpaceNameValidation(t *testing.T) {
	tests := []struct {
		name        string
		spaceName   string
		shouldFail  bool
		description string
	}{
		// Valid names - allowed characters
		{
			name:        "Valid name with spaces",
			spaceName:   "My Project Space",
			shouldFail:  false,
			description: "Spaces allowed",
		},
		{
			name:        "Valid name with hyphens",
			spaceName:   "My-Project-Space",
			shouldFail:  false,
			description: "Hyphens allowed",
		},
		{
			name:        "Valid name with underscores",
			spaceName:   "My_Project_Space",
			shouldFail:  false,
			description: "Underscores allowed",
		},
		{
			name:        "Valid name with apostrophe",
			spaceName:   "John's Space",
			shouldFail:  false,
			description: "Apostrophes allowed",
		},
		{
			name:        "Valid name with period",
			spaceName:   "Version 1.0",
			shouldFail:  false,
			description: "Periods allowed",
		},
		{
			name:        "Valid name with multiple periods",
			spaceName:   "Version 1.0.2",
			shouldFail:  false,
			description: "Multiple periods allowed",
		},
		{
			name:        "Valid French phrase",
			spaceName:   "I'm french",
			shouldFail:  false,
			description: "French with apostrophe allowed",
		},
		{
			name:        "Valid single character",
			spaceName:   "A",
			shouldFail:  false,
			description: "Single character allowed",
		},
		{
			name:        "Valid numbers only",
			spaceName:   "2024",
			shouldFail:  false,
			description: "Numbers only allowed",
		},
		{
			name:        "Valid all allowed chars combined",
			spaceName:   "My-Project_v1.0's",
			shouldFail:  false,
			description: "All allowed chars together",
		},

		// Invalid names - forbidden characters
		{
			name:        "Invalid name with special char @",
			spaceName:   "My@Space",
			shouldFail:  true,
			description: "@ not allowed",
		},
		{
			name:        "Invalid name with special char #",
			spaceName:   "Space#123",
			shouldFail:  true,
			description: "# not allowed",
		},
		{
			name:        "Invalid name with parentheses",
			spaceName:   "Space (Test)",
			shouldFail:  true,
			description: "Parentheses not allowed",
		},
		{
			name:        "Invalid name with brackets",
			spaceName:   "Space [Test]",
			shouldFail:  true,
			description: "Brackets not allowed",
		},
		{
			name:        "Invalid name with forward slash",
			spaceName:   "My/Space",
			shouldFail:  true,
			description: "Forward slash not allowed",
		},
		{
			name:        "Invalid name with percent",
			spaceName:   "100% Complete",
			shouldFail:  true,
			description: "Percent not allowed",
		},
		{
			name:        "Invalid name with ampersand",
			spaceName:   "You & Me",
			shouldFail:  true,
			description: "Ampersand not allowed",
		},
		{
			name:        "Invalid name with emoji",
			spaceName:   "My Space 🚀",
			shouldFail:  true,
			description: "Emoji not allowed",
		},
		{
			name:        "Invalid name with colon",
			spaceName:   "My:Space",
			shouldFail:  true,
			description: "Colon not allowed",
		},
		{
			name:        "Invalid name with semicolon",
			spaceName:   "My;Space",
			shouldFail:  true,
			description: "Semicolon not allowed",
		},
		{
			name:        "Invalid name with question mark",
			spaceName:   "My Space?",
			shouldFail:  true,
			description: "Question mark not allowed",
		},
		{
			name:        "Invalid name with exclamation",
			spaceName:   "My Space!",
			shouldFail:  true,
			description: "Exclamation not allowed",
		},

		// Invalid - consecutive special characters
		{
			name:        "Invalid double space",
			spaceName:   "My  Project",
			shouldFail:  true,
			description: "Double space not allowed",
		},
		{
			name:        "Invalid double hyphen",
			spaceName:   "My--Project",
			shouldFail:  true,
			description: "Double hyphen not allowed",
		},
		{
			name:        "Invalid double underscore",
			spaceName:   "My__Project",
			shouldFail:  true,
			description: "Double underscore not allowed",
		},
		{
			name:        "Invalid double period",
			spaceName:   "Version 1..0",
			shouldFail:  true,
			description: "Double period not allowed",
		},
		{
			name:        "Invalid double apostrophe",
			spaceName:   "it''s",
			shouldFail:  true,
			description: "Double apostrophe not allowed",
		},
		{
			name:        "Invalid space-hyphen combo",
			spaceName:   "My -Project",
			shouldFail:  true,
			description: "Space-hyphen combo not allowed",
		},
		{
			name:        "Invalid hyphen-underscore combo",
			spaceName:   "My-_Project",
			shouldFail:  true,
			description: "Hyphen-underscore combo not allowed",
		},
		{
			name:        "Invalid period-apostrophe combo",
			spaceName:   "Version.'1",
			shouldFail:  true,
			description: "Period-apostrophe combo not allowed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create fresh setup for each test to avoid slug collisions
			setup, err := setupSpaceTest()
			if err != nil {
				t.Fatalf("Failed to setup test: %v", err)
			}
			defer setup.cleanup()

			requestBody := map[string]interface{}{
				"name":        tt.spaceName,
				"description": "Test",
			}

			body, _ := json.Marshal(requestBody)
			req := httptest.NewRequest("POST", "/api/spaces", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			setup.handler.CreateSpace(w, req)

			if tt.shouldFail {
				if w.Code == 201 {
					t.Errorf("Expected name '%s' to be rejected but it was accepted", tt.spaceName)
				}
			} else {
				if w.Code != 201 {
					t.Errorf("Expected name '%s' to be accepted but got status %d: %s", tt.spaceName, w.Code, w.Body.String())
				}
			}
		})
	}
}

