#!/bin/bash

# Build Component: HTML Processing and Template Optimization
# This script handles HTML minification and asset reference updates

source "$(dirname "$0")/../common/common.sh"
source "$(dirname "$0")/../common/load-config.sh"

log_step "Processing HTML templates..."

# Get paths from configuration
TEMPLATES_DIR=$(jq -r '.paths.templates_root' "$SCRIPT_DIR/_script.json")
TEMPLATES_COMPRESSED_DIR=$(jq -r '.build.compressed_dirs[] | select(contains("templates"))' "$SCRIPT_DIR/_script.json")
JS_BUNDLE_PATH=$(jq -r '.build.assets.js_bundle_path' "$SCRIPT_DIR/_script.json")
CSS_BUNDLE_PATH=$(jq -r '.build.assets.css_bundle_path' "$SCRIPT_DIR/_script.json")
JS_START_TAG=$(jq -r '.build.html_processing.js_script_tags_start' "$SCRIPT_DIR/_script.json")
JS_END_TAG=$(jq -r '.build.html_processing.js_script_tags_end' "$SCRIPT_DIR/_script.json")
TAILWIND_CDN_PATTERN=$(jq -r '.build.html_processing.tailwind_cdn_pattern' "$SCRIPT_DIR/_script.json")
FONTAWESOME_CDN_PATTERN=$(jq -r '.build.html_processing.fontawesome_cdn_pattern' "$SCRIPT_DIR/_script.json")

if [ ! -d "$TEMPLATES_DIR" ]; then
    log_warning "Templates directory not found: $TEMPLATES_DIR"
    return 0
fi

# Process each HTML file
for htmlfile in "$TEMPLATES_DIR"/*.html; do
    if [ -f "$htmlfile" ] && [ "$(basename "$htmlfile")" != "compressed" ]; then
        log_substep "Processing $(basename "$htmlfile")..."

        output_file="$TEMPLATES_COMPRESSED_DIR/$(basename "$htmlfile")"

        # Process HTML: minify and update asset references
        # Remove multi-line HTML comments first, then process normally
        perl -0777 -pe 's/<!--.*?-->//gs' "$htmlfile" | \
        sed 's/>[[:space:]]\+</></g' | \
        sed 's/^[[:space:]]\+//g' | \
        sed '/^[[:space:]]*$/d' | \
        sed 's/[[:space:]]\+/ /g' | \
        sed "/<script src=\"\/static\/js\/${JS_START_TAG}\"><\/script>/,/<script src=\"\/static\/js\/${JS_END_TAG}\"><\/script>/{
            /<script src=\"\/static\/js\/${JS_START_TAG}\"><\/script>/c\\
<script src=\"${JS_BUNDLE_PATH}\"></script>
            /<script src=\"\/static\/js\/.*\.js\"><\/script>/d
        }" | \
        sed "s|/static/css/\([^\"]*\)\.css|${CSS_BUNDLE_PATH}|g" | \
        sed "/<script src=\"${TAILWIND_CDN_PATTERN//\//\\/}\/.*\"><\/script>/d" | \
        sed "/<link href=\"${FONTAWESOME_CDN_PATTERN//\//\\/}\/.*\" rel=\"stylesheet\">/d" > "$output_file"

        # Calculate savings
        ORIGINAL_SIZE=$(du -sb "$htmlfile" | awk '{print $1}')
        MINIFIED_SIZE=$(du -sb "$output_file" | awk '{print $1}')

        if [ "$ORIGINAL_SIZE" -gt 0 ]; then
            SAVINGS=$((ORIGINAL_SIZE - MINIFIED_SIZE))
            PERCENT=$((SAVINGS * 100 / ORIGINAL_SIZE))
            log_substep "  Minified $(basename "$htmlfile"): $(du -h "$output_file" | cut -f1) (-$PERCENT% reduction)"
        else
            log_substep "  Processed $(basename "$htmlfile"): $(du -h "$output_file" | cut -f1)"
        fi
    fi
done

log_success "HTML processing complete"