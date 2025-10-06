#!/bin/bash

# Build Script
# Modular component-based build system

set -e  # Exit on error

# Load configuration
source "$(dirname "$0")/../common/load-config.sh"

echo -e "${BOLD}${CYAN}Building production-optimized v${APP_VERSION}...${NC}"

# Start build timer
BUILD_START=$(date +%s)

# Execute build components in sequence
COMPONENTS_DIR="$(dirname "$0")"

# Component 01: Check dependencies
source "$COMPONENTS_DIR/_01_dependencies.sh"

# Component 02: Setup compression tools
source "$COMPONENTS_DIR/_02_compression_setup.sh"

# Component 03: Process CSS files
source "$COMPONENTS_DIR/_03_css_bundling.sh"

# Component 04: Bundle JavaScript files
source "$COMPONENTS_DIR/_04_js_bundling.sh"

# Component 05: Process HTML templates
source "$COMPONENTS_DIR/_05_html_processing.sh"

# Component 06: Apply gzip compression
source "$COMPONENTS_DIR/_06_gzip_compression.sh"

# Component 07: Cache CDN packages
source "$COMPONENTS_DIR/_07_cdn_caching.sh"

# Copy required config files to build directory
log_step "Copying configuration files to build directory..."
mkdir -p "$BUILD_DIR"

# Copy .config.json
if [ -f "$SCRIPT_DIR/.config.json" ]; then
    log_substep "Copying .config.json..."
    cp "$SCRIPT_DIR/.config.json" "$BUILD_DIR/.config.json"
else
    echo -e "${RED}Error: .config.json not found at $SCRIPT_DIR/.config.json${NC}" >&2
    exit 1
fi

# Copy all template files to build directory
log_step "Copying template files to build directory..."
TEMPLATES_DIR="$COMPONENTS_DIR/templates"

if [ -d "$TEMPLATES_DIR" ]; then
    log_substep "Copying all files from templates directory..."
    # Use rsync if available for better directory copying, otherwise use cp -r
    if command -v rsync &> /dev/null; then
        rsync -av --exclude='.*' "$TEMPLATES_DIR/" "$BUILD_DIR/"
    else
        cp -r "$TEMPLATES_DIR/"* "$BUILD_DIR/" 2>/dev/null || true
    fi
    log_substep "✓ Template files copied successfully"
else
    echo -e "${YELLOW}Warning: Templates directory not found at $TEMPLATES_DIR${NC}" >&2
fi

# Build optimized Go binaries
log_step "Building optimized Go binaries..."
log_substep "Creating build directories..."
mkdir -p "$BUILD_BIN/unix"
mkdir -p "$BUILD_BIN/windows"

log_substep "Building Unix binary (v${APP_VERSION})..."
CGO_ENABLED=1 eval "$BUILD_COMMAND"

log_substep "Creating latest symlink..."
ln -sf "$BINARY_NAME-v$APP_VERSION" "$BUILD_BIN/unix/$BINARY_NAME-latest"

log_substep "Building Windows binary (v${APP_VERSION})..."
CGO_ENABLED=0 eval "$BUILD_COMMAND_WINDOWS"

log_substep "Creating Windows latest copy..."
cp "$BUILD_BIN/windows/$BINARY_NAME-v$APP_VERSION.exe" "$BUILD_BIN/windows/$BINARY_NAME-latest.exe"

# Component 08: Generate bundle size report
source "$COMPONENTS_DIR/_08_bundle_reporting.sh"

# Calculate build time
BUILD_END=$(date +%s)
BUILD_TIME=$((BUILD_END - BUILD_START))

echo ""
echo -e "${BOLD}${CYAN}Build Performance:${NC}"
echo -e "${CYAN}==================${NC}"
printf "${GREEN}Total build time:${NC}        %02d:%02d\n" $((BUILD_TIME / 60)) $((BUILD_TIME % 60))

echo ""
echo -e "${BOLD}${GREEN}✓ Production build completed successfully!${NC}"
echo -e "${GRAY}  • Modular component-based build system${NC}"
echo -e "${GRAY}  • Minified and bundled JavaScript with progressive optimization${NC}"
echo -e "${GRAY}  • Combined and compressed CSS bundles${NC}"
echo -e "${GRAY}  • Gzipped assets for maximum compression${NC}"
echo -e "${GRAY}  • CDN package caching for faster rebuilds${NC}"
echo -e "${GRAY}  • Updated HTML templates with asset references${NC}"