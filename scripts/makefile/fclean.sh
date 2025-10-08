#!/bin/bash

# Full clean script for server
source "$(dirname "$0")/../common/load-config.sh"

echo -e "${BLUE}▶${NC} Deep cleaning all build artifacts and caches..."

echo -e "${BLUE}  Removing:${NC}"

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

# Remove cache directory
if [ -d "scripts/.cache" ]; then
    echo -e "    - scripts/.cache/"
    rm -rf "scripts/.cache"
    echo -e "${GREEN}✓${NC} Removed cache directory"
fi

# Remove node_modules from build tools
if [ -d "scripts/bundle/tailwind/node_modules" ]; then
    echo -e "    - scripts/bundle/tailwind/node_modules/"
    rm -rf "scripts/bundle/tailwind/node_modules"
    echo -e "${GREEN}✓${NC} Removed Tailwind node_modules"
fi

if [ -d "scripts/bundle/fontawesome/node_modules" ]; then
    echo -e "    - scripts/bundle/fontawesome/node_modules/"
    rm -rf "scripts/bundle/fontawesome/node_modules"
    echo -e "${GREEN}✓${NC} Removed Font Awesome node_modules"
fi

# Remove package-lock files
if [ -f "scripts/bundle/tailwind/package-lock.json" ] || [ -f "scripts/bundle/fontawesome/package-lock.json" ]; then
    echo -e "    - scripts/bundle/tailwind/package-lock.json"
    echo -e "    - scripts/bundle/fontawesome/package-lock.json"
    rm -f "scripts/bundle/tailwind/package-lock.json"
    rm -f "scripts/bundle/fontawesome/package-lock.json"
fi

echo -e "${GREEN}✓${NC} Deep clean complete"
