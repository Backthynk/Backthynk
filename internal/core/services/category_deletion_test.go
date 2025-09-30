package services

import (
	"backthynk/internal/config"
	"backthynk/internal/core/cache"
	"backthynk/internal/core/events"
	"backthynk/internal/storage"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"
)

type categoryDeletionTestSetup struct {
	categoryService *CategoryService
	postService     *PostService
	db              *storage.DB
	cache           *cache.CategoryCache
	dispatcher      *events.Dispatcher
	tempDir         string
	uploadsDir      string
}

func setupCategoryDeletionTest() (*categoryDeletionTestSetup, error) {
	// Create a temporary directory for the test
	tempDir := "/tmp/backthynk_category_deletion_test_" + fmt.Sprintf("%d", os.Getpid())
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		return nil, err
	}

	uploadsDir := filepath.Join(tempDir, "uploads")
	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
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
	categoryCache := cache.NewCategoryCache()
	dispatcher := events.NewDispatcher()

	// Setup services
	categoryService := NewCategoryService(db, categoryCache, dispatcher)
	postService := NewPostService(db, categoryCache, dispatcher)

	// Initialize cache
	if err := categoryService.InitializeCache(); err != nil {
		return nil, err
	}

	return &categoryDeletionTestSetup{
		categoryService: categoryService,
		postService:     postService,
		db:              db,
		cache:           categoryCache,
		dispatcher:      dispatcher,
		tempDir:         tempDir,
		uploadsDir:      uploadsDir,
	}, nil
}

func (setup *categoryDeletionTestSetup) cleanup() {
	if setup.db != nil {
		setup.db.Close()
	}
	os.RemoveAll(setup.tempDir)
}

func (setup *categoryDeletionTestSetup) createTestFile(filename, content string) (string, error) {
	filePath := filepath.Join(setup.uploadsDir, filename)
	if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
		return "", err
	}
	return filename, nil // Return relative path for database
}

