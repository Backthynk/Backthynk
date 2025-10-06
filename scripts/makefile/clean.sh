#!/bin/bash

# Clean script for Backthynk server
source "$(dirname "$0")/../common/load-config.sh"

echo -e "${BLUE}▶${NC} Cleaning build artifacts..."

# Remove build directory
if [ -d "$BUILD_DIR" ]; then
    rm -rf "$BUILD_DIR"
    echo -e "${GREEN}✓${NC} Removed build directory"
fi

echo -e "${GREEN}✓${NC} Clean complete"
