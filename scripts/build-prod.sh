#!/bin/bash

# Production Build Script for Backthynk
# This script minifies all client assets and builds an optimized Go binary

set -e  # Exit on error

# Load common utilities
source "$(dirname "$0")/common.sh"

# Check dependencies and load configuration
check_dependencies curl go sed awk tr find mkdir numfmt du cat gzip
load_config

echo -e "${BOLD}${CYAN}Building production-optimized Backthynk server...${NC}"

# Start build timer
BUILD_START=$(date +%s)

# Create compressed directories
log_step "Creating compressed asset directories..."
mkdir -p web/static/js/compressed
mkdir -p web/static/css/compressed
mkdir -p web/templates/compressed

# Function to check available minification tools and select the best one
select_minifier() {
    local input_file="$1"
    local output_file="$2"
    local file_type="$3"

    if [ "$file_type" = "js" ]; then
        # Try terser first (best compression)
        if command -v terser >/dev/null 2>&1; then
            log_substep "Using terser for maximum compression..."
            terser "$input_file" --compress --mangle --toplevel --output "$output_file" 2>/dev/null && return 0
        fi

        # Try esbuild second (good compression, fast)
        if command -v esbuild >/dev/null 2>&1; then
            log_substep "Using esbuild for compression..."
            esbuild "$input_file" --minify --outfile="$output_file" 2>/dev/null && return 0
        fi

        # Fall back to curl API (moderate compression)
        log_substep "Using Toptal API for compression..."
        if curl -X POST -s --data-urlencode "input@$input_file" https://www.toptal.com/developers/javascript-minifier/api/raw -o "$output_file" 2>/dev/null; then
            [ -s "$output_file" ] && return 0
        fi

        # No minification available
        log_warning "No JS minification tools available, copying original file"
        cp "$input_file" "$output_file"
        return 1
    elif [ "$file_type" = "css" ]; then
        # Try terser first (if it supports CSS)
        if command -v terser >/dev/null 2>&1; then
            log_substep "Attempting CSS minification with terser..."
            terser "$input_file" --compress --output "$output_file" 2>/dev/null && return 0
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

# Bundle and minify JavaScript files
log_step "Bundling and minifying JavaScript files..."

# Dynamically discover JS files, with priority order for dependencies
JS_DIR="web/static/js"

# Define priority files (dependencies first, main.js last)
PRIORITY_FILES=("constants.js" "router.js" "state.js" "utils.js" "alertSystem.js" "api.js")
LAST_FILES=("main.js")

# Get all JS files and create ordered list
JS_FILES=()

# Add priority files first
for priority_file in "${PRIORITY_FILES[@]}"; do
	if [ -f "$JS_DIR/$priority_file" ]; then
		JS_FILES+=("$JS_DIR/$priority_file")
	fi
done

# Add remaining files (excluding priority and last files)
for jsfile in "$JS_DIR"/*.js; do
	if [ -f "$jsfile" ]; then
		filename=$(basename "$jsfile")
		# Skip if it's a priority file or last file
		if [[ ! " ${PRIORITY_FILES[@]} " =~ " ${filename} " ]] && [[ ! " ${LAST_FILES[@]} " =~ " ${filename} " ]]; then
			JS_FILES+=("$jsfile")
		fi
	fi
done

# Add last files at the end
for last_file in "${LAST_FILES[@]}"; do
	if [ -f "$JS_DIR/$last_file" ]; then
		JS_FILES+=("$JS_DIR/$last_file")
	fi
done

log_substep "Bundling JavaScript files in correct order..."
BUNDLE_FILE="web/static/js/compressed/bundle.js"

# Create empty bundle file
> "$BUNDLE_FILE"

# Concatenate all JS files in order
for jsfile in "${JS_FILES[@]}"; do
	if [ -f "$jsfile" ]; then
		log_substep "  Adding $(basename $jsfile)..."
		echo "/* === $(basename $jsfile) === */" >> "$BUNDLE_FILE"
		cat "$jsfile" >> "$BUNDLE_FILE"
		echo "" >> "$BUNDLE_FILE"
		# Ensure each file ends with a semicolon to prevent syntax errors
		echo ";" >> "$BUNDLE_FILE"
		echo "" >> "$BUNDLE_FILE"  # Add newline between files
	else
		log_warning "$jsfile not found, skipping..."
	fi
done

log_substep "Cleaning and minifying bundled JavaScript..."
# First, clean up the bundle (remove file markers and clean up semicolons)
sed 's|/\* === .* === \*/||g' "$BUNDLE_FILE" | \
sed 's|;;*|;|g' | \
sed 's/^[[:space:]]\+//g' | \
sed 's/[[:space:]]\+$//g' > "${BUNDLE_FILE}.tmp"

mv "${BUNDLE_FILE}.tmp" "$BUNDLE_FILE"

# Apply progressive minification
ORIGINAL_SIZE=$(du -sb "$BUNDLE_FILE" | awk '{print $1}')
TEMP_MINIFIED="${BUNDLE_FILE}.min"

if select_minifier "$BUNDLE_FILE" "$TEMP_MINIFIED" "js"; then
	MINIFIED_SIZE=$(du -sb "$TEMP_MINIFIED" | awk '{print $1}')
	if [ -s "$TEMP_MINIFIED" ] && [ "$MINIFIED_SIZE" -gt 0 ]; then
		mv "$TEMP_MINIFIED" "$BUNDLE_FILE"
		SAVINGS=$((ORIGINAL_SIZE - MINIFIED_SIZE))
		PERCENT=$((SAVINGS * 100 / ORIGINAL_SIZE))
		log_success "Created minified bundle: $(basename $BUNDLE_FILE) ($(du -h $BUNDLE_FILE | cut -f1), -$PERCENT% reduction)"
	else
		log_warning "Minification produced empty file, using cleaned bundle"
		rm -f "$TEMP_MINIFIED"
	fi
else
	rm -f "$TEMP_MINIFIED"
fi

# Compress JavaScript bundle with gzip
log_substep "Compressing JavaScript bundle with gzip..."
gzip -9 -f -k "$BUNDLE_FILE"  # -f force overwrite, -k keeps original file
GZIP_SIZE=$(du -sb "${BUNDLE_FILE}.gz" | awk '{print $1}')
GZIP_SAVINGS=$((ORIGINAL_SIZE - GZIP_SIZE))
GZIP_PERCENT=$((GZIP_SAVINGS * 100 / ORIGINAL_SIZE))
log_success "Created gzipped bundle: $(basename ${BUNDLE_FILE}.gz) ($(du -h ${BUNDLE_FILE}.gz | cut -f1), -$GZIP_PERCENT% from original)"

# Minify CSS files
log_step "Minifying CSS files..."
if [ -d web/static/css ] && [ -n "$(find web/static/css -name "*.css" 2>/dev/null)" ]; then
	for cssfile in web/static/css/*.css; do
		if [ -f "$cssfile" ] && [ "$(basename $cssfile)" != "compressed" ]; then
			log_substep "Minifying $(basename $cssfile)..."
			output_file="web/static/css/compressed/$(basename $cssfile)"

			# Apply CSS minification
			ORIGINAL_CSS_SIZE=$(du -sb "$cssfile" | awk '{print $1}')
			select_minifier "$cssfile" "$output_file" "css"
			MINIFIED_CSS_SIZE=$(du -sb "$output_file" | awk '{print $1}')

			# Compress CSS with gzip
			gzip -9 -f -k "$output_file"
			GZIP_CSS_SIZE=$(du -sb "${output_file}.gz" | awk '{print $1}')
			CSS_SAVINGS=$((ORIGINAL_CSS_SIZE - GZIP_CSS_SIZE))
			CSS_PERCENT=$((CSS_SAVINGS * 100 / ORIGINAL_CSS_SIZE))
			log_success "Created compressed CSS: $(basename ${output_file}.gz) ($(du -h ${output_file}.gz | cut -f1), -$CSS_PERCENT% from original)"
		fi
	done
else
	log_info "No CSS files found to minify"
fi

# Minify HTML templates and replace JS includes with bundle
log_step "Minifying HTML templates..."
for htmlfile in web/templates/*.html; do
	if [ -f "$htmlfile" ] && [ "$(basename $htmlfile)" != "compressed" ]; then
		log_substep "Minifying $(basename $htmlfile) and replacing JS includes with bundle..."

		# Replace all individual JS script tags with single bundle and CSS with minified version
		sed 's/<!--.*-->//g' "$htmlfile" | \
		sed 's/>[[:space:]]\+</></g' | \
		sed 's/^[[:space:]]\+//g' | \
		sed '/^[[:space:]]*$/d' | \
		sed 's/[[:space:]]\+/ /g' | \
		sed '/<script src="\/static\/js\/constants\.js"><\/script>/,/<script src="\/static\/js\/main\.js"><\/script>/{
			/<script src="\/static\/js\/constants\.js"><\/script>/c\
<script src="/static/js/compressed/bundle.js"></script>
			/<script src="\/static\/js\/.*\.js"><\/script>/d
		}' | \
		sed 's|/static/css/\([^"]*\)\.css|/static/css/compressed/\1.css|g' > "web/templates/compressed/$(basename $htmlfile)"
	fi
done

# Build optimized Go binary
log_step "Building optimized Go binary..."
log_substep "Cleaning Go build cache..."
#go clean -cache
log_substep "Building with CGO enabled for SQLite..."
CGO_ENABLED=1 go build -o backthynk ./cmd/server/

# Calculate build time
BUILD_END=$(date +%s)
BUILD_TIME=$((BUILD_END - BUILD_START))

log_success "Production build complete: ./backthynk"
log_success "Compressed assets available in compressed/ directories"

# Calculate total bundle size including 3rd party CDN resources
log_step "Calculating total bundle size including 3rd party resources..."

# Function to get remote file size
get_remote_size() {
    local url="$1"

    # For Tailwind CDN, follow redirects to get the actual file
    if [[ "$url" == *"cdn.tailwindcss.com"* ]] && [[ "$url" != *".js" ]]; then
        # Get the actual redirected URL first
        local actual_url=$(curl -sI "$url" 2>/dev/null | grep -i "location:" | awk '{print $2}' | tr -d '\r\n')
        if [ -n "$actual_url" ]; then
            url="$actual_url"
        fi
    fi

    # Try HEAD request first
    local size=$(curl -sI "$url" 2>/dev/null | grep -i content-length | awk '{print $2}' | tr -d '\r\n')
    if [ -n "$size" ] && [ "$size" -gt 0 ] 2>/dev/null; then
        echo "$size"
        return
    fi

    # Fallback: download and measure (with timeout)
    local temp_file=$(mktemp)
    if timeout 15 curl -sL "$url" -o "$temp_file" 2>/dev/null && [ -s "$temp_file" ]; then
        du -sb "$temp_file" | awk '{print $1}'
        rm -f "$temp_file"
    else
        rm -f "$temp_file"
        echo "0"
    fi
}

# Get 3rd party resource sizes
log_substep "Fetching 3rd party resource sizes..."
TAILWIND_SIZE=$(get_remote_size "https://cdn.tailwindcss.com/3.4.17")
FONTAWESOME_SIZE=$(get_remote_size "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css")

# Debug output for troubleshooting
log_substep "Tailwind size: $TAILWIND_SIZE bytes, FontAwesome size: $FONTAWESOME_SIZE bytes"

# Show bundle size report
echo ""
echo -e "${BOLD}${CYAN}Complete Bundle Size Analysis (including 3rd party):${NC}"
echo -e "${CYAN}=====================================================${NC}"

TOTAL_SIZE=0

# 3rd party resources
if [ "$TAILWIND_SIZE" -gt 0 ] 2>/dev/null; then
    printf "${YELLOW}Tailwind CSS (CDN):${NC}      %8s ${GRAY}(external)${NC}\n" "$(numfmt --to=iec $TAILWIND_SIZE)"
    TOTAL_SIZE=$((TOTAL_SIZE + TAILWIND_SIZE))
else
    printf "${YELLOW}Tailwind CSS (CDN):${NC}      %8s ${GRAY}(external)${NC}\n" "0"
fi

if [ "$FONTAWESOME_SIZE" -gt 0 ] 2>/dev/null; then
    printf "${YELLOW}Font Awesome (CDN):${NC}      %8s ${GRAY}(external)${NC}\n" "$(numfmt --to=iec $FONTAWESOME_SIZE)"
    TOTAL_SIZE=$((TOTAL_SIZE + FONTAWESOME_SIZE))
else
    printf "${YELLOW}Font Awesome (CDN):${NC}      %8s ${GRAY}(external)${NC}\n" "0"
fi

# Local JavaScript bundle (gzipped)
if [ -f web/static/js/compressed/bundle.js.gz ]; then
    JS_GZ_SIZE=$(du -sb web/static/js/compressed/bundle.js.gz | awk '{print $1}')
    JS_ORIG=$(du -sb web/static/js --exclude=compressed | awk '{print $1}')
    SAVINGS=$((JS_ORIG - JS_GZ_SIZE))
    PERCENT=$((SAVINGS * 100 / JS_ORIG))
    printf "${GREEN}JavaScript (gzipped):${NC}    %8s ${GRAY}(-%d%%, saved %s)${NC}\n" "$(numfmt --to=iec $JS_GZ_SIZE)" "$PERCENT" "$(numfmt --to=iec $SAVINGS)"
    TOTAL_SIZE=$((TOTAL_SIZE + JS_GZ_SIZE))
else
    # Fallback to regular bundle
    if [ -f web/static/js/compressed/bundle.js ]; then
        JS_SIZE=$(du -sb web/static/js/compressed/bundle.js | awk '{print $1}')
        JS_ORIG=$(du -sb web/static/js --exclude=compressed | awk '{print $1}')
        SAVINGS=$((JS_ORIG - JS_SIZE))
        PERCENT=$((SAVINGS * 100 / JS_ORIG))
        printf "${GREEN}JavaScript (bundled):${NC}    %8s ${GRAY}(-%d%%, saved %s)${NC}\n" "$(numfmt --to=iec $JS_SIZE)" "$PERCENT" "$(numfmt --to=iec $SAVINGS)"
        TOTAL_SIZE=$((TOTAL_SIZE + JS_SIZE))
    fi
fi

# CSS size calculation (gzipped if available)
if [ -d web/static/css/compressed ]; then
    CSS_GZ_TOTAL=0
    CSS_TOTAL=0
    for cssfile in web/static/css/compressed/*.css.gz; do
        if [ -f "$cssfile" ]; then
            CSS_GZ_SIZE=$(du -sb "$cssfile" | awk '{print $1}')
            CSS_GZ_TOTAL=$((CSS_GZ_TOTAL + CSS_GZ_SIZE))
        fi
    done
    for cssfile in web/static/css/compressed/*.css; do
        if [ -f "$cssfile" ] && [[ "$cssfile" != *.gz ]]; then
            CSS_SIZE=$(du -sb "$cssfile" | awk '{print $1}')
            CSS_TOTAL=$((CSS_TOTAL + CSS_SIZE))
        fi
    done

    if [ $CSS_GZ_TOTAL -gt 0 ]; then
        CSS_ORIG=$(du -sb web/static/css --exclude=compressed | awk '{print $1}')
        if [ $CSS_ORIG -gt 0 ]; then
            SAVINGS=$((CSS_ORIG - CSS_GZ_TOTAL))
            PERCENT=$((SAVINGS * 100 / CSS_ORIG))
            printf "${GREEN}CSS (gzipped):${NC}           %8s ${GRAY}(-%d%%, saved %s)${NC}\n" "$(numfmt --to=iec $CSS_GZ_TOTAL)" "$PERCENT" "$(numfmt --to=iec $SAVINGS)"
        else
            printf "${GREEN}CSS (gzipped):${NC}           %8s\n" "$(numfmt --to=iec $CSS_GZ_TOTAL)"
        fi
        TOTAL_SIZE=$((TOTAL_SIZE + CSS_GZ_TOTAL))
    elif [ $CSS_TOTAL -gt 0 ]; then
        printf "${GREEN}CSS (minified):${NC}          %8s\n" "$(numfmt --to=iec $CSS_TOTAL)"
        TOTAL_SIZE=$((TOTAL_SIZE + CSS_TOTAL))
    fi
elif [ -d web/static/css ]; then
    CSS_SIZE=$(du -sb web/static/css | awk '{print $1}')
    printf "${GREEN}CSS:${NC}                     %8s\n" "$(numfmt --to=iec $CSS_SIZE)"
    TOTAL_SIZE=$((TOTAL_SIZE + CSS_SIZE))
fi

# Images size (if any)
if [ -d web/static/images ]; then
    IMG_SIZE=$(du -sb web/static/images | awk '{print $1}')
    printf "${GREEN}Images:${NC}                  %8s\n" "$(numfmt --to=iec $IMG_SIZE)"
    TOTAL_SIZE=$((TOTAL_SIZE + IMG_SIZE))
fi

# HTML size calculation
if [ -d web/templates/compressed ]; then
    HTML_SIZE=$(find web/templates/compressed -name "*.html" -exec cat {} \; | wc -c 2>/dev/null || echo 0)
    HTML_ORIG=$(find web/templates -name "*.html" ! -path "*/compressed/*" -exec cat {} \; | wc -c 2>/dev/null || echo 0)
    if [ $HTML_ORIG -gt 0 ] && [ $HTML_SIZE -gt 0 ]; then
        SAVINGS=$((HTML_ORIG - HTML_SIZE))
        PERCENT=$((SAVINGS * 100 / HTML_ORIG))
        printf "${GREEN}HTML (minified):${NC}         %8s ${GRAY}(-%d%%, saved %s)${NC}\n" "$(numfmt --to=iec $HTML_SIZE)" "$PERCENT" "$(numfmt --to=iec $SAVINGS)"
    else
        printf "${GREEN}HTML (minified):${NC}         %8s\n" "$(numfmt --to=iec $HTML_SIZE)"
    fi
    TOTAL_SIZE=$((TOTAL_SIZE + HTML_SIZE))
else
    HTML_SIZE=$(find web/templates -name "*.html" -exec cat {} \; | wc -c 2>/dev/null || echo 0)
    if [ $HTML_SIZE -gt 0 ]; then
        printf "${GREEN}HTML Templates:${NC}          %8s\n" "$(numfmt --to=iec $HTML_SIZE)"
        TOTAL_SIZE=$((TOTAL_SIZE + HTML_SIZE))
    fi
fi

printf "${CYAN}─────────────────────────────────────────────────────${NC}\n"
printf "${BOLD}${GREEN}Total Bundle Size:${NC}       %8s\n" "$(numfmt --to=iec $TOTAL_SIZE)"

# Show build time
echo ""
echo -e "${BOLD}${CYAN}Build Performance:${NC}"
echo -e "${CYAN}==================${NC}"
printf "${GREEN}Total build time:${NC}        %02d:%02d\n" $((BUILD_TIME / 60)) $((BUILD_TIME % 60))

echo ""
echo -e "${BOLD}${GREEN}✓ Production build completed successfully!${NC}"
echo -e "${GRAY}  • Minified and bundled JavaScript with progressive optimization${NC}"
echo -e "${GRAY}  • Compressed CSS with gzip${NC}"
echo -e "${GRAY}  • Gzipped assets for maximum compression${NC}"
echo -e "${GRAY}  • Updated backend to serve compressed assets${NC}"
echo -e "${GRAY}  • Total bundle including CDN resources: $(numfmt --to=iec $TOTAL_SIZE)${NC}"