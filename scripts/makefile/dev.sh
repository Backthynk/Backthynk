#!/bin/bash

# Development server script - runs with go run (no build required)
source "$(dirname "$0")/../common/load-config.sh"

echo -e "${BLUE}▶${NC} Starting server in development mode..."
echo -e "${GRAY}  (using go run - no build required)${NC}"
env APP_ENV=development go run ./cmd/server/main.go
