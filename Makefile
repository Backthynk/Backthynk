.PHONY: help build build-prod run serve-dev serve-prod clean test test-verbose test-coverage dev-generate-posts dev-list-categories dev-check

# Color codes
RED := \033[0;31m
GREEN := \033[0;32m
BLUE := \033[0;34m
YELLOW := \033[0;33m
CYAN := \033[0;36m
BOLD := \033[1m
NC := \033[0m

# Default target
help:
	@echo -e "$(BOLD)$(CYAN)Backthynk Development Makefile$(NC)"
	@echo -e "$(CYAN)==============================$(NC)"
	@echo ""
	@echo -e "$(BOLD)Available targets:$(NC)"
	@echo ""
	@echo -e "  $(YELLOW)Build & Run:$(NC)"
	@echo -e "    $(GREEN)build$(NC)                    Build the application binary"
	@echo -e "    $(GREEN)build-prod$(NC)               Build optimized production binary with compressed assets"
	@echo -e "    $(GREEN)run$(NC)                      Run the server (builds if necessary)"
	@echo -e "    $(GREEN)serve-dev$(NC)                Run the server in development mode"
	@echo -e "    $(GREEN)serve-prod$(NC)               Run the server in production mode"
	@echo -e "    $(GREEN)clean$(NC)                    Clean build artifacts"
	@echo ""
	@echo -e "  $(YELLOW)Testing:$(NC)"
	@echo -e "    $(GREEN)test$(NC)                     Run all tests"
	@echo -e "    $(GREEN)test-verbose$(NC)             Run all tests with verbose output"
	@echo -e "    $(GREEN)test-coverage$(NC)            Run tests with coverage report"
	@echo ""
	@echo -e "  $(YELLOW)Development Scripts:$(NC)"
	@echo -e "    $(GREEN)dev-generate-posts$(NC)       Generate random posts for testing"
	@echo -e "    $(GREEN)dev-list-categories$(NC)      List all available categories"
	@echo -e "    $(GREEN)dev-check$(NC)               Check development environment"
	@echo ""

# Build targets
build:
	@echo -e "$(BLUE)▶$(NC) Building Backthynk server..."
	go build -o backthynk ./cmd/server/
	@echo -e "$(GREEN)✓$(NC) Build complete: ./backthynk"

build-prod:
	@./scripts/build-prod.sh

serve-dev: build
	@echo -e "$(BLUE)▶$(NC) Starting Backthynk server in development mode..."
	./backthynk

serve-prod:
	@if [ ! -f backthynk ]; then \
		echo -e "$(YELLOW)⚠$(NC) Production binary not found, building..."; \
		$(MAKE) build-prod; \
	elif [ ! -d web/static/js/compressed ] || [ ! -d web/templates/compressed ]; then \
		echo -e "$(YELLOW)⚠$(NC) Minified assets not found, rebuilding..."; \
		$(MAKE) build-prod; \
	else \
		echo -e "$(GREEN)✓$(NC) Using existing production build..."; \
	fi
	@echo -e "$(BLUE)▶$(NC) Starting Backthynk server in production mode..."
	BACKTHYNK_ENV=production ./backthynk

clean:
	@echo -e "$(BLUE)▶$(NC) Cleaning build artifacts..."
	@rm -f backthynk
	@rm -rf web/static/js/compressed
	@rm -rf web/static/css/compressed
	@rm -rf web/templates/compressed
# 	@go clean -cache
	@echo -e "$(GREEN)✓$(NC) Clean complete"

# Test targets
test:
	@echo -e "$(BLUE)▶$(NC) Running all tests..."
	@go test ./internal/cache ./internal/services
	@echo -e "$(GREEN)✓$(NC) All tests passed"

test-verbose:
	@echo -e "$(BLUE)▶$(NC) Running all tests with verbose output..."
	@go test -v ./internal/cache ./internal/services

test-coverage:
	@echo -e "$(BLUE)▶$(NC) Running tests with coverage..."
	@go test -cover ./internal/cache ./internal/services
	@echo ""
	@echo -e "$(BLUE)▶$(NC) Generating detailed coverage report..."
	@go test -coverprofile=coverage.out ./internal/cache ./internal/services
	@go tool cover -html=coverage.out -o coverage.html
	@echo -e "$(GREEN)✓$(NC) Coverage report generated: coverage.html"

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
	@echo -e "$(BLUE)▶$(NC) Running bulk post creation script..."
	@./scripts/dev/bulk_create_posts.sh $(ARGS)

dev-list-categories:
	@echo -e "$(BLUE)▶$(NC) Listing available categories..."
	@./scripts/dev/list_categories.sh

dev-check:
	@echo -e "$(BLUE)▶$(NC) Checking development environment..."
	@echo ""
	@echo -e "$(BOLD)Required tools:$(NC)"
	@which go > /dev/null 2>&1 && echo -e "  $(GREEN)✓$(NC) Go found: $$(go version)" || echo -e "  $(RED)✗$(NC) Go not found"
	@which curl > /dev/null 2>&1 && echo -e "  $(GREEN)✓$(NC) curl found: $$(curl --version | head -n1)" || echo -e "  $(RED)✗$(NC) curl not found"
	@which jq > /dev/null 2>&1 && echo -e "  $(GREEN)✓$(NC) jq found: $$(jq --version)" || echo -e "  $(RED)✗$(NC) jq not found"
	@echo ""
	@echo -e "$(BOLD)Development scripts:$(NC)"
	@ls -la scripts/dev/ | grep -E '\.(sh|py)$$' | awk '{print "  " $$9}' || echo "  No scripts found"
	@echo ""
	@echo -e "$(BOLD)Server status:$(NC)"
	@curl -s --max-time 2 http://localhost:8080 > /dev/null 2>&1 && \
		echo -e "  $(GREEN)✓$(NC) Server is running on localhost:8080" || \
		echo -e "  $(YELLOW)✗$(NC) Server not reachable on localhost:8080"
