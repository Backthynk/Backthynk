.PHONY: help build bundle dev dev-prod run clean fclean test test-verbose release release-status release-clean

# Default target
help:
	@./scripts/makefile/help.sh

# Bundle targets
bundle:
	@./scripts/bundle/bundle.sh $(ARGS)

# Build targets
build:
	@./scripts/build/build.sh $(ARGS)

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

# Release targets
release:
	@./scripts/makefile/release.sh

release-status:
	@./scripts/makefile/release-status.sh

release-clean:
	@./scripts/makefile/release-clean.sh
