package handlers

import (
	"backthynk/internal/config"
	"backthynk/internal/core/cache"
	"backthynk/internal/core/events"
	"backthynk/internal/core/services"
	"backthynk/internal/storage"
	"fmt"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type eventTestSetup struct {
	categoryService *services.CategoryService
	postService     *services.PostService
	fileService     *services.FileService
	db              *storage.DB
	cache           *cache.CategoryCache
	dispatcher      *events.Dispatcher
	tempDir         string
}

func setupEventTest() (*eventTestSetup, error) {
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
	tempDir, err := os.MkdirTemp("", "backthynk_event_test_*")
	if err != nil {
		return nil, err
	}

	db, err := storage.NewDB(tempDir)
	if err != nil {
		os.RemoveAll(tempDir)
		return nil, err
	}

	// Setup cache and dispatcher
	categoryCache := cache.NewCategoryCache()
	dispatcher := events.NewDispatcher()

	// Setup services
	categoryService := services.NewCategoryService(db, categoryCache, dispatcher)
	postService := services.NewPostService(db, categoryCache, dispatcher)
	fileService := services.NewFileService(db, dispatcher)

	// Initialize cache
	if err := categoryService.InitializeCache(); err != nil {
		os.RemoveAll(tempDir)
		return nil, err
	}

	return &eventTestSetup{
		categoryService: categoryService,
		postService:     postService,
		fileService:     fileService,
		db:              db,
		cache:           categoryCache,
		dispatcher:      dispatcher,
		tempDir:         tempDir,
	}, nil
}

func (setup *eventTestSetup) cleanup() {
	if setup.db != nil {
		setup.db.Close()
	}
	if setup.tempDir != "" {
		os.RemoveAll(setup.tempDir)
	}
}

func TestEventDispatcher_ConcurrentSubscribeAndDispatch(t *testing.T) {
	setup, err := setupEventTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	var eventsReceived int64
	var subscriptionsAdded int64

	// This test reproduces the race condition between Subscribe and Dispatch
	wg := sync.WaitGroup{}

	// Start many subscribers
	numSubscribers := 50
	for i := 0; i < numSubscribers; i++ {
		wg.Add(1)
		go func(subscriberID int) {
			defer wg.Done()

			handler := func(event events.Event) error {
				atomic.AddInt64(&eventsReceived, 1)
				// Simulate some work
				time.Sleep(time.Microsecond)
				return nil
			}

			setup.dispatcher.Subscribe(events.CategoryCreated, handler)
			atomic.AddInt64(&subscriptionsAdded, 1)
		}(i)
	}

	// Start many dispatchers
	numDispatchers := 20
	for i := 0; i < numDispatchers; i++ {
		wg.Add(1)
		go func(dispatcherID int) {
			defer wg.Done()

			for j := 0; j < 10; j++ {
				event := events.Event{
					Type: events.CategoryCreated,
					Data: events.CategoryEvent{CategoryID: dispatcherID*10 + j},
				}
				setup.dispatcher.Dispatch(event)
			}
		}(i)
	}

	// Wait for all goroutines
	wg.Wait()

	t.Logf("Subscriptions added: %d", atomic.LoadInt64(&subscriptionsAdded))
	t.Logf("Events received: %d", atomic.LoadInt64(&eventsReceived))

	// The race condition might cause events to be lost or handlers to panic
	if subscriptionsAdded != int64(numSubscribers) {
		t.Errorf("Expected %d subscriptions, got %d", numSubscribers, subscriptionsAdded)
	}
}

func TestEventDispatcher_HandlerErrors(t *testing.T) {
	setup, err := setupEventTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	var successfulHandlers int64
	var failedHandlers int64

	// Add handlers that succeed
	for i := 0; i < 5; i++ {
		setup.dispatcher.Subscribe(events.CategoryCreated, func(event events.Event) error {
			atomic.AddInt64(&successfulHandlers, 1)
			return nil
		})
	}

	// Add handlers that fail
	for i := 0; i < 3; i++ {
		setup.dispatcher.Subscribe(events.CategoryCreated, func(event events.Event) error {
			atomic.AddInt64(&failedHandlers, 1)
			return fmt.Errorf("simulated handler error")
		})
	}

	// Dispatch an event
	event := events.Event{
		Type: events.CategoryCreated,
		Data: events.CategoryEvent{CategoryID: 1},
	}
	setup.dispatcher.Dispatch(event)

	// All handlers should be called despite some failing
	if atomic.LoadInt64(&successfulHandlers) != 5 {
		t.Errorf("Expected 5 successful handlers, got %d", successfulHandlers)
	}
	if atomic.LoadInt64(&failedHandlers) != 3 {
		t.Errorf("Expected 3 failed handlers, got %d", failedHandlers)
	}
}

func TestEventDispatcher_ProductionLikeScenario(t *testing.T) {
	setup, err := setupEventTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// This test simulates production usage patterns
	var categoryCreatedEvents int64
	var categoryUpdatedEvents int64
	var postCreatedEvents int64

	// Subscribe to different event types (like production would)
	setup.dispatcher.Subscribe(events.CategoryCreated, func(event events.Event) error {
		atomic.AddInt64(&categoryCreatedEvents, 1)
		// Simulate some processing time
		time.Sleep(time.Millisecond)
		return nil
	})

	setup.dispatcher.Subscribe(events.CategoryUpdated, func(event events.Event) error {
		atomic.AddInt64(&categoryUpdatedEvents, 1)
		return nil
	})

	setup.dispatcher.Subscribe(events.PostCreated, func(event events.Event) error {
		atomic.AddInt64(&postCreatedEvents, 1)
		return nil
	})

	// Perform actual operations that should trigger events
	category, err := setup.categoryService.Create("Test Category", nil, "Test description")
	if err != nil {
		t.Fatalf("Failed to create category: %v", err)
	}

	_, err = setup.categoryService.Update(category.ID, "Updated Category", "Updated description", nil)
	if err != nil {
		t.Fatalf("Failed to update category: %v", err)
	}

	_, err = setup.postService.Create(category.ID, "Test post content", nil)
	if err != nil {
		t.Fatalf("Failed to create post: %v", err)
	}

	// Give events time to be processed
	time.Sleep(100 * time.Millisecond)

	// Verify events were dispatched
	if atomic.LoadInt64(&categoryCreatedEvents) != 1 {
		t.Errorf("Expected 1 category created event, got %d", categoryCreatedEvents)
	}
	if atomic.LoadInt64(&categoryUpdatedEvents) != 1 {
		t.Errorf("Expected 1 category updated event, got %d", categoryUpdatedEvents)
	}
	if atomic.LoadInt64(&postCreatedEvents) != 1 {
		t.Errorf("Expected 1 post created event, got %d", postCreatedEvents)
	}
}

func TestEventDispatcher_ConcurrentOperationsWithSubscriptions(t *testing.T) {
	setup, err := setupEventTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	var totalEvents int64

	// Subscribe to all event types
	eventTypes := []events.EventType{
		events.CategoryCreated,
		events.CategoryUpdated,
		events.CategoryDeleted,
		events.PostCreated,
		events.PostMoved,
		events.PostDeleted,
	}

	for _, eventType := range eventTypes {
		setup.dispatcher.Subscribe(eventType, func(event events.Event) error {
			atomic.AddInt64(&totalEvents, 1)
			// Simulate processing time
			time.Sleep(time.Microsecond * 100)
			return nil
		})
	}

	// Perform concurrent operations that should trigger events
	numGoroutines := 20
	wg := sync.WaitGroup{}

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()

			// Create a category
			category, err := setup.categoryService.Create(fmt.Sprintf("Category %d", i), nil, fmt.Sprintf("Description %d", i))
			if err != nil {
				t.Errorf("Failed to create category %d: %v", i, err)
				return
			}

			// Create a post
			post, err := setup.postService.Create(category.ID, fmt.Sprintf("Post content %d", i), nil)
			if err != nil {
				t.Errorf("Failed to create post %d: %v", i, err)
				return
			}

			// Update the category
			_, err = setup.categoryService.Update(category.ID, fmt.Sprintf("Updated Category %d", i), fmt.Sprintf("Updated Description %d", i), nil)
			if err != nil {
				t.Errorf("Failed to update category %d: %v", i, err)
				return
			}

			// Delete the post
			err = setup.postService.Delete(post.ID)
			if err != nil {
				t.Errorf("Failed to delete post %d: %v", i, err)
				return
			}

			// Delete the category
			err = setup.categoryService.Delete(category.ID)
			if err != nil {
				t.Errorf("Failed to delete category %d: %v", i, err)
				return
			}
		}(i)
	}

	wg.Wait()

	// Give events time to be processed
	time.Sleep(500 * time.Millisecond)

	// Each goroutine should generate: 1 CategoryCreated + 1 PostCreated + 1 CategoryUpdated + 1 PostDeleted + 1 CategoryDeleted = 5 events
	expectedEvents := int64(numGoroutines * 5)
	actualEvents := atomic.LoadInt64(&totalEvents)

	t.Logf("Expected events: %d, Actual events: %d", expectedEvents, actualEvents)

	if actualEvents != expectedEvents {
		t.Errorf("Expected %d events, got %d. This might indicate a race condition in event dispatching.", expectedEvents, actualEvents)
	}
}

