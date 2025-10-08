.PHONY: help build build-with-docker bundle dev dev-prod run clean fclean test test-verbose release release-status release-clean %

# Default target
help:
	@./scripts/makefile/help.sh

# Bundle targets
bundle:
	@args="$(filter-out $@,$(MAKECMDGOALS))"; \
	if [ -n "$$args" ]; then \
		./scripts/bundle/bundle.sh --$$args; \
	else \
		./scripts/bundle/bundle.sh; \
	fi

# Build targets
build:
	@args="$(filter-out $@,$(MAKECMDGOALS))"; \
	if [ -n "$$args" ]; then \
		./scripts/makefile/build.sh $$(echo "$$args" | sed 's/^type /--type /; s/^auto/--auto/; s/^all/--all/'); \
	else \
		./scripts/makefile/build.sh; \
	fi

build-with-docker:
	@./scripts/build-docker/build-with-docker.sh

# Allow any target to be passed as arguments
%:
	@:

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
