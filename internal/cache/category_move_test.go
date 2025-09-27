package cache

import (
	"backthynk/internal/models"
	"testing"
	"time"
)

func TestCategoryMove_IsolatedTest(t *testing.T) {
	// Create a fresh coordinator instance for this test
	coordinator := GetCacheCoordinator()
	postCountCache := GetPostCountCache()

	// Setup simple hierarchy: Tech -> Software -> Programming
	//                                -> Hardware
	categories := []models.Category{
		{ID: 1, Name: "Technology", ParentID: nil, Depth: 0},
		{ID: 2, Name: "Software", ParentID: intPtr(1), Depth: 1},
		{ID: 3, Name: "Hardware", ParentID: intPtr(1), Depth: 1},
		{ID: 4, Name: "Programming", ParentID: intPtr(2), Depth: 2},
	}

	err := coordinator.InitializeHierarchy(categories)
	if err != nil {
		t.Fatalf("Failed to initialize hierarchy: %v", err)
	}

	// Set fresh post counts
	postCountCache.SetPostCount(1, 20) // Technology: 20 direct posts
	postCountCache.SetPostCount(2, 15) // Software: 15 direct posts
	postCountCache.SetPostCount(3, 10) // Hardware: 10 direct posts
	postCountCache.SetPostCount(4, 8)  // Programming: 8 direct posts

	// Check initial state
	initialTech := postCountCache.GetPostCountRecursive(1)     // Should be 20+15+10+8 = 53
	initialSoftware := postCountCache.GetPostCountRecursive(2) // Should be 15+8 = 23
	initialHardware := postCountCache.GetPostCountRecursive(3) // Should be 10
	programmingCount := postCountCache.GetPostCount(4)         // Should be 8

	t.Logf("Initial state - Tech: %d, Software: %d, Hardware: %d, Programming: %d",
		initialTech, initialSoftware, initialHardware, programmingCount)

	// Verify initial state is correct
	if initialTech != 53 {
		t.Errorf("Initial Tech recursive count should be 53, got %d", initialTech)
	}
	if initialSoftware != 23 {
		t.Errorf("Initial Software recursive count should be 23, got %d", initialSoftware)
	}
	if initialHardware != 10 {
		t.Errorf("Initial Hardware recursive count should be 10, got %d", initialHardware)
	}

	// Now move Programming from Software to Hardware
	coordinator.ProcessEvent(CacheEvent{
		Type:        EventCategoryMoved,
		CategoryID:  4,          // Programming
		OldParentID: intPtr(2),  // From Software
		NewParentID: intPtr(3),  // To Hardware
		Timestamp:   time.Now().UnixMilli(),
	})

	// Wait for processing
	time.Sleep(300 * time.Millisecond)

	// Check state after move
	afterTech := postCountCache.GetPostCountRecursive(1)
	afterSoftware := postCountCache.GetPostCountRecursive(2)
	afterHardware := postCountCache.GetPostCountRecursive(3)

	t.Logf("After move - Tech: %d, Software: %d, Hardware: %d",
		afterTech, afterSoftware, afterHardware)

	// Expected after move:
	// Technology: 20+15+10+8 = 53 (unchanged, still contains all)
	// Software: 15 (lost programming)
	// Hardware: 10+8 = 18 (gained programming)

	if afterTech != 53 {
		t.Errorf("Technology recursive count should remain 53, got %d", afterTech)
	}
	if afterSoftware != 15 {
		t.Errorf("Software recursive count should be 15 after losing programming, got %d", afterSoftware)
	}
	if afterHardware != 18 {
		t.Errorf("Hardware recursive count should be 18 after gaining programming, got %d", afterHardware)
	}

	// Verify programming's direct count didn't change
	afterProgramming := postCountCache.GetPostCount(4)
	if afterProgramming != 8 {
		t.Errorf("Programming direct count should remain 8, got %d", afterProgramming)
	}
}

func TestCategoryMove_StepByStep(t *testing.T) {
	coordinator := GetCacheCoordinator()
	postCountCache := GetPostCountCache()

	// Simple 2-level hierarchy for easier debugging
	categories := []models.Category{
		{ID: 10, Name: "Root", ParentID: nil, Depth: 0},
		{ID: 11, Name: "Branch A", ParentID: intPtr(10), Depth: 1},
		{ID: 12, Name: "Branch B", ParentID: intPtr(10), Depth: 1},
		{ID: 13, Name: "Leaf", ParentID: intPtr(11), Depth: 2},
	}

	err := coordinator.InitializeHierarchy(categories)
	if err != nil {
		t.Fatalf("Failed to initialize hierarchy: %v", err)
	}

	// Set counts: Root=1, Branch A=2, Branch B=3, Leaf=4
	postCountCache.SetPostCount(10, 1) // Root
	postCountCache.SetPostCount(11, 2) // Branch A
	postCountCache.SetPostCount(12, 3) // Branch B
	postCountCache.SetPostCount(13, 4) // Leaf

	// Initial recursive counts:
	// Root: 1+2+3+4 = 10
	// Branch A: 2+4 = 6
	// Branch B: 3
	// Leaf: 4

	rootBefore := postCountCache.GetPostCountRecursive(10)
	branchABefore := postCountCache.GetPostCountRecursive(11)
	branchBBefore := postCountCache.GetPostCountRecursive(12)
	leafBefore := postCountCache.GetPostCount(13)

	t.Logf("Before move - Root: %d, Branch A: %d, Branch B: %d, Leaf: %d",
		rootBefore, branchABefore, branchBBefore, leafBefore)

	// Move Leaf from Branch A to Branch B
	coordinator.ProcessEvent(CacheEvent{
		Type:        EventCategoryMoved,
		CategoryID:  13,         // Leaf
		OldParentID: intPtr(11), // From Branch A
		NewParentID: intPtr(12), // To Branch B
		Timestamp:   time.Now().UnixMilli(),
	})

	time.Sleep(200 * time.Millisecond)

	// After move:
	// Root: 1+2+3+4 = 10 (unchanged)
	// Branch A: 2 (lost leaf)
	// Branch B: 3+4 = 7 (gained leaf)
	// Leaf: 4 (unchanged)

	rootAfter := postCountCache.GetPostCountRecursive(10)
	branchAAfter := postCountCache.GetPostCountRecursive(11)
	branchBAfter := postCountCache.GetPostCountRecursive(12)
	leafAfter := postCountCache.GetPostCount(13)

	t.Logf("After move - Root: %d, Branch A: %d, Branch B: %d, Leaf: %d",
		rootAfter, branchAAfter, branchBAfter, leafAfter)

	// Verify results
	if rootAfter != 10 {
		t.Errorf("Root should remain 10, got %d", rootAfter)
	}
	if branchAAfter != 2 {
		t.Errorf("Branch A should be 2 after losing leaf, got %d", branchAAfter)
	}
	if branchBAfter != 7 {
		t.Errorf("Branch B should be 7 after gaining leaf, got %d", branchBAfter)
	}
	if leafAfter != 4 {
		t.Errorf("Leaf should remain 4, got %d", leafAfter)
	}
}

// intPtr helper function (using the one from coordinator_test.go)