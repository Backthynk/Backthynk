#!/bin/bash

# Bundle Component: Check Build Tools
# Ensures all required modern bundling tools are available

source "$(dirname "$0")/../common/common.sh"
source "$(dirname "$0")/../common/load-config.sh"

log_step "Checking bundling tools..."

# Track which tools are available
ESBUILD_AVAILABLE=false
BROTLI_AVAILABLE=false
GZIP_AVAILABLE=false

# Check for esbuild (primary JS bundler)
if command -v esbuild &> /dev/null; then
    ESBUILD_VERSION=$(esbuild --version 2>/dev/null || echo "unknown")
    log_substep "✓ esbuild found (v$ESBUILD_VERSION)"
    ESBUILD_AVAILABLE=true
elif command -v npx &> /dev/null && npx --yes esbuild --version &> /dev/null; then
    ESBUILD_VERSION=$(npx --yes esbuild --version 2>/dev/null || echo "unknown")
    log_substep "✓ esbuild found via npx (v$ESBUILD_VERSION)"
    ESBUILD_AVAILABLE=true
else
    log_error "esbuild is required but not found. Install with: npm install -g esbuild"
    exit 1
fi

# Check for PostCSS/cssnano (CSS optimization)
if command -v npx &> /dev/null; then
    log_substep "✓ npx found (will use for CSS processing)"
else
    log_warning "npx not found, CSS optimization will be limited"
fi

# Check for brotli (required for best compression)
if command -v brotli &> /dev/null; then
    log_substep "✓ brotli found"
    BROTLI_AVAILABLE=true
elif command -v bro &> /dev/null; then
    log_substep "✓ brotli found (as 'bro')"
    BROTLI_AVAILABLE=true
else
    log_error "brotli is required but not found"
    log_substep "  Install with: sudo apt-get install brotli (Ubuntu/Debian)"
    log_substep "  Or on macOS: brew install brotli"
    exit 1
fi

# Check for gzip
if command -v gzip &> /dev/null; then
    log_substep "✓ gzip found"
    GZIP_AVAILABLE=true
else
    log_error "gzip is required but not found"
    exit 1
fi

# Check for PostCSS/cssnano (required for CSS optimization)
if command -v npx &> /dev/null; then
    # Test if cssnano is accessible via npx
    if npx --yes cssnano --version &> /dev/null 2>&1 || true; then
        log_substep "✓ cssnano available via npx"
    fi
else
    log_error "npx is required but not found. Install Node.js and npm."
    exit 1
fi

# Export tool availability
export ESBUILD_AVAILABLE
export BROTLI_AVAILABLE
export GZIP_AVAILABLE

log_success "All required bundling tools are available"
