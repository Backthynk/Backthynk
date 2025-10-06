#!/bin/bash

# Build Component: Bundle Size Reporting
# This script calculates and reports total bundle sizes including CDN resources

source "$(dirname "$0")/../common/common.sh"
source "$(dirname "$0")/../common/load-config.sh"

# Import CDN caching functions (but don't run the caching process)
CACHE_DIR="$SCRIPT_DIR/.cache/cdn"

# Function to get cached file size
get_cached_size() {
    local name="$1"
    local size_file="$CACHE_DIR/${name}.size"

    if [ -f "$size_file" ]; then
        cat "$size_file"
    else
        echo "0"
    fi
}

log_step "Calculating bundle size..."

# Get configuration paths from shared config
BUNDLE_OUTPUT="$COMPRESSED_JS_DIR/bundle.js"
CSS_COMPRESSED_DIR="$COMPRESSED_CSS_DIR"
TEMPLATES_COMPRESSED_DIR="$COMPRESSED_TEMPLATES_DIR"
TEMPLATES_DIR="$SOURCE_TEMPLATES"
CSS_DIR="$SOURCE_CSS"
STATIC_ROOT="$SOURCE_STATIC"

# Show bundle size report
echo ""
echo -e "${BOLD}${CYAN}Bundle Size Analysis:${NC}"
echo -e "${CYAN}=====================================================${NC}"

TOTAL_SIZE=0
TOTAL_SAVINGS=0

# Local JavaScript bundle (gzipped if available, otherwise regular)
if [ -f "${BUNDLE_OUTPUT}.gz" ]; then
    JS_GZ_SIZE=$(du -sb "${BUNDLE_OUTPUT}.gz" | awk '{print $1}')
    # Compare with the uncompressed bundle file, not original source files
    if [ -f "$BUNDLE_OUTPUT" ]; then
        JS_ORIG_SIZE=$(du -sb "$BUNDLE_OUTPUT" | awk '{print $1}')
        SAVINGS=$((JS_ORIG_SIZE - JS_GZ_SIZE))
        PERCENT=$((SAVINGS * 100 / JS_ORIG_SIZE))
        printf "${GREEN}JavaScript (gzipped):${NC}    %8s ${GRAY}(-%d%%, saved %s)${NC}\n" "$(numfmt --to=iec-i --suffix=B "$JS_GZ_SIZE")" "$PERCENT" "$(numfmt --to=iec-i --suffix=B "$SAVINGS")"
        TOTAL_SAVINGS=$((TOTAL_SAVINGS + SAVINGS))
    else
        printf "${GREEN}JavaScript (gzipped):${NC}    %8s\n" "$(numfmt --to=iec-i --suffix=B "$JS_GZ_SIZE")"
    fi
    TOTAL_SIZE=$((TOTAL_SIZE + JS_GZ_SIZE))
elif [ -f "$BUNDLE_OUTPUT" ]; then
    JS_SIZE=$(du -sb "$BUNDLE_OUTPUT" | awk '{print $1}')
    # For bundled JS, compare with original source files
    JS_ORIG=$(find "$(dirname "$BUNDLE_OUTPUT")/.." -name "*.js" ! -path "*/compressed/*" -exec du -sb {} + 2>/dev/null | awk '{sum+=$1} END {print sum}' || echo 0)
    if [ -n "$JS_ORIG" ] && [ "$JS_ORIG" -gt 0 ] 2>/dev/null; then
        SAVINGS=$((JS_ORIG - JS_SIZE))
        PERCENT=$((SAVINGS * 100 / JS_ORIG))
        printf "${GREEN}JavaScript (bundled):${NC}    %8s ${GRAY}(-%d%%, saved %s)${NC}\n" "$(numfmt --to=iec-i --suffix=B "$JS_SIZE")" "$PERCENT" "$(numfmt --to=iec-i --suffix=B "$SAVINGS")"
        TOTAL_SAVINGS=$((TOTAL_SAVINGS + SAVINGS))
    else
        printf "${GREEN}JavaScript (bundled):${NC}    %8s\n" "$(numfmt --to=iec-i --suffix=B "$JS_SIZE")"
    fi
    TOTAL_SIZE=$((TOTAL_SIZE + JS_SIZE))
fi

