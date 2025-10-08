#!/bin/bash

# Bundle Component: CSS Bundling with Modern Tooling
# Uses Tailwind, PostCSS, and cssnano for optimal CSS bundling

source "$(dirname "$0")/../common/common.sh"
source "$(dirname "$0")/../common/load-config.sh"

log_step "Bundling CSS with modern tooling..."

# Ensure cache and bundle CSS directories exist (using config-based paths)
mkdir -p "$CACHE_DIR"
BUNDLE_CSS_DIR=$(get_bundle_css_dir)
mkdir -p "$BUNDLE_CSS_DIR"

# Generate optimized Tailwind CSS
TAILWIND_DIR="$PROJECT_ROOT/scripts/bundle/tailwind-build"
TAILWIND_OUTPUT="$CACHE_DIR/tailwind-optimized.css"

if [ -d "$TAILWIND_DIR" ]; then
    log_substep "Generating optimized Tailwind CSS..."

    TAILWIND_ABS_PATH="$(cd "$(dirname "$TAILWIND_OUTPUT")" && pwd)/$(basename "$TAILWIND_OUTPUT")"
    if (cd "$TAILWIND_DIR" && npx tailwindcss -i ./tailwind-input.css -o "$TAILWIND_ABS_PATH" --minify); then
        if [ -f "$TAILWIND_OUTPUT" ]; then
            TAILWIND_SIZE=$(du -h "$TAILWIND_OUTPUT" | cut -f1)
            log_substep "✓ Generated Tailwind CSS ($TAILWIND_SIZE)"
        else
            log_error "Tailwind build failed: output file not found"
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
FONTAWESOME_DIR="$PROJECT_ROOT/scripts/bundle/fontawesome-build"
FONTAWESOME_OUTPUT="$CACHE_DIR/fontawesome-optimized.css"

if [ -d "$FONTAWESOME_DIR" ]; then
    log_substep "Generating optimized Font Awesome CSS..."

    if (cd "$FONTAWESOME_DIR" && node build-fontawesome.js); then
        if [ -f "$FONTAWESOME_OUTPUT" ]; then
            FONTAWESOME_SIZE=$(du -h "$FONTAWESOME_OUTPUT" | cut -f1)
            log_substep "✓ Generated Font Awesome CSS ($FONTAWESOME_SIZE)"
        else
            log_error "Font Awesome build failed: output file not found"
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

# Get CSS source path from config (using load-config.sh variables)
# SOURCE_CSS is already set by load-config.sh from .config.json
CSS_DIR="$PROJECT_ROOT/web/$SOURCE_CSS"
COMBINED_CSS="$CACHE_DIR/combined.css"

log_substep "Combining CSS files..."

# Start with frameworks
cat "$TAILWIND_OUTPUT" > "$COMBINED_CSS"
cat "$FONTAWESOME_OUTPUT" >> "$COMBINED_CSS"

# Add custom CSS files
for cssfile in "$CSS_DIR"/*.css; do
    if [ -f "$cssfile" ]; then
        log_substep "  Adding $(basename "$cssfile")..."
        cat "$cssfile" >> "$COMBINED_CSS"
    fi
done

# Bundle and optimize CSS (use dynamically constructed path)
BUNDLE_CSS="$BUNDLE_CSS_DIR/bundle.css"

if [ "$MINIFY_MODE" = "full" ]; then
    log_substep "Minifying CSS with cssnano..."

    # Check for npx availability - fail if not available
    if ! command -v npx &> /dev/null; then
        log_error "npx not found - required for CSS minification"
        exit 1
    fi

    # Use postcss with cssnano plugin via npx
    # We use --use flag to avoid needing a config file
    if npx --yes -p postcss-cli -p cssnano postcss "$COMBINED_CSS" \
        --use cssnano \
        --cssnano.preset=default \
        --no-map \
        -o "$BUNDLE_CSS"; then
        log_success "CSS bundling complete: $(du -h "$BUNDLE_CSS" | cut -f1)"
    else
        log_error "CSS minification failed"
        exit 1
    fi
else
    # Debug mode: no minification, just combine
    log_substep "Debug mode: copying CSS without minification..."
    cp "$COMBINED_CSS" "$BUNDLE_CSS"
    log_success "CSS bundling complete: $(du -h "$BUNDLE_CSS" | cut -f1)"
fi
