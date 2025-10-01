#!/bin/bash

# Configuration loader for _script.json
# Source this file to load configuration variables: source scripts/load-config.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$SCRIPT_DIR/_script.json"

# Check if _script.json exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: _script.json not found at $CONFIG_FILE" >&2
    exit 1
fi

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed. Please install jq to parse _script.json." >&2
    exit 1
fi

# Validate _script.json format
if ! jq empty "$CONFIG_FILE" 2>/dev/null; then
    echo "Error: _script.json is not valid JSON." >&2
    exit 1
fi

# Load and export all configuration variables
export RED=$(jq -r '.colors.red // "\u001b[0;31m"' "$CONFIG_FILE")
export GREEN=$(jq -r '.colors.green // "\u001b[0;32m"' "$CONFIG_FILE")
export BLUE=$(jq -r '.colors.blue // "\u001b[0;34m"' "$CONFIG_FILE")
export YELLOW=$(jq -r '.colors.yellow // "\u001b[0;33m"' "$CONFIG_FILE")
export CYAN=$(jq -r '.colors.cyan // "\u001b[0;36m"' "$CONFIG_FILE")
export PURPLE=$(jq -r '.colors.purple // "\u001b[0;35m"' "$CONFIG_FILE")
export GRAY=$(jq -r '.colors.gray // "\u001b[0;90m"' "$CONFIG_FILE")
export BOLD=$(jq -r '.colors.bold // "\u001b[1m"' "$CONFIG_FILE")
export NC=$(jq -r '.colors.nc // "\u001b[0m"' "$CONFIG_FILE")

# App configuration
export BINARY_NAME=$(jq -r '.app.binary_name // "backthynk"' "$CONFIG_FILE")
export PRODUCTION_ENV_VAR=$(jq -r '.app.production_env // "BACKTHYNK_ENV=production"' "$CONFIG_FILE")

# Commands
export GO_TEST_COMMAND=$(jq -r '.makefile.go_test_command // "go test ./... -short"' "$CONFIG_FILE")
export GO_TEST_VERBOSE_COMMAND=$(jq -r '.makefile.go_test_verbose_command // "go test ./... -v -short"' "$CONFIG_FILE")
export BUILD_COMMAND=$(jq -r '.app.build_command // "go build -o {binary_name} ./cmd/server/"' "$CONFIG_FILE" | sed "s/{binary_name}/$BINARY_NAME/g")

# Helper functions for getting lists
get_clean_files() {
    jq -r '.app.clean_files[]?' "$CONFIG_FILE" 2>/dev/null
}

get_clean_dirs() {
    jq -r '.app.clean_dirs[]?' "$CONFIG_FILE" 2>/dev/null
}

get_clean_individual_files() {
    jq -r '.app.clean_individual_files[]?' "$CONFIG_FILE" 2>/dev/null
}

get_fclean_dirs() {
    jq -r '.app.fclean_dirs[]?' "$CONFIG_FILE" 2>/dev/null
}

get_js_priority_files() {
    jq -r '.build.js_files.priority_order[]?' "$CONFIG_FILE" 2>/dev/null
}

get_js_last_files() {
    jq -r '.build.js_files.last_files[]?' "$CONFIG_FILE" 2>/dev/null
}

get_compressed_dirs() {
    jq -r '.build.compressed_dirs[]?' "$CONFIG_FILE" 2>/dev/null
}