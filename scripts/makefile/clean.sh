#!/bin/bash

# Clean script for server
source "$(dirname "$0")/../common/load-config.sh"

echo -e "${BLUE}▶${NC} Cleaning build artifacts..."

echo -e "${BLUE}  Removing:${NC}"

# Remove bundle directory
if [ -d "$PROJECT_ROOT/bundle" ]; then
    echo -e "    - bundle/"
    rm -rf "$PROJECT_ROOT/bundle"
    echo -e "${GREEN}✓${NC} Removed bundle directory"
fi

# Remove build directory
if [ -d "$BUILD_DIR" ]; then
    echo -e "    - build/"
    rm -rf "$BUILD_DIR"
    echo -e "${GREEN}✓${NC} Removed build directory"
fi

# Remove releases directory
if [ -d "$RELEASES_DIR" ]; then
    echo -e "    - releases/"
    rm -rf "$RELEASES_DIR"
    echo -e "${GREEN}✓${NC} Removed releases directory"
fi

# Remove archives directory
if [ -d "$PROJECT_ROOT/archives" ]; then
    echo -e "    - archives/"
    rm -rf "$PROJECT_ROOT/archives"
    echo -e "${GREEN}✓${NC} Removed archives directory"
fi

echo -e "${GREEN}✓${NC} Clean complete"
