#!/bin/bash

# Common utilities for scripts
# Source this file in other scripts: source "$(dirname "$0")/../common/common.sh"

# Configuration loader from service.json
# Sets global variables: SERVER_PORT, CONFIG_FILENAME, DATABASE_FILENAME, UPLOADS_SUBDIR
load_config() {
    if [ ! -f "service.json" ]; then
        echo "Error: service.json not found. Please create it with the required configuration." >&2
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        echo "Error: jq is required but not installed. Please install jq to parse service.json." >&2
        exit 1
    fi

    # Validate service.json format
    if ! jq empty service.json 2>/dev/null; then
        echo "Error: service.json is not valid JSON." >&2
        exit 1
    fi

    # Load configuration values
    SERVER_PORT=$(jq -r '.server.port' service.json 2>/dev/null)
    CONFIG_FILENAME=$(jq -r '.files.configFilename' service.json 2>/dev/null)
    DATABASE_FILENAME=$(jq -r '.files.databaseFilename' service.json 2>/dev/null)
    UPLOADS_SUBDIR=$(jq -r '.files.uploadsSubdir' service.json 2>/dev/null)
    STORAGE_PATH=$(jq -r '.files.storagePath' service.json 2>/dev/null)

    # Validate required fields
    if [ "$SERVER_PORT" = "null" ] || [ -z "$SERVER_PORT" ]; then
        echo "Error: server.port is missing or null in service.json" >&2
        exit 1
    fi

    if [ "$CONFIG_FILENAME" = "null" ] || [ -z "$CONFIG_FILENAME" ]; then
        echo "Error: files.configFilename is missing or null in service.json" >&2
        exit 1
    fi

    if [ "$DATABASE_FILENAME" = "null" ] || [ -z "$DATABASE_FILENAME" ]; then
        echo "Error: files.databaseFilename is missing or null in service.json" >&2
        exit 1
    fi

    if [ "$UPLOADS_SUBDIR" = "null" ] || [ -z "$UPLOADS_SUBDIR" ]; then
        echo "Error: files.uploadsSubdir is missing or null in service.json" >&2
        exit 1
    fi

    if [ "$STORAGE_PATH" = "null" ] || [ -z "$STORAGE_PATH" ]; then
        echo "Error: files.storagePath is missing or null in service.json" >&2
        exit 1
    fi
}

# Check if required commands are available
check_dependencies() {
    local missing_deps=()

    for cmd in "$@"; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_deps+=("$cmd")
        fi
    done

    if [ ${#missing_deps[@]} -ne 0 ]; then
        echo "Error: The following required commands are not installed:" >&2
        printf "  %s\n" "${missing_deps[@]}" >&2
        exit 1
    fi
}

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Helper functions for colored output
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_step() {
    echo -e "${PURPLE}▶${NC} $1"
}

log_substep() {
    echo -e "  ${GRAY}•${NC} $1"
}