func TestEventDispatcher_AggressiveRaceConditionTest(t *testing.T) {
	setup, err := setupEventTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// This test tries very hard to trigger race conditions
	var eventsReceived int64
	eventType := events.CategoryCreated

	wg := sync.WaitGroup{}

	// Start many goroutines that continuously subscribe
	numSubscribers := 100
	for i := 0; i < numSubscribers; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < 10; j++ {
				handler := func(event events.Event) error {
					atomic.AddInt64(&eventsReceived, 1)
					return nil
				}
				setup.dispatcher.Subscribe(eventType, handler)
				// Yield to increase chance of race
				time.Sleep(time.Nanosecond)
			}
		}(i)
	}

	// Start many goroutines that continuously dispatch
	numDispatchers := 50
	for i := 0; i < numDispatchers; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < 20; j++ {
				event := events.Event{
					Type: eventType,
					Data: events.CategoryEvent{CategoryID: id*20 + j},
				}
				setup.dispatcher.Dispatch(event)
				// Yield to increase chance of race
				time.Sleep(time.Nanosecond)
			}
		}(i)
	}

	wg.Wait()

	t.Logf("Events received: %d", atomic.LoadInt64(&eventsReceived))
	t.Logf("Expected handlers: %d, dispatches: %d", numSubscribers*10, numDispatchers*20)
}

