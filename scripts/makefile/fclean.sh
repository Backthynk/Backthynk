#!/bin/bash

# Full clean script for Backthynk server
source "$(dirname "$0")/../common/load-config.sh"

echo -e "${BLUE}▶${NC} Deep cleaning all build artifacts and caches..."

# Remove build directory
if [ -d "$BUILD_DIR" ]; then
    rm -rf "$BUILD_DIR"
    echo -e "${GREEN}✓${NC} Removed build directory"
fi

# Remove cache directory
if [ -d "scripts/.cache" ]; then
    rm -rf "scripts/.cache"
    echo -e "${GREEN}✓${NC} Removed cache directory"
fi

# Remove node_modules from build tools
if [ -d "scripts/build/tailwind-build/node_modules" ]; then
    rm -rf "scripts/build/tailwind-build/node_modules"
    echo -e "${GREEN}✓${NC} Removed Tailwind node_modules"
fi

if [ -d "scripts/build/fontawesome-build/node_modules" ]; then
    rm -rf "scripts/build/fontawesome-build/node_modules"
    echo -e "${GREEN}✓${NC} Removed Font Awesome node_modules"
fi

# Remove package-lock files
rm -f "scripts/build/tailwind-build/package-lock.json"
rm -f "scripts/build/fontawesome-build/package-lock.json"

echo -e "${GREEN}✓${NC} Deep clean complete"
