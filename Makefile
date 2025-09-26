.PHONY: help build run clean dev-generate-posts dev-list-categories dev-check

# Default target
help:
	@echo "Backthynk Development Makefile"
	@echo "=============================="
	@echo ""
	@echo "Available targets:"
	@echo ""
	@echo "  Build & Run:"
	@echo "    build                    Build the application binary"
	@echo "    run                      Run the server (builds if necessary)"
	@echo "    clean                    Clean build artifacts"
	@echo ""
	@echo "  Development Scripts:"
	@echo "    dev-generate-posts       Generate random posts for testing"
	@echo "    dev-list-categories      List all available categories"
	@echo "    dev-check               Check development environment"
	@echo ""

# Build targets
build:
	@echo "Building Backthynk server..."
	go build -o backthynk ./cmd/server/
	@echo "✓ Build complete: ./backthynk"

run: build
	@echo "Starting Backthynk server..."
	./backthynk

clean:
	@echo "Cleaning build artifacts..."
	@rm -f backthynk
	@echo "✓ Clean complete"

# Development script targets
dev-generate-posts:
	@if [ -z "$(ARGS)" ]; then \
		echo "Error: ARGS parameter is required"; \
		echo "Usage: make dev-generate-posts ARGS=\"<category_id> <number_of_posts> <months_back>\""; \
		echo ""; \
		echo "Examples:"; \
		echo "  make dev-generate-posts ARGS=\"1 500 36\"  # 500 posts in category 1 over 36 months"; \
		echo "  make dev-generate-posts ARGS=\"2 100 12\"  # 100 posts in category 2 over 12 months"; \
		exit 1; \
	fi
	@echo "Running bulk post creation script..."
	@./scripts/dev/bulk_create_posts.sh $(ARGS)

dev-list-categories:
	@echo "Listing available categories..."
	@./scripts/dev/list_categories.sh

dev-check:
	@echo "Checking development environment..."
	@echo ""
	@echo "Required tools:"
	@which go > /dev/null 2>&1 && echo "  ✓ Go found: $$(go version)" || echo "  ✗ Go not found"
	@which curl > /dev/null 2>&1 && echo "  ✓ curl found: $$(curl --version | head -n1)" || echo "  ✗ curl not found"
	@which jq > /dev/null 2>&1 && echo "  ✓ jq found: $$(jq --version)" || echo "  ✗ jq not found"
	@echo ""
	@echo "Development scripts:"
	@ls -la scripts/dev/ | grep -E '\.(sh|py)$$' | awk '{print "  " $$9}' || echo "  No scripts found"
	@echo ""
	@echo "Server status:"
	@curl -s --max-time 2 http://localhost:8080 > /dev/null 2>&1 && \
		echo "  ✓ Server is running on localhost:8080" || \
		echo "  ✗ Server not reachable on localhost:8080"
