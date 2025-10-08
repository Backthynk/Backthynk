#!/bin/bash

# Bundle Component: JavaScript Bundling
# Concatenates and minifies JavaScript with tdewolff/minify

source "$(dirname "$0")/../common/common.sh"
source "$(dirname "$0")/../common/load-config.sh"

log_step "Bundling JavaScript..."

# Use dynamically constructed paths from config
BUNDLE_JS_DIR=$(get_bundle_js_dir)
mkdir -p "$BUNDLE_JS_DIR"

# Use config values - SOURCE_JS is set by load-config.sh
JS_DIR="$PROJECT_ROOT/web/$SOURCE_JS"
BUNDLE_JS="$BUNDLE_JS_DIR/bundle.js"
COMBINED_JS="$CACHE_DIR/combined.js"

log_substep "Preparing file order..."

# Get priority and last files from JSON
readarray -t PRIORITY_FILES < <(get_js_priority_files)
readarray -t LAST_FILES < <(get_js_last_files)

# Build ordered file list
ORDERED_FILES=()

# Add priority files first
for priority_file in "${PRIORITY_FILES[@]}"; do
    if [ -f "$JS_DIR/$priority_file" ]; then
        ORDERED_FILES+=("$JS_DIR/$priority_file")
    fi
done

# Add remaining files (excluding priority and last files)
for jsfile in "$JS_DIR"/*.js; do
    if [ -f "$jsfile" ]; then
        filename=$(basename "$jsfile")
        # Skip if it's a priority file or last file
        if [[ ! " ${PRIORITY_FILES[@]} " =~ " ${filename} " ]] && [[ ! " ${LAST_FILES[@]} " =~ " ${filename} " ]]; then
            ORDERED_FILES+=("$jsfile")
        fi
    fi
done

# Add last files at the end
for last_file in "${LAST_FILES[@]}"; do
    if [ -f "$JS_DIR/$last_file" ]; then
        ORDERED_FILES+=("$JS_DIR/$last_file")
    fi
done

# Concatenate all JS files in order
log_substep "Concatenating ${#ORDERED_FILES[@]} JavaScript files..."
> "$COMBINED_JS"  # Create empty file

for jsfile in "${ORDERED_FILES[@]}"; do
    cat "$jsfile" >> "$COMBINED_JS"
    echo "" >> "$COMBINED_JS"  # Add newline between files
done

# Minify if in full mode
if [ "$MINIFY_MODE" = "full" ]; then
    log_substep "Minifying JavaScript with minify..."

    # Use tdewolff/minify for JS minification
    # --html-keep-whitespace=false minifies HTML inside template literals
    if minify --type=js --html-keep-whitespace=false "$COMBINED_JS" > "$BUNDLE_JS"; then
        log_success "JavaScript bundling complete: $(du -h "$BUNDLE_JS" | cut -f1)"
    else
        log_error "JavaScript minification failed"
        exit 1
    fi
else
    # Debug mode: no minification
    log_substep "Debug mode: copying JS without minification..."
    cp "$COMBINED_JS" "$BUNDLE_JS"
    log_success "JavaScript bundling complete: $(du -h "$BUNDLE_JS" | cut -f1)"
fi
