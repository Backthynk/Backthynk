#!/bin/bash

# Bundle Component: Check Build Tools
# Ensures all required bundling tools are available

source "$(dirname "$0")/../common/common.sh"
source "$(dirname "$0")/../common/load-config.sh"

log_step "Checking bundling tools..."

# Check for minify (tdewolff/minify for HTML/CSS/JS minification)
if command -v minify &> /dev/null; then
    MINIFY_VERSION=$(minify --version 2>/dev/null || echo "unknown")
    log_substep "✓ minify found ($MINIFY_VERSION)"
else
    log_error "minify is required but not found. Install with: go install github.com/tdewolff/minify/v2/cmd/minify@latest"
    exit 1
fi

# Check for npx (required for Tailwind, Font Awesome, CSSO)
if command -v npx &> /dev/null; then
    log_substep "✓ npx found"
else
    log_error "npx is required but not found. Install Node.js and npm."
    exit 1
fi

# Ensure npm dependencies are installed for Tailwind
TAILWIND_DIR="$PROJECT_ROOT/scripts/bundle/tailwind"
if [ -d "$TAILWIND_DIR" ] && [ -f "$TAILWIND_DIR/package.json" ]; then
    if [ ! -d "$TAILWIND_DIR/node_modules" ]; then
        log_substep "Installing Tailwind dependencies..."
        (cd "$TAILWIND_DIR" && npm install --silent) || {
            log_error "Failed to install Tailwind dependencies"
            exit 1
        }
    fi
fi

# Ensure npm dependencies are installed for Font Awesome
FONTAWESOME_DIR="$PROJECT_ROOT/scripts/bundle/fontawesome"
if [ -d "$FONTAWESOME_DIR" ] && [ -f "$FONTAWESOME_DIR/package.json" ]; then
    if [ ! -d "$FONTAWESOME_DIR/node_modules" ]; then
        log_substep "Installing Font Awesome dependencies..."
        (cd "$FONTAWESOME_DIR" && npm install --silent) || {
            log_error "Failed to install Font Awesome dependencies"
            exit 1
        }
    fi
fi

# Check for brotli (required for compression)
if command -v brotli &> /dev/null; then
    log_substep "✓ brotli found"
    export BROTLI_AVAILABLE=true
elif command -v bro &> /dev/null; then
    log_substep "✓ brotli found (as 'bro')"
    export BROTLI_AVAILABLE=true
else
    log_error "brotli is required but not found"
    log_substep "  Install with: sudo apt-get install brotli (Ubuntu/Debian)"
    log_substep "  Or on macOS: brew install brotli"
    exit 1
fi

# Check for gzip (required for compression)
if command -v gzip &> /dev/null; then
    log_substep "✓ gzip found"
    export GZIP_AVAILABLE=true
else
    log_error "gzip is required but not found"
    exit 1
fi

log_success "All required bundling tools are available"
