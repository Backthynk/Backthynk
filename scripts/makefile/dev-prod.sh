#!/bin/bash

# Development server with bundled assets - runs with go run + pre-production env
source "$(dirname "$0")/../common/load-config.sh"

# Check if bundle folder exists
if [ ! -d "$PROJECT_ROOT/bundle" ]; then
    echo -e "${YELLOW}⚠${NC} Bundle folder not found. Creating bundle...${NC}"
    "$PROJECT_ROOT/scripts/bundle/bundle.sh" --full
fi

echo -e "${BLUE}▶${NC} Starting server with bundled assets (pre-production mode)..."
echo -e "${GRAY}  (using go run with bundle folder)${NC}"
env APP_ENV=pre-production go run ./cmd/server/main.go