func TestEventDispatcher_SliceReallocRace(t *testing.T) {
	// This test specifically targets the slice reallocation race condition
	setup, err := setupEventTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	eventType := events.CategoryCreated

	// Start a goroutine that keeps dispatching events
	stopDispatch := make(chan bool)
	go func() {
		for {
			select {
			case <-stopDispatch:
				return
			default:
				event := events.Event{
					Type: eventType,
					Data: events.CategoryEvent{CategoryID: 1},
				}
				setup.dispatcher.Dispatch(event)
			}
		}
	}()

	// Meanwhile, keep adding subscribers to force slice reallocations
	wg := sync.WaitGroup{}
	numIterations := 1000

	for i := 0; i < numIterations; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			handler := func(event events.Event) error {
				return nil
			}
			setup.dispatcher.Subscribe(eventType, handler)
		}(i)
	}

	wg.Wait()
	close(stopDispatch)

	t.Logf("Successfully added %d subscribers while dispatching", numIterations)
}

func TestEventDispatcher_SlowHandlers(t *testing.T) {
	setup, err := setupEventTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	var handlerStarted int64
	var handlerCompleted int64

	// Add a slow handler
	setup.dispatcher.Subscribe(events.CategoryCreated, func(event events.Event) error {
		atomic.AddInt64(&handlerStarted, 1)
		time.Sleep(100 * time.Millisecond) // Simulate slow processing
		atomic.AddInt64(&handlerCompleted, 1)
		return nil
	})

	// Add a fast handler
	setup.dispatcher.Subscribe(events.CategoryCreated, func(event events.Event) error {
		atomic.AddInt64(&handlerCompleted, 1)
		return nil
	})

	start := time.Now()

	// Dispatch multiple events
	for i := 0; i < 5; i++ {
		event := events.Event{
			Type: events.CategoryCreated,
			Data: events.CategoryEvent{CategoryID: i},
		}
		setup.dispatcher.Dispatch(event)
	}

	duration := time.Since(start)

	// The dispatcher should wait for all handlers to complete for each event
	// This tests if the dispatcher is blocking (synchronous) as expected
	t.Logf("Dispatching took %v", duration)
	t.Logf("Handlers started: %d, completed: %d", handlerStarted, handlerCompleted)

	// Should have completed all handlers
	if atomic.LoadInt64(&handlerCompleted) != 10 { // 5 events * 2 handlers each
		t.Errorf("Expected 10 completed handlers, got %d", handlerCompleted)
	}

	// Should have taken at least 500ms (5 events * 100ms each for the slow handler)
	if duration < 500*time.Millisecond {
		t.Errorf("Dispatching was too fast (%v), suggesting handlers might not be running synchronously", duration)
	}
}

