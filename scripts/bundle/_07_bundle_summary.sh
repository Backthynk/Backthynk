#!/bin/bash

# Bundle Component: Detailed Bundle Summary
# Displays per-file bundle statistics and compression ratios

source "$(dirname "$0")/../common/common.sh"
source "$(dirname "$0")/../common/load-config.sh"

log_step "Generating bundle summary..."

# Helper function to get file size in bytes
get_size() {
    local file=$1
    if [ -f "$file" ]; then
        stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0
    else
        echo 0
    fi
}

# Helper function to format bytes to human-readable
format_bytes() {
    local bytes=$1
    if [ $bytes -lt 1000 ]; then
        printf "%dB" $bytes
    elif [ $bytes -lt 1000000 ]; then
        printf "%.1fK" $(awk "BEGIN {printf \"%.1f\", $bytes/1024}")
    else
        printf "%.2fM" $(awk "BEGIN {printf \"%.2f\", $bytes/1048576}")
    fi
}

# Helper function to calculate percentage reduction
calc_reduction() {
    local original=$1
    local compressed=$2
    if [ $original -gt 0 ]; then
        awk "BEGIN {printf \"%.1f\", (($original - $compressed) * 100 / $original)}"
    else
        echo "0"
    fi
}

# Get bundle directories
BUNDLE_TEMPLATES_DIR=$(get_bundle_templates_dir)
BUNDLE_CSS_DIR=$(get_bundle_css_dir)
BUNDLE_JS_DIR=$(get_bundle_js_dir)

# Collect source file stats
CSS_DIR="$PROJECT_ROOT/web/$SOURCE_CSS"
JS_DIR="$PROJECT_ROOT/web/$SOURCE_JS"

# Count source files
CSS_SOURCE_COUNT=$(find "$CSS_DIR" -name "*.css" 2>/dev/null | wc -l)
JS_SOURCE_COUNT=$(find "$JS_DIR" -name "*.js" 2>/dev/null | wc -l)

# Get combined file sizes (before minification)
COMBINED_CSS_SIZE=$(get_size "$CACHE_DIR/combined.css")
COMBINED_JS_SIZE=$(get_size "$CACHE_DIR/combined.js")

# Get source HTML size (before minification)
SOURCE_HTML_SIZE=$(get_size "$PROJECT_ROOT/web/$SOURCE_TEMPLATES/index.html")

# Get bundle file sizes
BUNDLE_CSS_SIZE=$(get_size "$BUNDLE_CSS_DIR/bundle.css")
BUNDLE_CSS_GZ_SIZE=$(get_size "$BUNDLE_CSS_DIR/bundle.css.gz")
BUNDLE_CSS_BR_SIZE=$(get_size "$BUNDLE_CSS_DIR/bundle.css.br")

BUNDLE_JS_SIZE=$(get_size "$BUNDLE_JS_DIR/bundle.js")
BUNDLE_JS_GZ_SIZE=$(get_size "$BUNDLE_JS_DIR/bundle.js.gz")
BUNDLE_JS_BR_SIZE=$(get_size "$BUNDLE_JS_DIR/bundle.js.br")

BUNDLE_HTML_SIZE=$(get_size "$BUNDLE_TEMPLATES_DIR/index.html")
BUNDLE_HTML_GZ_SIZE=$(get_size "$BUNDLE_TEMPLATES_DIR/index.html.gz")
BUNDLE_HTML_BR_SIZE=$(get_size "$BUNDLE_TEMPLATES_DIR/index.html.br")

# Calculate totals
TOTAL_UNCOMPRESSED=$((BUNDLE_CSS_SIZE + BUNDLE_JS_SIZE + BUNDLE_HTML_SIZE))
TOTAL_GZIP=$((BUNDLE_CSS_GZ_SIZE + BUNDLE_JS_GZ_SIZE + BUNDLE_HTML_GZ_SIZE))
TOTAL_BROTLI=$((BUNDLE_CSS_BR_SIZE + BUNDLE_JS_BR_SIZE + BUNDLE_HTML_BR_SIZE))