func TestCategoryDeletionWithPostsAndAttachments(t *testing.T) {
	setup, err := setupCategoryDeletionTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create category hierarchy: Parent -> Child1, Child2
	parent, err := setup.categoryService.Create("Parent Category", nil, "Parent desc")
	if err != nil {
		t.Fatalf("Failed to create parent category: %v", err)
	}

	child1, err := setup.categoryService.Create("Child 1", &parent.ID, "Child 1 desc")
	if err != nil {
		t.Fatalf("Failed to create child1 category: %v", err)
	}

	child2, err := setup.categoryService.Create("Child 2", &parent.ID, "Child 2 desc")
	if err != nil {
		t.Fatalf("Failed to create child2 category: %v", err)
	}

	// Create posts with attachments in each category
	post1, err := setup.postService.Create(parent.ID, "Post in parent", nil)
	if err != nil {
		t.Fatalf("Failed to create post1: %v", err)
	}

	post2, err := setup.postService.Create(child1.ID, "Post in child1", nil)
	if err != nil {
		t.Fatalf("Failed to create post2: %v", err)
	}

	post3, err := setup.postService.Create(child2.ID, "Post in child2", nil)
	if err != nil {
		t.Fatalf("Failed to create post3: %v", err)
	}

	// Create test files and attachments
	file1Path, err := setup.createTestFile("test1.txt", "Test file 1 content")
	if err != nil {
		t.Fatalf("Failed to create test file 1: %v", err)
	}

	file2Path, err := setup.createTestFile("test2.txt", "Test file 2 content")
	if err != nil {
		t.Fatalf("Failed to create test file 2: %v", err)
	}

	file3Path, err := setup.createTestFile("test3.txt", "Test file 3 content")
	if err != nil {
		t.Fatalf("Failed to create test file 3: %v", err)
	}

	// Add attachments to posts
	_, err = setup.db.CreateAttachment(post1.ID, "test1.txt", file1Path, "text/plain", 100)
	if err != nil {
		t.Fatalf("Failed to create attachment 1: %v", err)
	}

	_, err = setup.db.CreateAttachment(post2.ID, "test2.txt", file2Path, "text/plain", 200)
	if err != nil {
		t.Fatalf("Failed to create attachment 2: %v", err)
	}

	_, err = setup.db.CreateAttachment(post3.ID, "test3.txt", file3Path, "text/plain", 300)
	if err != nil {
		t.Fatalf("Failed to create attachment 3: %v", err)
	}

	// Verify initial state
	verifyFileExists := func(fileName string) bool {
		_, err := os.Stat(filepath.Join(setup.uploadsDir, fileName))
		return err == nil
	}

	if !verifyFileExists("test1.txt") || !verifyFileExists("test2.txt") || !verifyFileExists("test3.txt") {
		t.Fatal("Test files should exist before deletion")
	}

	// Verify initial cache post counts
	parentCat, _ := setup.cache.Get(parent.ID)
	child1Cat, _ := setup.cache.Get(child1.ID)
	child2Cat, _ := setup.cache.Get(child2.ID)

	if parentCat.PostCount != 1 {
		t.Errorf("Expected parent post count 1, got %d", parentCat.PostCount)
	}
	if child1Cat.PostCount != 1 {
		t.Errorf("Expected child1 post count 1, got %d", child1Cat.PostCount)
	}
	if child2Cat.PostCount != 1 {
		t.Errorf("Expected child2 post count 1, got %d", child2Cat.PostCount)
	}
	if parentCat.RecursivePostCount != 3 {
		t.Errorf("Expected parent recursive post count 3, got %d", parentCat.RecursivePostCount)
	}

	// Count event captures
	var deletedEvents []events.Event
	setup.dispatcher.Subscribe(events.PostDeleted, func(event events.Event) error {
		deletedEvents = append(deletedEvents, event)
		return nil
	})

	var categoryDeletedEvents []events.Event
	setup.dispatcher.Subscribe(events.CategoryDeleted, func(event events.Event) error {
		categoryDeletedEvents = append(categoryDeletedEvents, event)
		return nil
	})

	// Delete parent category (should cascade to children and all posts)
	err = setup.categoryService.Delete(parent.ID)
	if err != nil {
		t.Fatalf("Failed to delete parent category: %v", err)
	}

	// Give events time to be processed
	time.Sleep(50 * time.Millisecond)

	// Verify all physical files are deleted
	if verifyFileExists("test1.txt") {
		t.Error("test1.txt should be deleted")
	}
	if verifyFileExists("test2.txt") {
		t.Error("test2.txt should be deleted")
	}
	if verifyFileExists("test3.txt") {
		t.Error("test3.txt should be deleted")
	}

	// Verify all categories are deleted from cache
	if _, exists := setup.cache.Get(parent.ID); exists {
		t.Error("Parent category should be deleted from cache")
	}
	if _, exists := setup.cache.Get(child1.ID); exists {
		t.Error("Child1 category should be deleted from cache")
	}
	if _, exists := setup.cache.Get(child2.ID); exists {
		t.Error("Child2 category should be deleted from cache")
	}

	// Verify all categories are deleted from database
	_, err = setup.db.GetCategory(parent.ID)
	if err == nil {
		t.Error("Parent category should be deleted from database")
	}
	_, err = setup.db.GetCategory(child1.ID)
	if err == nil {
		t.Error("Child1 category should be deleted from database")
	}
	_, err = setup.db.GetCategory(child2.ID)
	if err == nil {
		t.Error("Child2 category should be deleted from database")
	}

	// Verify all posts are deleted from database
	_, err = setup.db.GetPost(post1.ID)
	if err == nil {
		t.Error("Post1 should be deleted from database")
	}
	_, err = setup.db.GetPost(post2.ID)
	if err == nil {
		t.Error("Post2 should be deleted from database")
	}
	_, err = setup.db.GetPost(post3.ID)
	if err == nil {
		t.Error("Post3 should be deleted from database")
	}

	// Verify all attachments are deleted from database
	attachments1, err := setup.db.GetAttachmentsByPost(post1.ID)
	if err == nil && len(attachments1) > 0 {
		t.Error("Post1 attachments should be deleted from database")
	}
	attachments2, err := setup.db.GetAttachmentsByPost(post2.ID)
	if err == nil && len(attachments2) > 0 {
		t.Error("Post2 attachments should be deleted from database")
	}
	attachments3, err := setup.db.GetAttachmentsByPost(post3.ID)
	if err == nil && len(attachments3) > 0 {
		t.Error("Post3 attachments should be deleted from database")
	}

	// Verify PostDeleted events were fired for all posts
	if len(deletedEvents) != 3 {
		t.Errorf("Expected 3 PostDeleted events, got %d", len(deletedEvents))
	}

	// Verify PostDeleted events contain correct file information
	expectedFileCounts := map[int]int{post1.ID: 1, post2.ID: 1, post3.ID: 1}
	expectedFileSizes := map[int]int64{post1.ID: 100, post2.ID: 200, post3.ID: 300}

	for _, event := range deletedEvents {
		data := event.Data.(events.PostEvent)
		expectedCount := expectedFileCounts[data.PostID]
		expectedSize := expectedFileSizes[data.PostID]

		if data.FileCount != expectedCount {
			t.Errorf("Expected file count %d for post %d, got %d", expectedCount, data.PostID, data.FileCount)
		}
		if data.FileSize != expectedSize {
			t.Errorf("Expected file size %d for post %d, got %d", expectedSize, data.PostID, data.FileSize)
		}
	}

	// Verify CategoryDeleted event was fired
	if len(categoryDeletedEvents) != 1 {
		t.Errorf("Expected 1 CategoryDeleted event, got %d", len(categoryDeletedEvents))
	}

	if len(categoryDeletedEvents) > 0 {
		data := categoryDeletedEvents[0].Data.(events.CategoryEvent)
		if data.CategoryID != parent.ID {
			t.Errorf("Expected CategoryDeleted event for category %d, got %d", parent.ID, data.CategoryID)
		}
		if len(data.AffectedPosts) != 3 {
			t.Errorf("Expected 3 affected posts in CategoryDeleted event, got %d", len(data.AffectedPosts))
		}
	}
}

