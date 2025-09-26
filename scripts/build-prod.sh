#!/bin/bash

# Production Build Script for Backthynk
# This script minifies all client assets and builds an optimized Go binary

set -e  # Exit on error

# Load common utilities
source "$(dirname "$0")/common.sh"

# Check dependencies and load configuration
check_dependencies curl go sed awk tr find mkdir numfmt du cat
load_config

echo -e "${BOLD}${CYAN}Building production-optimized Backthynk server...${NC}"

# Create compressed directories
log_step "Creating compressed asset directories..."
mkdir -p web/static/js/compressed
mkdir -p web/static/css/compressed
mkdir -p web/templates/compressed

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

log_substep "Creating bundled JavaScript..."
# First, clean up the bundle (remove file markers and clean up semicolons)
sed 's|/\* === .* === \*/||g' "$BUNDLE_FILE" | \
sed 's|;;*|;|g' | \
sed 's/^[[:space:]]\+//g' | \
sed 's/[[:space:]]\+$//g' > "${BUNDLE_FILE}.tmp"

mv "${BUNDLE_FILE}.tmp" "$BUNDLE_FILE"

log_substep "Minifying JavaScript using Toptal API..."
# Use curl to minify the JavaScript bundle via Toptal API
ORIGINAL_SIZE=$(du -sb "$BUNDLE_FILE" | awk '{print $1}')
if curl -X POST -s --data-urlencode "input@$BUNDLE_FILE" https://www.toptal.com/developers/javascript-minifier/api/raw -o "${BUNDLE_FILE}.min"; then
	MINIFIED_SIZE=$(du -sb "${BUNDLE_FILE}.min" | awk '{print $1}')
	if [ -s "${BUNDLE_FILE}.min" ] && [ "$MINIFIED_SIZE" -gt 0 ]; then
		mv "${BUNDLE_FILE}.min" "$BUNDLE_FILE"
		SAVINGS=$((ORIGINAL_SIZE - MINIFIED_SIZE))
		PERCENT=$((SAVINGS * 100 / ORIGINAL_SIZE))
		log_success "Created minified bundle: $(basename $BUNDLE_FILE) ($(du -h $BUNDLE_FILE | cut -f1), -$PERCENT% reduction)"
	else
		log_warning "Minification failed or produced empty file, using cleaned bundle"
		rm -f "${BUNDLE_FILE}.min"
	fi
else
	log_warning "Minification API call failed, using cleaned bundle"
	rm -f "${BUNDLE_FILE}.min"
fi

# Minify CSS files
log_step "Minifying CSS files..."
if [ -d web/static/css ] && [ -n "$(find web/static/css -name "*.css" 2>/dev/null)" ]; then
	for cssfile in web/static/css/*.css; do
		if [ -f "$cssfile" ] && [ "$(basename $cssfile)" != "compressed" ]; then
			log_substep "Minifying $(basename $cssfile)..."
			sed 's|/\*.*\*/||g' "$cssfile" | \
			sed '/^[[:space:]]*$/d' | \
			tr -d '\n' | \
			sed 's/[[:space:]]\+/ /g' | \
			sed 's/; /;/g' | \
			sed 's/, /,/g' | \
			sed 's/{ /{/g' | \
			sed 's/ }/}/g' | \
			sed 's/: /:/g' > "web/static/css/compressed/$(basename $cssfile)"
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

log_success "Production build complete: ./backthynk"
log_success "Compressed assets available in compressed/ directories"

# Show bundle size report
echo ""
echo -e "${BOLD}${CYAN}Client Bundle Size (Download Size):${NC}"
echo -e "${CYAN}====================================${NC}"

CLIENT_SIZE=0

# JavaScript bundle size calculation
if [ -f web/static/js/compressed/bundle.js ]; then
	JS_SIZE=$(du -sb web/static/js/compressed/bundle.js | awk '{print $1}')
	JS_ORIG=$(du -sb web/static/js --exclude=compressed | awk '{print $1}')
	SAVINGS=$((JS_ORIG - JS_SIZE))
	PERCENT=$((SAVINGS * 100 / JS_ORIG))
	printf "${GREEN}JavaScript (bundled):${NC}    %8s ${GRAY}(-%d%%, saved %s)${NC}\n" "$(numfmt --to=iec $JS_SIZE)" "$PERCENT" "$(numfmt --to=iec $SAVINGS)"
	CLIENT_SIZE=$((CLIENT_SIZE + JS_SIZE))
else
	JS_SIZE=$(du -sb web/static/js | awk '{print $1}')
	printf "${GREEN}JavaScript:${NC}              %8s\n" "$(numfmt --to=iec $JS_SIZE)"
	CLIENT_SIZE=$((CLIENT_SIZE + JS_SIZE))
fi

# CSS size calculation
if [ -d web/static/css/compressed ]; then
	CSS_SIZE=$(du -sb web/static/css/compressed | awk '{print $1}')
	CSS_ORIG=$(du -sb web/static/css --exclude=compressed | awk '{print $1}')
	if [ $CSS_ORIG -gt 0 ]; then
		SAVINGS=$((CSS_ORIG - CSS_SIZE))
		PERCENT=$((SAVINGS * 100 / CSS_ORIG))
		printf "${GREEN}CSS (minified):${NC}          %8s ${GRAY}(-%d%%, saved %s)${NC}\n" "$(numfmt --to=iec $CSS_SIZE)" "$PERCENT" "$(numfmt --to=iec $SAVINGS)"
	else
		printf "${GREEN}CSS (minified):${NC}          %8s\n" "$(numfmt --to=iec $CSS_SIZE)"
	fi
	CLIENT_SIZE=$((CLIENT_SIZE + CSS_SIZE))
elif [ -d web/static/css ]; then
	CSS_SIZE=$(du -sb web/static/css | awk '{print $1}')
	printf "${GREEN}CSS:${NC}                     %8s\n" "$(numfmt --to=iec $CSS_SIZE)"
	CLIENT_SIZE=$((CLIENT_SIZE + CSS_SIZE))
fi

# Images size (if any)
if [ -d web/static/images ]; then
	IMG_SIZE=$(du -sb web/static/images | awk '{print $1}')
	printf "${GREEN}Images:${NC}                  %8s\n" "$(numfmt --to=iec $IMG_SIZE)"
	CLIENT_SIZE=$((CLIENT_SIZE + IMG_SIZE))
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
	CLIENT_SIZE=$((CLIENT_SIZE + HTML_SIZE))
else
	HTML_SIZE=$(find web/templates -name "*.html" -exec cat {} \; | wc -c 2>/dev/null || echo 0)
	if [ $HTML_SIZE -gt 0 ]; then
		printf "${GREEN}HTML Templates:${NC}          %8s\n" "$(numfmt --to=iec $HTML_SIZE)"
		CLIENT_SIZE=$((CLIENT_SIZE + HTML_SIZE))
	fi
fi

printf "${CYAN}────────────────────────────────────${NC}\n"
printf "${BOLD}${GREEN}Total Client Bundle:${NC}     %8s\n" "$(numfmt --to=iec $CLIENT_SIZE)"