# CSS size calculation (gzipped if available)
if [ -d "$CSS_COMPRESSED_DIR" ]; then
    CSS_GZ_TOTAL=0
    CSS_TOTAL=0

    # Calculate gzipped CSS total
    for cssfile in "$CSS_COMPRESSED_DIR"/*.css.gz; do
        if [ -f "$cssfile" ]; then
            CSS_GZ_SIZE=$(du -sb "$cssfile" | awk '{print $1}')
            CSS_GZ_TOTAL=$((CSS_GZ_TOTAL + CSS_GZ_SIZE))
        fi
    done

    # Calculate regular CSS total (for files without .gz)
    for cssfile in "$CSS_COMPRESSED_DIR"/*.css; do
        if [ -f "$cssfile" ] && [[ "$cssfile" != *.gz ]]; then
            CSS_SIZE=$(du -sb "$cssfile" | awk '{print $1}')
            CSS_TOTAL=$((CSS_TOTAL + CSS_SIZE))
        fi
    done

    if [ $CSS_GZ_TOTAL -gt 0 ]; then
        # Compare with the uncompressed CSS files in the same directory
        CSS_ORIG_TOTAL=0
        for cssfile in "$CSS_COMPRESSED_DIR"/*.css; do
            if [ -f "$cssfile" ] && [[ "$cssfile" != *.gz ]]; then
                CSS_SIZE=$(du -sb "$cssfile" | awk '{print $1}')
                CSS_ORIG_TOTAL=$((CSS_ORIG_TOTAL + CSS_SIZE))
            fi
        done

        if [ $CSS_ORIG_TOTAL -gt 0 ]; then
            SAVINGS=$((CSS_ORIG_TOTAL - CSS_GZ_TOTAL))
            PERCENT=$((SAVINGS * 100 / CSS_ORIG_TOTAL))
            printf "${GREEN}CSS (gzipped):${NC}           %8s ${GRAY}(-%d%%, saved %s)${NC}\n" "$(numfmt --to=iec-i --suffix=B $CSS_GZ_TOTAL)" "$PERCENT" "$(numfmt --to=iec-i --suffix=B $SAVINGS)"
            TOTAL_SAVINGS=$((TOTAL_SAVINGS + SAVINGS))
        else
            printf "${GREEN}CSS (gzipped):${NC}           %8s\n" "$(numfmt --to=iec-i --suffix=B $CSS_GZ_TOTAL)"
        fi
        TOTAL_SIZE=$((TOTAL_SIZE + CSS_GZ_TOTAL))
    elif [ $CSS_TOTAL -gt 0 ]; then
        printf "${GREEN}CSS (minified):${NC}          %8s\n" "$(numfmt --to=iec-i --suffix=B $CSS_TOTAL)"
        TOTAL_SIZE=$((TOTAL_SIZE + CSS_TOTAL))
    fi
elif [ -d "$CSS_DIR" ]; then
    CSS_SIZE=$(find "$CSS_DIR" -name "*.css" -exec du -sb {} + 2>/dev/null | awk '{sum+=$1} END {print sum}' || echo 0)
    if [ $CSS_SIZE -gt 0 ]; then
        printf "${GREEN}CSS:${NC}                     %8s\n" "$(numfmt --to=iec-i --suffix=B $CSS_SIZE)"
        TOTAL_SIZE=$((TOTAL_SIZE + CSS_SIZE))
    fi
fi

# Images size (if any)
if [ -d "$STATIC_ROOT/images" ]; then
    IMG_SIZE=$(du -sb "$STATIC_ROOT/images" | awk '{print $1}')
    printf "${GREEN}Images:${NC}                  %8s\n" "$(numfmt --to=iec-i --suffix=B $IMG_SIZE)"
    TOTAL_SIZE=$((TOTAL_SIZE + IMG_SIZE))
fi

# HTML size calculation
if [ -d "$TEMPLATES_COMPRESSED_DIR" ]; then
    HTML_SIZE=$(find "$TEMPLATES_COMPRESSED_DIR" -name "*.html" -exec cat {} \; 2>/dev/null | wc -c || echo 0)
    HTML_ORIG=$(find "$TEMPLATES_DIR" -name "*.html" ! -path "*/compressed/*" -exec cat {} \; 2>/dev/null | wc -c || echo 0)
    if [ -n "$HTML_ORIG" ] && [ "$HTML_ORIG" -gt 0 ] && [ -n "$HTML_SIZE" ] && [ "$HTML_SIZE" -gt 0 ] 2>/dev/null; then
        SAVINGS=$((HTML_ORIG - HTML_SIZE))
        PERCENT=$((SAVINGS * 100 / HTML_ORIG))
        printf "${GREEN}HTML (minified, uncompressed):${NC} %8s ${GRAY}(-%d%%, saved %s)${NC}\n" "$(numfmt --to=iec-i --suffix=B $HTML_SIZE)" "$PERCENT" "$(numfmt --to=iec-i --suffix=B $SAVINGS)"
        TOTAL_SAVINGS=$((TOTAL_SAVINGS + SAVINGS))
    else
        printf "${GREEN}HTML (minified, uncompressed):${NC} %8s\n" "$(numfmt --to=iec-i --suffix=B $HTML_SIZE)"
    fi
    TOTAL_SIZE=$((TOTAL_SIZE + HTML_SIZE))
elif [ -d "$TEMPLATES_DIR" ]; then
    HTML_SIZE=$(find "$TEMPLATES_DIR" -name "*.html" -exec cat {} \; 2>/dev/null | wc -c || echo 0)
    if [ -n "$HTML_SIZE" ] && [ "$HTML_SIZE" -gt 0 ] 2>/dev/null; then
        printf "${GREEN}HTML Templates:${NC}          %8s\n" "$(numfmt --to=iec-i --suffix=B $HTML_SIZE)"
        TOTAL_SIZE=$((TOTAL_SIZE + HTML_SIZE))
    fi
fi

printf "${CYAN}─────────────────────────────────────────────────────${NC}\n"

if [ $TOTAL_SAVINGS -gt 0 ]; then
    TOTAL_ORIG=$((TOTAL_SIZE + TOTAL_SAVINGS))
    PERCENT=$((TOTAL_SAVINGS * 100 / TOTAL_ORIG))
    printf "${BOLD}${GREEN}Total Bundle Size:${NC}       %8s ${GRAY}(-%d%%, saved %s)${NC}\n" "$(numfmt --to=iec-i --suffix=B $TOTAL_SIZE)" "$PERCENT" "$(numfmt --to=iec-i --suffix=B $TOTAL_SAVINGS)"
else
    printf "${BOLD}${GREEN}Total Bundle Size:${NC}       %8s\n" "$(numfmt --to=iec-i --suffix=B $TOTAL_SIZE)"
fi

log_success "Bundle size analysis complete"