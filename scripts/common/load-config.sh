#!/bin/bash

# Configuration loader for .script.json and internal/.config.json
# Source this file to load configuration variables

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SCRIPT_CONFIG_FILE="$SCRIPT_DIR/.script.json"
SHARED_CONFIG_FILE="$SCRIPT_DIR/.config.json"

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed. Please install jq to parse JSON config files." >&2
    exit 1
fi

# Check if .script.json exists
if [ ! -f "$SCRIPT_CONFIG_FILE" ]; then
    echo "Error: .script.json not found at $SCRIPT_CONFIG_FILE" >&2
    exit 1
fi

# Validate .script.json format
if ! jq empty "$SCRIPT_CONFIG_FILE" 2>/dev/null; then
    echo "Error: .script.json is not valid JSON." >&2
    exit 1
fi

# Check if .config.json exists (no auto-creation)
if [ ! -f "$SHARED_CONFIG_FILE" ]; then
    echo "Error: .config.json not found at $SHARED_CONFIG_FILE" >&2
    exit 1
fi

# Validate .config.json format
if ! jq empty "$SHARED_CONFIG_FILE" 2>/dev/null; then
    echo "Error: .config.json is not valid JSON." >&2
    exit 1
fi

# Define colors directly (no longer in config files)
export RED="\033[0;31m"
export GREEN="\033[0;32m"
export BLUE="\033[0;34m"
export YELLOW="\033[0;33m"
export CYAN="\033[0;36m"
export PURPLE="\033[0;35m"
export GRAY="\033[0;90m"
export BOLD="\033[1m"
export NC="\033[0m"

# Load app configuration from shared config
export APP_NAME=$(jq -r '.app.name // "backthynk"' "$SHARED_CONFIG_FILE")
export APP_VERSION=$(jq -r '.app.version // "0.1.0"' "$SHARED_CONFIG_FILE")
export BINARY_NAME="$APP_NAME"
export PRODUCTION_ENV_VAR="BACKTHYNK_ENV=production"

# Load paths from shared config
export BUILD_DIR=$(jq -r '.paths.build_dir // "build"' "$SHARED_CONFIG_FILE")
export BUILD_ASSETS=$(jq -r '.paths.build_assets // "build/assets"' "$SHARED_CONFIG_FILE")
export BUILD_BIN=$(jq -r '.paths.build_bin // "build/bin"' "$SHARED_CONFIG_FILE")
export COMPRESSED_JS_DIR=$(jq -r '.paths.compressed.js // "build/assets/js/compressed"' "$SHARED_CONFIG_FILE")
export COMPRESSED_CSS_DIR=$(jq -r '.paths.compressed.css // "build/assets/css/compressed"' "$SHARED_CONFIG_FILE")
export COMPRESSED_TEMPLATES_DIR=$(jq -r '.paths.compressed.templates // "build/assets/templates/compressed"' "$SHARED_CONFIG_FILE")
export SOURCE_STATIC=$(jq -r '.paths.source.static // "web/static"' "$SHARED_CONFIG_FILE")
export SOURCE_TEMPLATES=$(jq -r '.paths.source.templates // "web/templates"' "$SHARED_CONFIG_FILE")
export SOURCE_JS=$(jq -r '.paths.source.js // "web/static/js"' "$SHARED_CONFIG_FILE")
export SOURCE_CSS=$(jq -r '.paths.source.css // "web/static/css"' "$SHARED_CONFIG_FILE")

# Build command
export BUILD_COMMAND="go build -o $BUILD_BIN/unix/$BINARY_NAME-v$APP_VERSION ./cmd/server/"
export BUILD_COMMAND_WINDOWS="GOOS=windows GOARCH=amd64 go build -o $BUILD_BIN/windows/$BINARY_NAME-v$APP_VERSION.exe ./cmd/server/"

# Helper functions for getting build configuration
get_js_priority_files() {
    jq -r '.build.js_files.priority_order[]?' "$SCRIPT_CONFIG_FILE" 2>/dev/null
}

get_js_last_files() {
    jq -r '.build.js_files.last_files[]?' "$SCRIPT_CONFIG_FILE" 2>/dev/null
}

get_html_processing_config() {
    local key=$1
    jq -r ".build.html_processing.$key // \"\"" "$SCRIPT_CONFIG_FILE" 2>/dev/null
}
