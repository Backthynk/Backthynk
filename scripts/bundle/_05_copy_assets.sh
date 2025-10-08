#!/bin/bash

# Bundle Component: Copy Static Assets
# Copies images, fonts, and other static files to bundle

source "$(dirname "$0")/../common/common.sh"
source "$(dirname "$0")/../common/load-config.sh"

log_step "Copying static assets..."

# Use config values - SOURCE_STATIC is set by load-config.sh
STATIC_SOURCE="$PROJECT_ROOT/web/$SOURCE_STATIC"

# Use dynamically constructed paths from config
BUNDLE_STATIC_DIR=$(get_bundle_static_dir)

# Copy images
IMAGES_SOURCE="$STATIC_SOURCE/images"
IMAGES_DEST="$BUNDLE_STATIC_DIR/images"

if [ -d "$IMAGES_SOURCE" ]; then
    log_substep "Copying images..."
    mkdir -p "$IMAGES_DEST"
    cp -r "$IMAGES_SOURCE"/* "$IMAGES_DEST/"
    IMAGE_COUNT=$(find "$IMAGES_DEST" -type f | wc -l)
    log_substep "✓ Copied $IMAGE_COUNT image files"
else
    log_warning "Images directory not found: $IMAGES_SOURCE"
fi

# Copy any other static assets (fonts, etc.)
for asset_dir in "$STATIC_SOURCE"/*; do
    if [ -d "$asset_dir" ]; then
        dir_name=$(basename "$asset_dir")
        # Skip already processed directories
        if [ "$dir_name" != "js" ] && [ "$dir_name" != "css" ] && [ "$dir_name" != "images" ]; then
            log_substep "Copying $dir_name..."
            mkdir -p "$BUNDLE_STATIC_DIR/$dir_name"
            cp -r "$asset_dir"/* "$BUNDLE_STATIC_DIR/$dir_name/"
        fi
    fi
done

log_success "Static assets copied"
