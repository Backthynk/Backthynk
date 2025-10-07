#!/bin/bash

# Build Component: Copy Images
# This script copies image assets (favicons) to the build directory

source "$(dirname "$0")/../common/common.sh"
source "$(dirname "$0")/../common/load-config.sh"

log_step "Copying image assets..."

# Define source and destination directories
IMAGES_SOURCE_DIR="$SOURCE_IMAGES"
IMAGES_DEST_DIR="$BUILD_ASSETS/images"

# Check if source directory exists
if [ ! -d "$IMAGES_SOURCE_DIR" ]; then
    log_warning "Images source directory not found: $IMAGES_SOURCE_DIR"
    log_warning "Skipping image copying"
    exit 0
fi

# Create destination directory
if [ ! -d "$IMAGES_DEST_DIR" ]; then
    log_substep "Creating images directory: $IMAGES_DEST_DIR"
    mkdir -p "$IMAGES_DEST_DIR"
fi

# Copy entire images directory structure (including light/dark subdirectories)
log_substep "Copying images to build directory..."
if cp -r "$IMAGES_SOURCE_DIR"/* "$IMAGES_DEST_DIR/"; then
    # Count total files copied
    TOTAL_FILES=$(find "$IMAGES_DEST_DIR" -type f | wc -l)
    TOTAL_SIZE=$(du -sh "$IMAGES_DEST_DIR" | cut -f1)
    log_success "Copied $TOTAL_FILES image file(s) ($TOTAL_SIZE)"
else
    log_error "Failed to copy images"
    exit 1
fi

log_success "Image asset copying complete"