# Display detailed summary
echo ""
echo -e "${BOLD}${CYAN}Bundle Summary${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# CSS Stats
echo -e "${BOLD}CSS Bundle:${NC}"
echo -e "  Source files:      ${CYAN}$CSS_SOURCE_COUNT files${NC} (+ Tailwind + Font Awesome)"
echo -e "  Combined size:     $(format_bytes $COMBINED_CSS_SIZE)"
echo -e "  Minified:          $(format_bytes $BUNDLE_CSS_SIZE) ${GRAY}(-$(calc_reduction $COMBINED_CSS_SIZE $BUNDLE_CSS_SIZE)%)${NC}"
echo -e "  Gzip:              $(format_bytes $BUNDLE_CSS_GZ_SIZE) ${GRAY}(-$(calc_reduction $BUNDLE_CSS_SIZE $BUNDLE_CSS_GZ_SIZE)%)${NC}"
echo -e "  Brotli:            $(format_bytes $BUNDLE_CSS_BR_SIZE) ${GRAY}(-$(calc_reduction $BUNDLE_CSS_SIZE $BUNDLE_CSS_BR_SIZE)%)${NC}"
echo ""

# JS Stats
echo -e "${BOLD}JavaScript Bundle:${NC}"
echo -e "  Source files:      ${CYAN}$JS_SOURCE_COUNT files${NC}"
echo -e "  Combined size:     $(format_bytes $COMBINED_JS_SIZE)"
echo -e "  Minified:          $(format_bytes $BUNDLE_JS_SIZE) ${GRAY}(-$(calc_reduction $COMBINED_JS_SIZE $BUNDLE_JS_SIZE)%)${NC}"
echo -e "  Gzip:              $(format_bytes $BUNDLE_JS_GZ_SIZE) ${GRAY}(-$(calc_reduction $BUNDLE_JS_SIZE $BUNDLE_JS_GZ_SIZE)%)${NC}"
echo -e "  Brotli:            $(format_bytes $BUNDLE_JS_BR_SIZE) ${GRAY}(-$(calc_reduction $BUNDLE_JS_SIZE $BUNDLE_JS_BR_SIZE)%)${NC}"
echo ""

# HTML Stats
echo -e "${BOLD}HTML Template:${NC}"
echo -e "  Source size:       $(format_bytes $SOURCE_HTML_SIZE)"
echo -e "  Minified:          $(format_bytes $BUNDLE_HTML_SIZE) ${GRAY}(-$(calc_reduction $SOURCE_HTML_SIZE $BUNDLE_HTML_SIZE)%)${NC}"
echo -e "  Gzip:              $(format_bytes $BUNDLE_HTML_GZ_SIZE) ${GRAY}(-$(calc_reduction $BUNDLE_HTML_SIZE $BUNDLE_HTML_GZ_SIZE)%)${NC}"
echo -e "  Brotli:            $(format_bytes $BUNDLE_HTML_BR_SIZE) ${GRAY}(-$(calc_reduction $BUNDLE_HTML_SIZE $BUNDLE_HTML_BR_SIZE)%)${NC}"
echo ""

# Total Bundle Sizes
echo -e "${BOLD}Total Bundle Size (what users download):${NC}"
echo -e "  Uncompressed:      ${BOLD}$(format_bytes $TOTAL_UNCOMPRESSED)${NC}"
echo -e "  With Gzip:         ${BOLD}${GREEN}$(format_bytes $TOTAL_GZIP)${NC} ${GRAY}(-$(calc_reduction $TOTAL_UNCOMPRESSED $TOTAL_GZIP)%)${NC}"
echo -e "  With Brotli:       ${BOLD}${GREEN}$(format_bytes $TOTAL_BROTLI)${NC} ${GRAY}(-$(calc_reduction $TOTAL_UNCOMPRESSED $TOTAL_BROTLI)%)${NC}"
echo ""

echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"

log_success "Bundle summary complete"
