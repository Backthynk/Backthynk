.PHONY: help build build-prod run serve-dev serve-prod clean fclean test test-verbose dev-generate-posts dev-list-categories extract-css

# Default target
help:
	@./scripts/makefile/help.sh

# Build targets
build:
	@./scripts/makefile/build.sh

build-prod:
	@./scripts/build-prod/build-prod.sh

run: serve-dev

serve-dev:
	@./scripts/makefile/serve-dev.sh

serve-prod:
	@./scripts/makefile/serve-prod.sh

clean:
	@./scripts/makefile/clean.sh

fclean: clean
	@./scripts/makefile/fclean.sh

# Test targets
test:
	@./scripts/makefile/test.sh

test-verbose:
	@./scripts/makefile/test-verbose.sh

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
	@echo -e "\033[0;34m▶\033[0m Running bulk post creation script..."
	@./scripts/dev/bulk_create_posts.sh $(ARGS)

dev-list-categories:
	@echo -e "\033[0;34m▶\033[0m Listing available categories..."
	@./scripts/dev/list_categories.sh

extract-css:
	@./scripts/makefile/extract-css.sh
