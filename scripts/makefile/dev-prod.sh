#!/bin/bash

# Development server with production assets - runs with go run + production env
source "$(dirname "$0")/../common/load-config.sh"

# Check if production assets exist
if [ ! -d "$COMPRESSED_JS_DIR" ] || [ ! -d "$COMPRESSED_TEMPLATES_DIR" ]; then
    echo -e "${YELLOW}⚠${NC} Production assets not found. Running build first..."
    "$(dirname "$0")/../build/build.sh"
fi

echo -e "${BLUE}▶${NC} Starting Backthynk server with production assets..."
echo -e "${GRAY}  (using go run with production environment)${NC}"
env $PRODUCTION_ENV_VAR go run ./cmd/server/main.go
