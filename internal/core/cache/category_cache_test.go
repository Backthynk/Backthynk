package cache

import (
	"backthynk/internal/core/models"
	"testing"
)

func TestCategoryCache_HandleHierarchyChange(t *testing.T) {
	cache := NewCategoryCache()

	// Set up category hierarchy: 1 (5 posts) -> 2 (3 posts) -> 3 (2 posts)
	cat1 := &models.Category{ID: 1, Name: "Parent", ParentID: nil, PostCount: 5}
	cat2 := &models.Category{ID: 2, Name: "Child", ParentID: &[]int{1}[0], PostCount: 3}
	cat3 := &models.Category{ID: 3, Name: "Grandchild", ParentID: &[]int{2}[0], PostCount: 2}

	cache.Set(cat1)
	cache.Set(cat2)
	cache.Set(cat3)

	// Manually set initial recursive counts
	cat1.RecursivePostCount = 10 // 5 + 3 + 2
	cat2.RecursivePostCount = 5  // 3 + 2
	cat3.RecursivePostCount = 2  // 2

	t.Run("MoveCategoryToNewParent", func(t *testing.T) {
		// Move category 3 from parent 2 to parent 1 (making it a direct child of 1)
		oldParentID := 2
		newParentID := 1

		// Update the category in cache
		cat3.ParentID = &newParentID
		cache.Set(cat3)

		// Handle the hierarchy change
		cache.HandleHierarchyChange(3, &oldParentID, &newParentID)

		// Check updated recursive counts
		updatedCat1, _ := cache.Get(1)
		updatedCat2, _ := cache.Get(2)
		updatedCat3, _ := cache.Get(3)

		// Cat1 should still have 10 recursive posts (5 + 3 + 2 = 10) since 3 is still a descendant
		if updatedCat1.RecursivePostCount != 10 {
			t.Errorf("Expected category 1 recursive count to be 10, got %d", updatedCat1.RecursivePostCount)
		}

		// Cat2 should now have 3 recursive posts (3 only) since 3 is no longer a descendant
		if updatedCat2.RecursivePostCount != 3 {
			t.Errorf("Expected category 2 recursive count to be 3, got %d", updatedCat2.RecursivePostCount)
		}

		// Cat3 should still have 2 recursive posts (unchanged)
		if updatedCat3.RecursivePostCount != 2 {
			t.Errorf("Expected category 3 recursive count to be 2, got %d", updatedCat3.RecursivePostCount)
		}
	})

	t.Run("MoveCategoryToRoot", func(t *testing.T) {
		// Move category 2 to root (no parent)
		oldParentID := 1

		// Update the category in cache
		cat2.ParentID = nil
		cache.Set(cat2)

		// Handle the hierarchy change
		cache.HandleHierarchyChange(2, &oldParentID, nil)

		// Check updated recursive counts
		updatedCat1, _ := cache.Get(1)
		updatedCat2, _ := cache.Get(2)

		// Cat1 should now have 5 recursive posts (5 only) since 2 is no longer a descendant
		if updatedCat1.RecursivePostCount != 5 {
			t.Errorf("Expected category 1 recursive count to be 5, got %d", updatedCat1.RecursivePostCount)
		}

		// Cat2 should still have 3 recursive posts (unchanged since it has no descendants in this new state)
		if updatedCat2.RecursivePostCount != 3 {
			t.Errorf("Expected category 2 recursive count to be 3, got %d", updatedCat2.RecursivePostCount)
		}
	})
}

func TestCategoryCache_getDescendantPostCountUnlocked(t *testing.T) {
	cache := NewCategoryCache()

	// Set up hierarchy: 1 (5 posts) -> 2 (3 posts) -> 3 (2 posts)
	//                                -> 4 (1 post)
	cat1 := &models.Category{ID: 1, Name: "Root", ParentID: nil, PostCount: 5}
	cat2 := &models.Category{ID: 2, Name: "Child1", ParentID: &[]int{1}[0], PostCount: 3}
	cat3 := &models.Category{ID: 3, Name: "Grandchild", ParentID: &[]int{2}[0], PostCount: 2}
	cat4 := &models.Category{ID: 4, Name: "Child2", ParentID: &[]int{1}[0], PostCount: 1}

	cache.Set(cat1)
	cache.Set(cat2)
	cache.Set(cat3)
	cache.Set(cat4)

	testCases := []struct {
		name       string
		categoryID int
		expected   int
	}{
		{
			name:       "Root category includes all descendants",
			categoryID: 1,
			expected:   11, // 5 + 3 + 2 + 1
		},
		{
			name:       "Child with descendants",
			categoryID: 2,
			expected:   5, // 3 + 2
		},
		{
			name:       "Leaf category only itself",
			categoryID: 3,
			expected:   2, // 2 only
		},
		{
			name:       "Child with no descendants",
			categoryID: 4,
			expected:   1, // 1 only
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cache.mu.Lock()
			count := cache.getDescendantPostCountUnlocked(tc.categoryID)
			cache.mu.Unlock()

			if count != tc.expected {
				t.Errorf("Expected descendant post count for category %d to be %d, got %d",
					tc.categoryID, tc.expected, count)
			}
		})
	}
}