func TestEventDispatcher_HandlerPanic(t *testing.T) {
	setup, err := setupEventTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	var safeHandlerCalled int64

	// Add a handler that panics
	setup.dispatcher.Subscribe(events.CategoryCreated, func(event events.Event) error {
		panic("handler panic!")
	})

	// Add a safe handler
	setup.dispatcher.Subscribe(events.CategoryCreated, func(event events.Event) error {
		atomic.AddInt64(&safeHandlerCalled, 1)
		return nil
	})

	// This should not crash the test due to panic
	defer func() {
		if r := recover(); r != nil {
			t.Errorf("Dispatcher did not handle handler panic properly: %v", r)
		}
	}()

	event := events.Event{
		Type: events.CategoryCreated,
		Data: events.CategoryEvent{CategoryID: 1},
	}

	setup.dispatcher.Dispatch(event)

	// The safe handler should still have been called even if the first one panicked
	if atomic.LoadInt64(&safeHandlerCalled) != 1 {
		t.Errorf("Safe handler was not called after panic in first handler")
	}
}

func TestEventDispatcher_MemoryLeakWithManySubscriptions(t *testing.T) {
	setup, err := setupEventTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// This test checks if continuously adding and never removing handlers causes issues
	eventType := events.CategoryCreated

	// Add many handlers
	numHandlers := 10000
	for i := 0; i < numHandlers; i++ {
		handler := func(event events.Event) error {
			return nil
		}
		setup.dispatcher.Subscribe(eventType, handler)
	}

	// Dispatch an event to all handlers
	event := events.Event{
		Type: eventType,
		Data: events.CategoryEvent{CategoryID: 1},
	}

	start := time.Now()
	setup.dispatcher.Dispatch(event)
	duration := time.Since(start)

	t.Logf("Dispatching to %d handlers took %v", numHandlers, duration)

	// This should complete in reasonable time
	if duration > 1*time.Second {
		t.Errorf("Dispatching to %d handlers took too long: %v", numHandlers, duration)
	}
}

func TestAsyncEventDispatcher_NonBlocking(t *testing.T) {
	setup, err := setupEventTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create an async dispatcher
	asyncDispatcher := events.NewAsyncDispatcher()

	var handlerStarted int64
	var handlerCompleted int64

	// Add a slow handler
	asyncDispatcher.Subscribe(events.CategoryCreated, func(event events.Event) error {
		atomic.AddInt64(&handlerStarted, 1)
		time.Sleep(200 * time.Millisecond) // Simulate slow processing
		atomic.AddInt64(&handlerCompleted, 1)
		return nil
	})

	start := time.Now()

	// Dispatch multiple events
	for i := 0; i < 5; i++ {
		event := events.Event{
			Type: events.CategoryCreated,
			Data: events.CategoryEvent{CategoryID: i},
		}
		asyncDispatcher.Dispatch(event)
	}

	dispatchDuration := time.Since(start)

	// The async dispatcher should return immediately
	if dispatchDuration > 50*time.Millisecond {
		t.Errorf("Async dispatching took too long (%v), expected it to be non-blocking", dispatchDuration)
	}

	// Wait for handlers to complete
	time.Sleep(300 * time.Millisecond)

	startedCount := atomic.LoadInt64(&handlerStarted)
	completedCount := atomic.LoadInt64(&handlerCompleted)

	t.Logf("Async dispatch took %v", dispatchDuration)
	t.Logf("Handlers started: %d, completed: %d", startedCount, completedCount)

	// All handlers should have started and completed
	if startedCount != 5 {
		t.Errorf("Expected 5 handlers to start, got %d", startedCount)
	}
	if completedCount != 5 {
		t.Errorf("Expected 5 handlers to complete, got %d", completedCount)
	}
}

func TestAsyncEventDispatcher_PanicHandling(t *testing.T) {
	asyncDispatcher := events.NewAsyncDispatcher()

	var safeHandlerCalled int64

	// Add a handler that panics
	asyncDispatcher.Subscribe(events.CategoryCreated, func(event events.Event) error {
		panic("async handler panic!")
	})

	// Add a safe handler
	asyncDispatcher.Subscribe(events.CategoryCreated, func(event events.Event) error {
		time.Sleep(10 * time.Millisecond) // Small delay to ensure execution
		atomic.AddInt64(&safeHandlerCalled, 1)
		return nil
	})

	event := events.Event{
		Type: events.CategoryCreated,
		Data: events.CategoryEvent{CategoryID: 1},
	}

	// This should not crash due to panic in async handler
	asyncDispatcher.Dispatch(event)

	// Wait for async handlers to complete
	time.Sleep(50 * time.Millisecond)

	// The safe handler should still have been called
	if atomic.LoadInt64(&safeHandlerCalled) != 1 {
		t.Errorf("Safe handler was not called after panic in async handler")
	}
}