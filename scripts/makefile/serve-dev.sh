#!/bin/bash

# Serve development script for Backthynk server
source "$(dirname "$0")/../common/load-config.sh"

# Build first if binary doesn't exist
if [ ! -f "$BINARY_NAME" ]; then
    "$(dirname "$0")/build.sh"
fi

echo -e "${BLUE}▶${NC} Starting Backthynk server in development mode..."
./"$BINARY_NAME"