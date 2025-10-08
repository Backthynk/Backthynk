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
export APP_NAME=$(jq -r '.app.name // ""' "$SHARED_CONFIG_FILE")
export APP_VERSION=$(jq -r '.app.version // "0.1.0"' "$SHARED_CONFIG_FILE")
export BINARY_NAME="$APP_NAME"
export PRODUCTION_ENV_VAR="APP_ENV=production"

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
export SOURCE_IMAGES=$(jq -r '.paths.source.images // "web/static/images"' "$SHARED_CONFIG_FILE")

# Cache directory (shared across build scripts)
export CACHE_DIR="$PROJECT_ROOT/scripts/.cache"

# Release directory structure
export RELEASES_DIR="$PROJECT_ROOT/releases"

# Detect current OS and architecture for local builds
detect_current_platform() {
    local os=$(uname -s | tr '[:upper:]' '[:lower:]')
    local arch=$(uname -m)

    # Normalize OS name
    case "$os" in
        linux*)
            os="linux"
            ;;
        darwin*)
            os="macos"
            ;;
        mingw*|msys*|cygwin*)
            os="windows"
            ;;
    esac

    # Normalize architecture
    case "$arch" in
        x86_64|amd64)
            arch="amd64"
            ;;
        aarch64|arm64)
            arch="arm64"
            ;;
        armv7l)
            arch="arm"
            ;;
    esac

    echo "${os}-${arch}"
}

# Get appropriate C compiler for cross-compilation
get_cc_for_platform() {
    local platform=$1
    case "$platform" in
        linux-amd64)
            echo ""  # Native compiler
            ;;
        linux-arm64)
            echo "CC=aarch64-linux-gnu-gcc"
            ;;
        macos-amd64)
            echo "CC=o64-clang"
            ;;
        macos-arm64)
            echo "CC=oa64-clang"
            ;;
        windows-amd64)
            echo "CC=x86_64-w64-mingw32-gcc"
            ;;
        *)
            echo ""
            ;;
    esac
}

# All supported platforms for workflow builds
ALL_PLATFORMS=(
    "linux-amd64:GOOS=linux GOARCH=amd64"
    "linux-arm64:GOOS=linux GOARCH=arm64 CC=aarch64-linux-gnu-gcc"
    "macos-amd64:GOOS=darwin GOARCH=amd64 CC=o64-clang"
    "macos-arm64:GOOS=darwin GOARCH=arm64 CC=oa64-clang"
    "windows-amd64:GOOS=windows GOARCH=amd64 CC=x86_64-w64-mingw32-gcc"
)

# Determine which platforms to build based on mode
if [ "${BUILD_MODE:-local}" = "workflow" ]; then
    # Workflow mode: build all platforms
    export BUILD_PLATFORMS=("${ALL_PLATFORMS[@]}")
else
    # Local mode: build only current platform
    CURRENT_PLATFORM=$(detect_current_platform)

    # Find the configuration for the current platform
    for platform_config in "${ALL_PLATFORMS[@]}"; do
        platform="${platform_config%%:*}"
        if [ "$platform" = "$CURRENT_PLATFORM" ]; then
            export BUILD_PLATFORMS=("$platform_config")
            break
        fi
    done

    # Fallback to linux-amd64 if current platform not found in supported list
    if [ -z "$BUILD_PLATFORMS" ]; then
        echo "Warning: Current platform $CURRENT_PLATFORM not in supported list, defaulting to linux-amd64" >&2
        export BUILD_PLATFORMS=("linux-amd64:GOOS=linux GOARCH=amd64")
    fi
fi

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

# Extract changelog text for current version from CHANGELOG.md
# Returns all content between ## [version] and the next ## or ---
get_version_changelog() {
    local changelog_file="$PROJECT_ROOT/docs/CHANGELOG.md"

    if [ ! -f "$changelog_file" ]; then
        echo "Error: CHANGELOG.md not found at $changelog_file" >&2
        return 1
    fi

    # Get current version from config
    local version="$APP_VERSION"

    # Use awk to extract text between ## [version] and next ## or ---
    awk -v version="$version" '
        /^## \[/ {
            # Check if this is the version we want
            if ($0 ~ "\\[" version "\\]") {
                in_section = 1
                print
                next
            } else if (in_section) {
                # Hit a different version section, stop
                exit
            }
        }
        /^---/ {
            # Hit separator, stop if we were in the section
            if (in_section) exit
        }
        in_section { print }
    ' "$changelog_file"
}

# Bundle path construction helpers (mirrors config.go logic)
# These helpers dynamically construct paths from .config.json values
get_bundle_dir() {
    echo "$PROJECT_ROOT/$(jq -r '.paths.dir."pre-production" // "bundle"' "$SHARED_CONFIG_FILE")"
}

get_bundle_static_dir() {
    local bundle_dir=$(get_bundle_dir)
    local static_path=$(jq -r '.paths.source.static // "static"' "$SHARED_CONFIG_FILE")
    echo "$bundle_dir/$static_path"
}

get_bundle_templates_dir() {
    local bundle_dir=$(get_bundle_dir)
    local templates_path=$(jq -r '.paths.source.templates // "templates"' "$SHARED_CONFIG_FILE")
    echo "$bundle_dir/$templates_path"
}

get_bundle_css_dir() {
    local bundle_dir=$(get_bundle_dir)
    local css_path=$(jq -r '.paths.source.css // "static/css"' "$SHARED_CONFIG_FILE")
    echo "$bundle_dir/$css_path"
}

get_bundle_js_dir() {
    local bundle_dir=$(get_bundle_dir)
    local js_path=$(jq -r '.paths.source.js // "static/js"' "$SHARED_CONFIG_FILE")
    echo "$bundle_dir/$js_path"
}
