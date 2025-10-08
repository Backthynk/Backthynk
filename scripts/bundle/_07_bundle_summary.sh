#!/bin/bash

# Bundle Component: Bundle Summary
# Displays bundle size with comparison to original source files

source "$(dirname "$0")/../common/common.sh"
source "$(dirname "$0")/../common/load-config.sh"

log_step "Generating bundle summary..."

# Calculate original (uncompressed, unminified) source file sizes
ORIGINAL_HTML_SIZE=0
ORIGINAL_CSS_SIZE=0
ORIGINAL_JS_SIZE=0

# Get original HTML size
TEMPLATE_SOURCE="$PROJECT_ROOT/web/$SOURCE_TEMPLATES/index.html"
if [ -f "$TEMPLATE_SOURCE" ]; then
    ORIGINAL_HTML_SIZE=$(stat -f%z "$TEMPLATE_SOURCE" 2>/dev/null || stat -c%s "$TEMPLATE_SOURCE" 2>/dev/null || echo 0)
fi

# Get original CSS size (all source CSS files + Tailwind + FontAwesome)
CSS_DIR="$PROJECT_ROOT/web/$SOURCE_CSS"
for cssfile in "$CSS_DIR"/*.css; do
    if [ -f "$cssfile" ]; then
        SIZE=$(stat -f%z "$cssfile" 2>/dev/null || stat -c%s "$cssfile" 2>/dev/null || echo 0)
        ORIGINAL_CSS_SIZE=$((ORIGINAL_CSS_SIZE + SIZE))
    fi
done

# Add CDN sizes (approximate - Tailwind ~3.5MB, FontAwesome ~1.5MB)
ORIGINAL_CSS_SIZE=$((ORIGINAL_CSS_SIZE + 3500000 + 1500000))

# Get original JS size (all source JS files)
JS_DIR="$PROJECT_ROOT/web/$SOURCE_JS"
for jsfile in "$JS_DIR"/*.js; do
    if [ -f "$jsfile" ]; then
        SIZE=$(stat -f%z "$jsfile" 2>/dev/null || stat -c%s "$jsfile" 2>/dev/null || echo 0)
        ORIGINAL_JS_SIZE=$((ORIGINAL_JS_SIZE + SIZE))
    fi
done

ORIGINAL_TOTAL=$((ORIGINAL_HTML_SIZE + ORIGINAL_CSS_SIZE + ORIGINAL_JS_SIZE))

# Calculate bundle sizes (HTML + CSS.br + JS.br)
BUNDLE_HTML_SIZE=0
BUNDLE_CSS_SIZE=0
BUNDLE_JS_SIZE=0

BUNDLE_TEMPLATES_DIR=$(get_bundle_templates_dir)
BUNDLE_CSS_DIR=$(get_bundle_css_dir)
BUNDLE_JS_DIR=$(get_bundle_js_dir)

# Get bundled HTML size (minified, no compression)
BUNDLE_HTML="$BUNDLE_TEMPLATES_DIR/index.html"
if [ -f "$BUNDLE_HTML" ]; then
    BUNDLE_HTML_SIZE=$(stat -f%z "$BUNDLE_HTML" 2>/dev/null || stat -c%s "$BUNDLE_HTML" 2>/dev/null || echo 0)
fi

# Get bundled CSS size (brotli compressed)
BUNDLE_CSS_BR="$BUNDLE_CSS_DIR/bundle.css.br"
if [ -f "$BUNDLE_CSS_BR" ]; then
    BUNDLE_CSS_SIZE=$(stat -f%z "$BUNDLE_CSS_BR" 2>/dev/null || stat -c%s "$BUNDLE_CSS_BR" 2>/dev/null || echo 0)
fi

# Get bundled JS size (brotli compressed)
BUNDLE_JS_BR="$BUNDLE_JS_DIR/bundle.js.br"
if [ -f "$BUNDLE_JS_BR" ]; then
    BUNDLE_JS_SIZE=$(stat -f%z "$BUNDLE_JS_BR" 2>/dev/null || stat -c%s "$BUNDLE_JS_BR" 2>/dev/null || echo 0)
fi

BUNDLE_TOTAL=$((BUNDLE_HTML_SIZE + BUNDLE_CSS_SIZE + BUNDLE_JS_SIZE))

# Calculate savings
SAVINGS=$((ORIGINAL_TOTAL - BUNDLE_TOTAL))
if [ $ORIGINAL_TOTAL -gt 0 ]; then
    PERCENT=$((SAVINGS * 100 / ORIGINAL_TOTAL))
else
    PERCENT=0
fi

# Format sizes
format_size() {
    local bytes=$1
    if [ $bytes -lt 1024 ]; then
        echo "${bytes}B"
    elif [ $bytes -lt 1048576 ]; then
        echo "$((bytes / 1024))K"
    else
        echo "$((bytes / 1048576))M"
    fi
}

BUNDLE_TOTAL_FMT=$(format_size $BUNDLE_TOTAL)
SAVINGS_FMT=$(format_size $SAVINGS)

# Display summary
echo ""
echo -e "${BOLD}${CYAN}Bundle Summary:${NC}"
echo -e "${CYAN}===============${NC}"
echo -e "${GREEN}Total Bundle Size:${NC} $BUNDLE_TOTAL_FMT ${GRAY}(-$PERCENT% -$SAVINGS_FMT)${NC}"
echo ""

log_success "Bundle summary complete"
