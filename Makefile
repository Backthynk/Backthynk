.PHONY: help build dev dev-prod run clean fclean test test-verbose

# Default target
help:
	@./scripts/makefile/help.sh

# Build targets
build:
	@./scripts/build/build.sh

# Run targets
dev:
	@./scripts/makefile/dev.sh

dev-prod:
	@./scripts/makefile/dev-prod.sh

run: dev

# Clean targets
clean:
	@./scripts/makefile/clean.sh

fclean: clean
	@./scripts/makefile/fclean.sh

# Test targets
test:
	@./scripts/makefile/test.sh

test-verbose:
	@./scripts/makefile/test-verbose.sh
