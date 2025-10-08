#!/bin/bash

# Bundle Component: Compress Assets
# Applies brotli and gzip compression to assets

source "$(dirname "$0")/../common/common.sh"
source "$(dirname "$0")/../common/load-config.sh"

log_step "Compressing assets (brotli + gzip)..."

# Function to compress a file
compress_file() {
    local file=$1
    local filename=$(basename "$file")

    # Brotli compression (best compression)
    if [ "$BROTLI_AVAILABLE" = "true" ]; then
        if command -v brotli &> /dev/null; then
            brotli -f -k -q 11 "$file" 2>/dev/null && \
            log_substep "  ✓ $filename.br ($(du -h "$file.br" | cut -f1))"
        elif command -v bro &> /dev/null; then
            bro -f -k -q 11 "$file" 2>/dev/null && \
            log_substep "  ✓ $filename.br ($(du -h "$file.br" | cut -f1))"
        fi
    fi

    # Gzip compression (fallback)
    if [ "$GZIP_AVAILABLE" = "true" ]; then
        gzip -9 -f -k "$file" 2>/dev/null && \
        log_substep "  ✓ $filename.gz ($(du -h "$file.gz" | cut -f1))"
    fi
}

# Use dynamically constructed paths from config
BUNDLE_CSS_DIR=$(get_bundle_css_dir)
BUNDLE_JS_DIR=$(get_bundle_js_dir)

# Compress CSS bundle
CSS_BUNDLE="$BUNDLE_CSS_DIR/bundle.css"
if [ -f "$CSS_BUNDLE" ]; then
    log_substep "Compressing CSS bundle..."
    compress_file "$CSS_BUNDLE"
fi

# Compress JS bundle
JS_BUNDLE="$BUNDLE_JS_DIR/bundle.js"
if [ -f "$JS_BUNDLE" ]; then
    log_substep "Compressing JS bundle..."
    compress_file "$JS_BUNDLE"
fi

# Calculate compression ratios
if [ -f "$CSS_BUNDLE" ]; then
    ORIGINAL_CSS=$(du -sb "$CSS_BUNDLE" | awk '{print $1}')
    if [ -f "$CSS_BUNDLE.br" ]; then
        BROTLI_CSS=$(du -sb "$CSS_BUNDLE.br" | awk '{print $1}')
        BROTLI_RATIO=$((100 - (BROTLI_CSS * 100 / ORIGINAL_CSS)))
        log_substep "CSS brotli ratio: ${BROTLI_RATIO}% smaller"
    fi
    if [ -f "$CSS_BUNDLE.gz" ]; then
        GZIP_CSS=$(du -sb "$CSS_BUNDLE.gz" | awk '{print $1}')
        GZIP_RATIO=$((100 - (GZIP_CSS * 100 / ORIGINAL_CSS)))
        log_substep "CSS gzip ratio: ${GZIP_RATIO}% smaller"
    fi
fi

if [ -f "$JS_BUNDLE" ]; then
    ORIGINAL_JS=$(du -sb "$JS_BUNDLE" | awk '{print $1}')
    if [ -f "$JS_BUNDLE.br" ]; then
        BROTLI_JS=$(du -sb "$JS_BUNDLE.br" | awk '{print $1}')
        BROTLI_RATIO=$((100 - (BROTLI_JS * 100 / ORIGINAL_JS)))
        log_substep "JS brotli ratio: ${BROTLI_RATIO}% smaller"
    fi
    if [ -f "$JS_BUNDLE.gz" ]; then
        GZIP_JS=$(du -sb "$JS_BUNDLE.gz" | awk '{print $1}')
        GZIP_RATIO=$((100 - (GZIP_JS * 100 / ORIGINAL_JS)))
        log_substep "JS gzip ratio: ${GZIP_RATIO}% smaller"
    fi
fi

log_success "Asset compression complete"
