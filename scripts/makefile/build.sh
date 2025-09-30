#!/bin/bash

# Build script for Backthynk server
source "$(dirname "$0")/../common/load-config.sh"

echo -e "${BLUE}▶${NC} Building Backthynk server..."
eval "$BUILD_COMMAND"
echo -e "${GREEN}✓${NC} Build complete: ./$BINARY_NAME"