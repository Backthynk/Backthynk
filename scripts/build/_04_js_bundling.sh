#!/bin/bash

# Build Component: JavaScript Bundling and Processing
# This script handles JS file bundling, ordering, and minification

source "$(dirname "$0")/../common/common.sh"
source "$(dirname "$0")/../common/load-config.sh"

# Function to select and apply minification (imported from _02_compression_setup.sh)
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
    fi
}

log_step "Bundling and minifying JavaScript files..."

# Get JS configuration
JS_DIR="$SOURCE_JS"
BUNDLE_OUTPUT="$COMPRESSED_JS_DIR/bundle.js"

# Get priority and last files from JSON
readarray -t PRIORITY_FILES < <(get_js_priority_files)
readarray -t LAST_FILES < <(get_js_last_files)

# Get all JS files and create ordered list
JS_FILES=()

# Add priority files first
for priority_file in "${PRIORITY_FILES[@]}"; do
    if [ -f "$JS_DIR/$priority_file" ]; then
        JS_FILES+=("$JS_DIR/$priority_file")
    fi
done

# Add remaining files (excluding priority and last files)
for jsfile in "$JS_DIR"/*.js; do
    if [ -f "$jsfile" ]; then
        filename=$(basename "$jsfile")
        # Skip if it's a priority file or last file
        if [[ ! " ${PRIORITY_FILES[@]} " =~ " ${filename} " ]] && [[ ! " ${LAST_FILES[@]} " =~ " ${filename} " ]]; then
            JS_FILES+=("$jsfile")
        fi
    fi
done

# Add last files at the end
for last_file in "${LAST_FILES[@]}"; do
    if [ -f "$JS_DIR/$last_file" ]; then
        JS_FILES+=("$JS_DIR/$last_file")
    fi
done

log_substep "Bundling JavaScript files in correct order..."
BUNDLE_FILE="$BUNDLE_OUTPUT"

# Create empty bundle file
> "$BUNDLE_FILE"

# Concatenate all JS files in order
for jsfile in "${JS_FILES[@]}"; do
    if [ -f "$jsfile" ]; then
        log_substep "  Adding $(basename "$jsfile")..."
        echo "/* === $(basename "$jsfile") === */" >> "$BUNDLE_FILE"
        cat "$jsfile" >> "$BUNDLE_FILE"
        echo "" >> "$BUNDLE_FILE"
        # Ensure each file ends with a semicolon to prevent syntax errors
        echo ";" >> "$BUNDLE_FILE"
        echo "" >> "$BUNDLE_FILE"  # Add newline between files
    else
        log_warning "$(basename "$jsfile") not found, skipping..."
    fi
done

log_substep "Cleaning and minifying bundled JavaScript..."

# First, clean up the bundle (remove file markers and clean up semicolons)
sed 's|/\* === .* === \*/||g' "$BUNDLE_FILE" | \
sed 's|;;*|;|g' | \
sed 's/^[[:space:]]\+//g' | \
sed 's/[[:space:]]\+$//g' > "${BUNDLE_FILE}.tmp"

mv "${BUNDLE_FILE}.tmp" "$BUNDLE_FILE"

# Apply progressive minification
ORIGINAL_SIZE=$(du -sb "$BUNDLE_FILE" | awk '{print $1}')
TEMP_MINIFIED="${BUNDLE_FILE}.min"

if select_minifier "$BUNDLE_FILE" "$TEMP_MINIFIED" "js"; then
    MINIFIED_SIZE=$(du -sb "$TEMP_MINIFIED" | awk '{print $1}')
    if [ -s "$TEMP_MINIFIED" ] && [ "$MINIFIED_SIZE" -gt 0 ]; then
        mv "$TEMP_MINIFIED" "$BUNDLE_FILE"
        SAVINGS=$((ORIGINAL_SIZE - MINIFIED_SIZE))
        PERCENT=$((SAVINGS * 100 / ORIGINAL_SIZE))
        log_success "Created minified bundle: $(basename "$BUNDLE_FILE") ($(du -h "$BUNDLE_FILE" | cut -f1), -$PERCENT% reduction)"
    else
        log_warning "Minification produced empty file, using cleaned bundle"
        rm -f "$TEMP_MINIFIED"
    fi
else
    rm -f "$TEMP_MINIFIED"
fi

log_success "JavaScript bundling complete"