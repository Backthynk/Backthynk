#!/bin/bash

# Build Component: CSS Bundling and Processing
# This script handles CSS extraction, bundling, and minification

source "$(dirname "$0")/../common/common.sh"
source "$(dirname "$0")/../common/load-config.sh"

# Function to select and apply minification (imported from _02_compression_setup.sh)
select_minifier() {
    local input_file="$1"
    local output_file="$2"
    local file_type="$3"

    if [ "$file_type" = "css" ]; then
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

log_step "Processing CSS files..."

# Extract minimal CSS first (if CSS extraction tool exists)
CSS_TOOL_BINARY=$(jq -r '.makefile.css_tool_build_command | split(" ") | .[2]' "$SCRIPT_DIR/_script.json" 2>/dev/null || echo "")
if [ -n "$CSS_TOOL_BINARY" ] && [ -f "$CSS_TOOL_BINARY" ]; then
    log_substep "Running CSS extraction tool..."
    ./"$CSS_TOOL_BINARY"
elif [ -n "$CSS_TOOL_BINARY" ]; then
    log_substep "Building CSS extraction tool..."
    CSS_TOOL_BUILD_COMMAND=$(jq -r '.makefile.css_tool_build_command' "$SCRIPT_DIR/_script.json" 2>/dev/null || echo "")
    if [ -n "$CSS_TOOL_BUILD_COMMAND" ]; then
        eval "$CSS_TOOL_BUILD_COMMAND"
        ./"$CSS_TOOL_BINARY"
    fi
fi

# Minify CSS files
CSS_DIR=$(jq -r '.paths.css_dir' "$SCRIPT_DIR/_script.json")
CSS_COMPRESSED_DIR=$(jq -r '.build.compressed_dirs[] | select(contains("css"))' "$SCRIPT_DIR/_script.json")

if [ -d "$CSS_DIR" ] && [ -n "$(find "$CSS_DIR" -name "*.css" 2>/dev/null)" ]; then
    # Create single combined CSS file
    COMBINED_CSS="$CSS_COMPRESSED_DIR/bundle.css"
    > "$COMBINED_CSS"

    log_substep "Combining and minifying CSS files..."

    # Combine all CSS files into one
    for cssfile in "$CSS_DIR"/*.css; do
        if [ -f "$cssfile" ] && [ "$(basename "$cssfile")" != "compressed" ]; then
            log_substep "  Adding $(basename "$cssfile")..."
            echo "/* === $(basename "$cssfile") === */" >> "$COMBINED_CSS"
            cat "$cssfile" >> "$COMBINED_CSS"
            echo "" >> "$COMBINED_CSS"
        fi
    done

    # Minify the combined CSS
    TEMP_MINIFIED="${COMBINED_CSS}.min"
    ORIGINAL_CSS_SIZE=$(du -sb "$COMBINED_CSS" | awk '{print $1}')

    if select_minifier "$COMBINED_CSS" "$TEMP_MINIFIED" "css"; then
        MINIFIED_CSS_SIZE=$(du -sb "$TEMP_MINIFIED" | awk '{print $1}')
        if [ -s "$TEMP_MINIFIED" ] && [ "$MINIFIED_CSS_SIZE" -gt 0 ]; then
            mv "$TEMP_MINIFIED" "$COMBINED_CSS"
            SAVINGS=$((ORIGINAL_CSS_SIZE - MINIFIED_CSS_SIZE))
            PERCENT=$((SAVINGS * 100 / ORIGINAL_CSS_SIZE))
            log_success "Created minified CSS bundle: $(basename "$COMBINED_CSS") ($(du -h "$COMBINED_CSS" | cut -f1), -$PERCENT% reduction)"
        else
            log_warning "CSS minification produced empty file, using original"
            rm -f "$TEMP_MINIFIED"
        fi
    else
        rm -f "$TEMP_MINIFIED"
    fi


else
    log_info "No CSS files found to process"
fi

log_success "CSS processing complete"