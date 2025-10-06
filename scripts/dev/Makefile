.PHONY: help generate-posts list-categories

# Default target
help:
	@printf "\033[1m\033[0;36mBackthynk Development Tools\033[0m\n"
	@printf "\033[0;36m===========================\033[0m\n"
	@printf "\n"
	@printf "\033[1mAvailable targets:\033[0m\n"
	@printf "\n"
	@printf "  \033[0;32mgenerate-posts\033[0m       Generate random posts for testing\n"
	@printf "                       Usage: make generate-posts ARGS=\"<category_id> <num_posts> <months_back>\"\n"
	@printf "  \033[0;32mlist-categories\033[0m      List all available categories\n"
	@printf "\n"

# Generate posts
generate-posts:
	@if [ -z "$(ARGS)" ]; then \
		echo "Error: ARGS parameter is required"; \
		echo "Usage: make generate-posts ARGS=\"<category_id> <number_of_posts> <months_back>\""; \
		echo ""; \
		echo "Examples:"; \
		echo "  make generate-posts ARGS=\"1 500 36\"  # 500 posts in category 1 over 36 months"; \
		echo "  make generate-posts ARGS=\"2 100 12\"  # 100 posts in category 2 over 12 months"; \
		exit 1; \
	fi
	@echo -e "\033[0;34m▶\033[0m Running bulk post creation script..."
	@./bulk_create_posts.sh $(ARGS)

# List categories
list-categories:
	@echo -e "\033[0;34m▶\033[0m Listing available categories..."
	@./list_categories.sh
