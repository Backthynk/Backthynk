#!/bin/bash

# Bundle Script
# Modern bundler using esbuild/rollup for optimal JS/CSS bundling with tree-shaking

set -e  # Exit on error

# Parse command-line arguments
MINIFY_MODE="full"  # full or debug

while [[ $# -gt 0 ]]; do
    case $1 in
        --debug)
            MINIFY_MODE="debug"
            shift
            ;;
        --full)
            MINIFY_MODE="full"
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--debug|--full]"
            echo "  --debug: Bundle without minification/mangling (for debugging)"
            echo "  --full:  Full minification with tree-shaking (default)"
            exit 1
            ;;
    esac
done

# Load configuration (must be done before using helper functions)
source "$(dirname "$0")/../common/load-config.sh"

# Set bundle directory from config (dynamically constructed)
BUNDLE_DIR=$(get_bundle_dir)
mkdir -p "$BUNDLE_DIR"

echo -e "${BOLD}${CYAN}Bundling assets for production (mode: $MINIFY_MODE)...${NC}"
echo -e "${CYAN}================================================${NC}"
echo ""

# Start bundle timer
BUNDLE_START=$(date +%s)

# Export minify mode for sub-scripts
export MINIFY_MODE
export BUNDLE_DIR

# Execute bundle components in sequence
COMPONENTS_DIR="$(dirname "$0")"

# Component 01: Check dependencies
source "$COMPONENTS_DIR/_01_check_tools.sh"

# Component 02: Bundle CSS with modern tooling
source "$COMPONENTS_DIR/_02_bundle_css.sh"

# Component 03: Bundle JavaScript with modern tooling
source "$COMPONENTS_DIR/_03_bundle_js.sh"

# Component 04: Process HTML templates
source "$COMPONENTS_DIR/_04_process_templates.sh"

# Component 05: Copy static assets (images, fonts)
source "$COMPONENTS_DIR/_05_copy_assets.sh"

# Component 06: Apply compression (brotli + gzip)
source "$COMPONENTS_DIR/_06_compress_assets.sh"

# Component 07: Generate bundle summary
source "$COMPONENTS_DIR/_07_bundle_summary.sh"

# Calculate bundle time
BUNDLE_END=$(date +%s)
BUNDLE_TIME=$((BUNDLE_END - BUNDLE_START))

echo ""
echo -e "${BOLD}${CYAN}Bundle Performance:${NC}"
echo -e "${CYAN}==================${NC}"
printf "${GREEN}Total bundle time:${NC}        %02d:%02d\n" $((BUNDLE_TIME / 60)) $((BUNDLE_TIME % 60))

echo ""
echo -e "${BOLD}${GREEN}✓ Bundle created successfully!${NC}"
echo -e "${GRAY}  • CSS optimized with CSSO${NC}"
echo -e "${GRAY}  • JavaScript minified with tdewolff/minify${NC}"
echo -e "${GRAY}  • HTML minified with tdewolff/minify${NC}"
echo -e "${GRAY}  • Brotli and gzip compression${NC}"
echo -e "${GRAY}  • Mode: $MINIFY_MODE${NC}"
echo ""
