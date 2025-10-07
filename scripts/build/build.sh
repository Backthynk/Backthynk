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

# Component 05a: Copy image assets
source "$COMPONENTS_DIR/_05a_copy_images.sh"

# Component 06: Apply gzip compression
source "$COMPONENTS_DIR/_06_gzip_compression.sh"

# Component 07: Cache CDN packages
source "$COMPONENTS_DIR/_07_cdn_caching.sh"

# Component 07a: Build cross-platform binaries
source "$COMPONENTS_DIR/_07a_cross_platform_build.sh"

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