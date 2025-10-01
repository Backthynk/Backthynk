#!/bin/bash

# Serve production script for Backthynk server
source "$(dirname "$0")/../common/load-config.sh"

# Get paths from configuration
JS_COMPRESSED_CHECK_DIR=$(jq -r '.build.assets.js_compressed_check_dir' "$SCRIPT_DIR/_script.json")
TEMPLATES_COMPRESSED_CHECK_DIR=$(jq -r '.build.assets.templates_compressed_check_dir' "$SCRIPT_DIR/_script.json")

if [ ! -f "$BINARY_NAME" ]; then
    echo -e "${YELLOW}⚠${NC} Production binary not found, building..."
    "$(dirname "$0")/../build-prod/build-prod.sh"
elif [ ! -d "$JS_COMPRESSED_CHECK_DIR" ] || [ ! -d "$TEMPLATES_COMPRESSED_CHECK_DIR" ]; then
    echo -e "${YELLOW}⚠${NC} Minified assets not found, rebuilding..."
    "$(dirname "$0")/../build-prod/build-prod.sh"
else
    echo -e "${GREEN}✓${NC} Using existing production build..."
fi

echo -e "${BLUE}▶${NC} Starting Backthynk server in production mode..."
env $PRODUCTION_ENV_VAR ./"$BINARY_NAME"