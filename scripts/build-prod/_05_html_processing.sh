#!/bin/bash

# Build Component: HTML Processing and Template Optimization
# This script handles HTML minification and asset reference updates

source "$(dirname "$0")/../common/common.sh"
source "$(dirname "$0")/../common/load-config.sh"

log_step "Processing HTML templates..."

# Get paths from configuration
TEMPLATES_DIR=$(jq -r '.paths.templates_root' "$SCRIPT_DIR/_script.json")
TEMPLATES_COMPRESSED_DIR=$(jq -r '.build.compressed_dirs[] | select(contains("templates"))' "$SCRIPT_DIR/_script.json")

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
        sed 's/<!--.*-->//g' "$htmlfile" | \
        sed 's/>[[:space:]]\+</></g' | \
        sed 's/^[[:space:]]\+//g' | \
        sed '/^[[:space:]]*$/d' | \
        sed 's/[[:space:]]\+/ /g' | \
        sed '/<script src="\/static\/js\/constants\.js"><\/script>/,/<script src="\/static\/js\/main\.js"><\/script>/{
            /<script src="\/static\/js\/constants\.js"><\/script>/c\
<script src="/static/js/compressed/bundle.js"></script>
            /<script src="\/static\/js\/.*\.js"><\/script>/d
        }' | \
        sed 's|/static/css/\([^"]*\)\.css|/static/css/compressed/bundle.css|g' > "$output_file"

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