func TestCategoryCache_UpdatePostCount(t *testing.T) {
	cache := NewCategoryCache()

	// Set up hierarchy: 1 -> 2 -> 3
	cat1 := &models.Category{ID: 1, Name: "Parent", ParentID: nil, PostCount: 0, RecursivePostCount: 0}
	cat2 := &models.Category{ID: 2, Name: "Child", ParentID: &[]int{1}[0], PostCount: 0, RecursivePostCount: 0}
	cat3 := &models.Category{ID: 3, Name: "Grandchild", ParentID: &[]int{2}[0], PostCount: 0, RecursivePostCount: 0}

	cache.Set(cat1)
	cache.Set(cat2)
	cache.Set(cat3)

	// Add 2 posts to category 3
	cache.UpdatePostCount(3, 2)

	// Check counts
	updatedCat1, _ := cache.Get(1)
	updatedCat2, _ := cache.Get(2)
	updatedCat3, _ := cache.Get(3)

	// All ancestors should have updated recursive counts
	if updatedCat1.RecursivePostCount != 2 {
		t.Errorf("Expected category 1 recursive count to be 2, got %d", updatedCat1.RecursivePostCount)
	}
	if updatedCat2.RecursivePostCount != 2 {
		t.Errorf("Expected category 2 recursive count to be 2, got %d", updatedCat2.RecursivePostCount)
	}
	if updatedCat3.PostCount != 2 {
		t.Errorf("Expected category 3 post count to be 2, got %d", updatedCat3.PostCount)
	}
	if updatedCat3.RecursivePostCount != 2 {
		t.Errorf("Expected category 3 recursive count to be 2, got %d", updatedCat3.RecursivePostCount)
	}

	// Remove 1 post from category 3
	cache.UpdatePostCount(3, -1)

	// Check updated counts
	updatedCat1, _ = cache.Get(1)
	updatedCat2, _ = cache.Get(2)
	updatedCat3, _ = cache.Get(3)

	if updatedCat1.RecursivePostCount != 1 {
		t.Errorf("Expected category 1 recursive count to be 1 after decrement, got %d", updatedCat1.RecursivePostCount)
	}
	if updatedCat2.RecursivePostCount != 1 {
		t.Errorf("Expected category 2 recursive count to be 1 after decrement, got %d", updatedCat2.RecursivePostCount)
	}
	if updatedCat3.PostCount != 1 {
		t.Errorf("Expected category 3 post count to be 1 after decrement, got %d", updatedCat3.PostCount)
	}
	if updatedCat3.RecursivePostCount != 1 {
		t.Errorf("Expected category 3 recursive count to be 1 after decrement, got %d", updatedCat3.RecursivePostCount)
	}
}

func TestCategoryCache_PostCountPreservationDuringHierarchyChange(t *testing.T) {
	cache := NewCategoryCache()

	// Set up hierarchy: 1 (5 posts) -> 2 (3 posts) -> 3 (2 posts)
	cat1 := &models.Category{ID: 1, Name: "Parent", ParentID: nil, PostCount: 5}
	cat2 := &models.Category{ID: 2, Name: "Child", ParentID: &[]int{1}[0], PostCount: 3}
	cat3 := &models.Category{ID: 3, Name: "Grandchild", ParentID: &[]int{2}[0], PostCount: 2}
	cat4 := &models.Category{ID: 4, Name: "NewParent", ParentID: nil, PostCount: 0}

	cache.Set(cat1)
	cache.Set(cat2)
	cache.Set(cat3)
	cache.Set(cat4)

	// Set initial recursive counts (simulate normal operation)
	cat1.RecursivePostCount = 10 // 5 + 3 + 2
	cat2.RecursivePostCount = 5  // 3 + 2
	cat3.RecursivePostCount = 2  // 2
	cat4.RecursivePostCount = 0  // 0

	t.Run("PostCountsPreservedAfterMove", func(t *testing.T) {
		// Move category 3 from parent 2 to parent 4
		oldParentID := 2
		newParentID := 4

		// Simulate the service layer update - this would normally reset counts to 0
		// but our fix should prevent this by preserving the counts before calling HandleHierarchyChange

		// Create a new category object as the database would return (without post counts)
		updatedCat3 := &models.Category{
			ID: 3,
			Name: "Grandchild Moved",
			ParentID: &newParentID,
			PostCount: 0,  // Database returns 0 since post counts are managed by cache
			RecursivePostCount: 0,  // Database returns 0 since recursive counts are managed by cache
		}

		// Get the cached version with correct post counts
		cachedCat3, _ := cache.Get(3)

		// Preserve post counts (this is what the fix does)
		updatedCat3.PostCount = cachedCat3.PostCount
		updatedCat3.RecursivePostCount = cachedCat3.RecursivePostCount

		// Update cache and handle hierarchy change
		cache.Set(updatedCat3)
		cache.HandleHierarchyChange(3, &oldParentID, &newParentID)

		// Verify counts are preserved and hierarchy is updated correctly
		finalCat1, _ := cache.Get(1)
		finalCat2, _ := cache.Get(2)
		finalCat3, _ := cache.Get(3)
		finalCat4, _ := cache.Get(4)

		// Cat3 should retain its original post counts
		if finalCat3.PostCount != 2 {
			t.Errorf("Expected category 3 post count to be preserved at 2, got %d", finalCat3.PostCount)
		}
		if finalCat3.RecursivePostCount != 2 {
			t.Errorf("Expected category 3 recursive post count to be preserved at 2, got %d", finalCat3.RecursivePostCount)
		}

		// Cat1 should have reduced recursive count (5 + 3 = 8, lost the 2 from cat3)
		if finalCat1.RecursivePostCount != 8 {
			t.Errorf("Expected category 1 recursive count to be 8 after move, got %d", finalCat1.RecursivePostCount)
		}

		// Cat2 should have reduced recursive count (3 only, lost the 2 from cat3)
		if finalCat2.RecursivePostCount != 3 {
			t.Errorf("Expected category 2 recursive count to be 3 after move, got %d", finalCat2.RecursivePostCount)
		}

		// Cat4 should have gained recursive count (0 + 2 = 2)
		if finalCat4.RecursivePostCount != 2 {
			t.Errorf("Expected category 4 recursive count to be 2 after move, got %d", finalCat4.RecursivePostCount)
		}
	})
}