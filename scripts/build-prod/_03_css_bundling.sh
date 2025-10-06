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

        # Fall back to perl/sed-based CSS minification
        log_substep "Using perl/sed-based CSS minification..."
        # Remove multi-line CSS comments first with perl, then minify with sed
        perl -0777 -pe 's|/\*.*?\*/||gs' "$input_file" | \
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

# Ensure cache directory exists
CACHE_DIR=$(jq -r '.paths.cache_dir' "$SCRIPT_DIR/_script.json")
mkdir -p "$CACHE_DIR"

# Generate optimized Tailwind CSS first
TAILWIND_DIR="scripts/build-prod/tailwind-build"
TAILWIND_TEMP="$CACHE_DIR/tailwind-optimized.css"

if [ -d "$TAILWIND_DIR" ]; then
    log_substep "Generating optimized Tailwind CSS..."

    # Generate Tailwind directly to cache for bundling (using absolute path)
    TAILWIND_ABS_PATH="$(cd "$(dirname "$TAILWIND_TEMP")" && pwd)/$(basename "$TAILWIND_TEMP")"
    if (cd "$TAILWIND_DIR" && npx tailwindcss -i ./tailwind-input.css -o "$TAILWIND_ABS_PATH" --minify); then
        if [ -f "$TAILWIND_TEMP" ]; then
            TAILWIND_SIZE=$(du -h "$TAILWIND_TEMP" | cut -f1)
            log_substep "✓ Generated optimized Tailwind CSS ($TAILWIND_SIZE)"
        else
            log_error "Tailwind build reported success but output file not found: $TAILWIND_TEMP"
            exit 1
        fi
    else
        log_error "Failed to generate Tailwind CSS"
        exit 1
    fi
else
    log_error "Tailwind build directory not found: $TAILWIND_DIR"
    exit 1
fi

# Generate optimized Font Awesome CSS
FONTAWESOME_DIR="scripts/build-prod/fontawesome-build"
FONTAWESOME_TEMP="$CACHE_DIR/fontawesome-optimized.css"

if [ -d "$FONTAWESOME_DIR" ]; then
    log_substep "Generating optimized Font Awesome CSS..."

    # Generate Font Awesome directly to cache for bundling
    if (cd "$FONTAWESOME_DIR" && node build-fontawesome.js); then
        if [ -f "$FONTAWESOME_TEMP" ]; then
            FONTAWESOME_SIZE=$(du -h "$FONTAWESOME_TEMP" | cut -f1)
            log_substep "✓ Generated optimized Font Awesome CSS ($FONTAWESOME_SIZE)"
        else
            log_error "Font Awesome build reported success but output file not found: $FONTAWESOME_TEMP"
            exit 1
        fi
    else
        log_error "Failed to generate Font Awesome CSS"
        exit 1
    fi
else
    log_error "Font Awesome build directory not found: $FONTAWESOME_DIR"
    exit 1
fi

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

# Ensure CSS directory exists and has files
if [ ! -d "$CSS_DIR" ]; then
    log_error "CSS directory not found: $CSS_DIR"
    exit 1
fi

if [ -z "$(find "$CSS_DIR" -name "*.css" 2>/dev/null)" ]; then
    log_error "No CSS files found in: $CSS_DIR"
    exit 1
fi

# Ensure compressed directory exists
if [ ! -d "$CSS_COMPRESSED_DIR" ]; then
    log_substep "Creating CSS compressed directory: $CSS_COMPRESSED_DIR"
    mkdir -p "$CSS_COMPRESSED_DIR"
fi

# Create single combined CSS file
COMBINED_CSS="$CSS_COMPRESSED_DIR/bundle.css"
if ! > "$COMBINED_CSS"; then
    log_error "Failed to create output file: $COMBINED_CSS"
    exit 1
fi

log_substep "Combining and minifying CSS files..."

# Add optimized CSS frameworks first
if [ -f "$TAILWIND_TEMP" ]; then
    log_substep "  Adding optimized Tailwind CSS..."
    cat "$TAILWIND_TEMP" >> "$COMBINED_CSS"
fi

if [ -f "$FONTAWESOME_TEMP" ]; then
    log_substep "  Adding optimized Font Awesome CSS..."
    cat "$FONTAWESOME_TEMP" >> "$COMBINED_CSS"
fi

# Combine all other CSS files
for cssfile in "$CSS_DIR"/*.css; do
    if [ -f "$cssfile" ] && [ "$(basename "$cssfile")" != "compressed" ] && [ "$(basename "$cssfile")" != "tailwind.css" ]; then
        log_substep "  Adding $(basename "$cssfile")..."
        cat "$cssfile" >> "$COMBINED_CSS"
    fi
done

# Minify the combined CSS
TEMP_MINIFIED="${COMBINED_CSS}.min"
ORIGINAL_CSS_SIZE=$(du -sb "$COMBINED_CSS" | awk '{print $1}')

if select_minifier "$COMBINED_CSS" "$TEMP_MINIFIED" "css"; then
    MINIFIED_CSS_SIZE=$(du -sb "$TEMP_MINIFIED" | awk '{print $1}')
    if [ -s "$TEMP_MINIFIED" ] && [ "$MINIFIED_CSS_SIZE" -gt 0 ]; then
        if ! mv "$TEMP_MINIFIED" "$COMBINED_CSS"; then
            log_error "Failed to replace CSS file with minified version"
            exit 1
        fi
        SAVINGS=$((ORIGINAL_CSS_SIZE - MINIFIED_CSS_SIZE))
        PERCENT=$((SAVINGS * 100 / ORIGINAL_CSS_SIZE))
        log_success "Created minified CSS bundle: $(basename "$COMBINED_CSS") ($(du -h "$COMBINED_CSS" | cut -f1), -$PERCENT% reduction)"
    else
        log_error "CSS minification produced empty or invalid file"
        rm -f "$TEMP_MINIFIED"
        exit 1
    fi
else
    log_error "Failed to minify CSS"
    rm -f "$TEMP_MINIFIED"
    exit 1
fi

log_success "CSS processing complete"