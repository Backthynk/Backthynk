#!/bin/bash

# Bundle Component: Process HTML Templates
# Updates HTML templates to reference bundled assets

source "$(dirname "$0")/../common/common.sh"
source "$(dirname "$0")/../common/load-config.sh"

log_step "Processing HTML templates..."

# Use dynamically constructed paths from config
BUNDLE_TEMPLATES_DIR=$(get_bundle_templates_dir)
mkdir -p "$BUNDLE_TEMPLATES_DIR"

# Use config values - SOURCE_TEMPLATES is set by load-config.sh
TEMPLATE_SOURCE="$PROJECT_ROOT/web/$SOURCE_TEMPLATES/index.html"
TEMPLATE_OUTPUT="$BUNDLE_TEMPLATES_DIR/index.html"

if [ ! -f "$TEMPLATE_SOURCE" ]; then
    log_error "Template not found: $TEMPLATE_SOURCE"
    exit 1
fi

log_substep "Updating template references to bundled assets..."

# Copy template
cp "$TEMPLATE_SOURCE" "$TEMPLATE_OUTPUT"

# Get script tag patterns from config
JS_START=$(get_html_processing_config "js_script_tags_start")
JS_END=$(get_html_processing_config "js_script_tags_end")
TAILWIND_CDN=$(get_html_processing_config "tailwind_cdn_pattern")
FONTAWESOME_CDN=$(get_html_processing_config "fontawesome_cdn_pattern")

# Remove individual JS script tags between start and end
sed -i "/<script.*$JS_START/,/<script.*$JS_END/d" "$TEMPLATE_OUTPUT"

# Remove CDN links for Tailwind and FontAwesome
sed -i "\|$TAILWIND_CDN|d" "$TEMPLATE_OUTPUT"
sed -i "\|$FONTAWESOME_CDN|d" "$TEMPLATE_OUTPUT"

# Remove main.css link (will be replaced with bundle.css)
sed -i '\|/static/css/main.css|d' "$TEMPLATE_OUTPUT"

# Add bundled CSS and JS references (using config-based paths)
CSS_PATH=$(jq -r '.paths.source.css // "static/css"' "$SHARED_CONFIG_FILE")
JS_PATH=$(jq -r '.paths.source.js // "static/js"' "$SHARED_CONFIG_FILE")

# Find the </head> tag and add bundled CSS before it
sed -i "s|</head>|    <link rel=\"stylesheet\" href=\"/$CSS_PATH/bundle.css\">\n    </head>|" "$TEMPLATE_OUTPUT"

# Find the </body> tag and add bundled JS before it
sed -i "s|</body>|    <script src=\"/$JS_PATH/bundle.js\"></script>\n    </body>|" "$TEMPLATE_OUTPUT"

# Minify HTML using tdewolff/minify
if [ "$MINIFY_MODE" = "full" ]; then
    log_substep "Minifying HTML template with minify..."

    # Create temporary file for minification
    TEMP_HTML="$TEMPLATE_OUTPUT.tmp"

    # Use minify for aggressive HTML minification
    # --type=html: Treat as HTML
    # --html-keep-document-tags: Keep <html>, <head>, <body> tags
    # --html-keep-end-tags: Keep end tags for proper structure
    # --html-keep-quotes: Keep quotes (safer for dynamic content)
    minify --type=html \
        --html-keep-document-tags \
        --html-keep-end-tags \
        "$TEMPLATE_OUTPUT" > "$TEMP_HTML"

    mv "$TEMP_HTML" "$TEMPLATE_OUTPUT"

    log_success "Template processing complete (minified with minify)"
else
    log_success "Template processing complete"
fi
