#!/bin/bash

# Clean script for server
source "$(dirname "$0")/../common/load-config.sh"

echo -e "${BLUE}▶${NC} Cleaning build artifacts..."

# Remove build directory
if [ -d "$BUILD_DIR" ]; then
    echo -e "${BLUE}  Removing:${NC}"
    echo -e "    - ${COMPRESSED_TEMPLATES_DIR}/"
    echo -e "    - ${COMPRESSED_CSS_DIR}/"
    echo -e "    - ${COMPRESSED_JS_DIR}/"
    echo -e "    - ${BUILD_BIN}/unix/"
    echo -e "    - ${BUILD_BIN}/windows/"
    rm -rf "$BUILD_DIR"
    echo -e "${GREEN}✓${NC} Removed build directory"
fi

echo -e "${GREEN}✓${NC} Clean complete"
