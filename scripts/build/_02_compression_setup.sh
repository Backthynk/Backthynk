#!/bin/bash

# Build Component: Compression Setup and Tool Selection
# This script sets up the compression environment and provides minification functions

source "$(dirname "$0")/../common/common.sh"
source "$(dirname "$0")/../common/load-config.sh"

log_step "Setting up compression tools..."

# Create compressed directories from shared config
mkdir -p "$COMPRESSED_JS_DIR"
mkdir -p "$COMPRESSED_CSS_DIR"
mkdir -p "$COMPRESSED_TEMPLATES_DIR"
log_substep "Created directory: $COMPRESSED_JS_DIR"
log_substep "Created directory: $COMPRESSED_CSS_DIR"
log_substep "Created directory: $COMPRESSED_TEMPLATES_DIR"

# Function to select and apply minification based on availability
select_minifier() {
    local input_file="$1"
    local output_file="$2"
    local file_type="$3"

    if [ "$file_type" = "js" ]; then
        # Try terser first (best compression)
        if [ "$TERSER_AVAILABLE" = "true" ]; then
            log_substep "Using terser for maximum compression..."
            if terser "$input_file" --compress --mangle --toplevel --output "$output_file" 2>/dev/null; then
                return 0
            fi
        fi

        # Try esbuild second (good compression, fast)
        if [ "$ESBUILD_AVAILABLE" = "true" ]; then
            log_substep "Using esbuild for compression..."
            if esbuild "$input_file" --minify --outfile="$output_file" 2>/dev/null; then
                return 0
            fi
        fi

        # No minification available - should never reach here due to dependency check
        echo -e "${RED}Error: No JS minification tools available${NC}" >&2
        exit 1

    elif [ "$file_type" = "css" ]; then
        # Try terser first (if it supports CSS)
        if [ "$TERSER_AVAILABLE" = "true" ]; then
            log_substep "Attempting CSS minification with terser..."
            if terser "$input_file" --compress --output "$output_file" 2>/dev/null; then
                return 0
            fi
        fi

        # Fall back to sed-based CSS minification
        log_substep "Using sed-based CSS minification..."
        sed 's|/\*.*\*/||g' "$input_file" | \
        sed '/^[[:space:]]*$/d' | \
        tr -d '\n' | \
        sed 's/[[:space:]]\+/ /g' | \
        sed 's/; /;/g' | \
        sed 's/, /,/g' | \
        sed 's/{ /{/g' | \
        sed 's/ }/}/g' | \
        sed 's/: /:/g' > "$output_file"
        return 0
    fi
}

# Export the function for use by other scripts
export -f select_minifier

log_success "Compression setup complete"