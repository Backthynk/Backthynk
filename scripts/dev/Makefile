.PHONY: help generate-posts list-spaces chaos

# Default target
help:
	@printf "\033[1m\033[0;36mDevelopment Tools\033[0m\n"
	@printf "\033[0;36m===========================\033[0m\n"
	@printf "\n"
	@printf "\033[1mAvailable targets:\033[0m\n"
	@printf "\n"
	@printf "  \033[0;32mgenerate-posts\033[0m       Generate random posts for testing\n"
	@printf "                       Usage: make generate-posts ARGS=\"<space_id> <num_posts> <months_back>\"\n"
	@printf "  \033[0;32mlist-spaces\033[0m          List all available spaces\n"
	@printf "  \033[0;32mchaos\033[0m                Create nested categories and bulk generate posts\n"
	@printf "                       Edit chaos.sh to configure parameters\n"
	@printf "\n"

# Generate posts
generate-posts:
	@if [ -z "$(ARGS)" ]; then \
		echo "Error: ARGS parameter is required"; \
		echo "Usage: make generate-posts ARGS=\"<space_id> <number_of_posts> <months_back>\""; \
		echo ""; \
		echo "Examples:"; \
		echo "  make generate-posts ARGS=\"1 500 36\"  # 500 posts in space 1 over 36 months"; \
		echo "  make generate-posts ARGS=\"2 100 12\"  # 100 posts in space 2 over 12 months"; \
		exit 1; \
	fi
	@echo -e "\033[0;34m▶\033[0m Running bulk post creation script..."
	@cd $(shell git rev-parse --show-toplevel 2>/dev/null || pwd) && ./scripts/dev/bulk_create_posts.sh $(ARGS)

# List spaces
list-spaces:
	@echo -e "\033[0;34m▶\033[0m Listing available spaces..."
	@cd $(shell git rev-parse --show-toplevel 2>/dev/null || pwd) && ./scripts/dev/list_spaces.sh

# Chaos - Create nested categories and bulk generate posts
chaos:
	@echo -e "\033[0;34m▶\033[0m Unleashing chaos..."
	@cd $(shell git rev-parse --show-toplevel 2>/dev/null || pwd) && ./scripts/dev/chaos.sh
