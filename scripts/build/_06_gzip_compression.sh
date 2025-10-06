#!/bin/bash

# Build Component: Gzip Compression
# This script applies gzip compression to JavaScript and CSS bundles

source "$(dirname "$0")/../common/common.sh"
source "$(dirname "$0")/../common/load-config.sh"

log_step "Applying gzip compression to assets..."

# Get paths from configuration
BUNDLE_OUTPUT="$COMPRESSED_JS_DIR/bundle.js"
CSS_COMPRESSED_DIR="$COMPRESSED_CSS_DIR"

# Compress JavaScript bundle with gzip
if [ -f "$BUNDLE_OUTPUT" ]; then
    log_substep "Compressing JavaScript bundle with gzip..."
    ORIGINAL_JS_SIZE=$(du -sb "$BUNDLE_OUTPUT" | awk '{print $1}')

    gzip -9 -f -k "$BUNDLE_OUTPUT"  # -f force overwrite, -k keeps original file

    if [ -f "${BUNDLE_OUTPUT}.gz" ]; then
        GZIP_JS_SIZE=$(du -sb "${BUNDLE_OUTPUT}.gz" | awk '{print $1}')
        GZIP_JS_SAVINGS=$((ORIGINAL_JS_SIZE - GZIP_JS_SIZE))
        GZIP_JS_PERCENT=$((GZIP_JS_SAVINGS * 100 / ORIGINAL_JS_SIZE))
        log_success "Created gzipped bundle: $(basename "${BUNDLE_OUTPUT}.gz") ($(du -h "${BUNDLE_OUTPUT}.gz" | cut -f1), -$GZIP_JS_PERCENT% from original)"
    else
        log_warning "Failed to create gzipped JavaScript bundle"
    fi
else
    log_warning "JavaScript bundle not found: $BUNDLE_OUTPUT"
fi

# Compress CSS bundle with gzip
CSS_BUNDLE="$CSS_COMPRESSED_DIR/bundle.css"
if [ -f "$CSS_BUNDLE" ]; then
    log_substep "Compressing CSS bundle with gzip..."
    ORIGINAL_CSS_SIZE=$(du -sb "$CSS_BUNDLE" | awk '{print $1}')

    gzip -9 -f -k "$CSS_BUNDLE"

    if [ -f "${CSS_BUNDLE}.gz" ]; then
        GZIP_CSS_SIZE=$(du -sb "${CSS_BUNDLE}.gz" | awk '{print $1}')
        CSS_SAVINGS=$((ORIGINAL_CSS_SIZE - GZIP_CSS_SIZE))
        CSS_PERCENT=$((CSS_SAVINGS * 100 / ORIGINAL_CSS_SIZE))
        log_success "Created gzipped CSS bundle: $(basename "${CSS_BUNDLE}.gz") ($(du -h "${CSS_BUNDLE}.gz" | cut -f1), -$CSS_PERCENT% from original)"
    else
        log_warning "Failed to compress CSS bundle"
    fi
else
    log_info "CSS bundle not found: $CSS_BUNDLE"
fi

log_success "Gzip compression complete"