func TestCategoryDeletionCacheConsistency(t *testing.T) {
	setup, err := setupCategoryDeletionTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create a complex hierarchy: Root -> Branch1 -> Leaf1, Branch2 -> Leaf2, Leaf3
	root, _ := setup.categoryService.Create("Root", nil, "Root category")
	branch1, _ := setup.categoryService.Create("Branch1", &root.ID, "Branch 1")
	branch2, _ := setup.categoryService.Create("Branch2", &root.ID, "Branch 2")
	leaf1, _ := setup.categoryService.Create("Leaf1", &branch1.ID, "Leaf 1")
	leaf2, _ := setup.categoryService.Create("Leaf2", &branch2.ID, "Leaf 2")
	leaf3, _ := setup.categoryService.Create("Leaf3", &branch2.ID, "Leaf 3")

	// Add posts to each category
	setup.postService.Create(root.ID, "Root post", nil)
	setup.postService.Create(branch1.ID, "Branch1 post", nil)
	setup.postService.Create(branch2.ID, "Branch2 post", nil)
	setup.postService.Create(leaf1.ID, "Leaf1 post", nil)
	setup.postService.Create(leaf2.ID, "Leaf2 post 1", nil)
	setup.postService.Create(leaf2.ID, "Leaf2 post 2", nil)
	setup.postService.Create(leaf3.ID, "Leaf3 post", nil)

	// Verify initial recursive counts
	rootCat, _ := setup.cache.Get(root.ID)
	if rootCat.RecursivePostCount != 7 { // All posts
		t.Errorf("Expected root recursive count 7, got %d", rootCat.RecursivePostCount)
	}

	branch2Cat, _ := setup.cache.Get(branch2.ID)
	if branch2Cat.RecursivePostCount != 4 { // Branch2 + Leaf2(2) + Leaf3
		t.Errorf("Expected branch2 recursive count 4, got %d", branch2Cat.RecursivePostCount)
	}

	// Delete branch2 (should remove branch2, leaf2, leaf3 and their posts)
	err = setup.categoryService.Delete(branch2.ID)
	if err != nil {
		t.Fatalf("Failed to delete branch2: %v", err)
	}

	// Verify remaining categories still exist and have correct counts
	rootCat, exists := setup.cache.Get(root.ID)
	if !exists {
		t.Fatal("Root category should still exist")
	}
	if rootCat.PostCount != 1 { // Only root's direct post
		t.Errorf("Expected root post count 1 after deletion, got %d", rootCat.PostCount)
	}
	if rootCat.RecursivePostCount != 3 { // Root + Branch1 + Leaf1
		t.Errorf("Expected root recursive count 3 after deletion, got %d", rootCat.RecursivePostCount)
	}

	branch1Cat, exists := setup.cache.Get(branch1.ID)
	if !exists {
		t.Fatal("Branch1 category should still exist")
	}
	if branch1Cat.RecursivePostCount != 2 { // Branch1 + Leaf1
		t.Errorf("Expected branch1 recursive count 2 after deletion, got %d", branch1Cat.RecursivePostCount)
	}

	// Verify deleted categories don't exist
	if _, exists := setup.cache.Get(branch2.ID); exists {
		t.Error("Branch2 should be deleted from cache")
	}
	if _, exists := setup.cache.Get(leaf2.ID); exists {
		t.Error("Leaf2 should be deleted from cache")
	}
	if _, exists := setup.cache.Get(leaf3.ID); exists {
		t.Error("Leaf3 should be deleted from cache")
	}
}

func TestCategoryDeletionFileCleanupWithMissingFiles(t *testing.T) {
	setup, err := setupCategoryDeletionTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create category and post
	cat, _ := setup.categoryService.Create("Test Category", nil, "Test desc")
	post, _ := setup.postService.Create(cat.ID, "Test post", nil)

	// Create attachment in database but don't create physical file
	_, err = setup.db.CreateAttachment(post.ID, "missing.txt", "missing.txt", "text/plain", 100)
	if err != nil {
		t.Fatalf("Failed to create attachment: %v", err)
	}

	// Delete category - should not fail even if physical file is missing
	err = setup.categoryService.Delete(cat.ID)
	if err != nil {
		t.Errorf("Category deletion should not fail when physical files are missing: %v", err)
	}

	// Verify category is deleted
	if _, exists := setup.cache.Get(cat.ID); exists {
		t.Error("Category should be deleted from cache")
	}
}