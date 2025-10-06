#!/bin/bash

# Build Component: Dependency Checking
# This script checks for all required dependencies before starting the build process

source "$(dirname "$0")/../common/common.sh"
source "$(dirname "$0")/../common/load-config.sh"

log_step "Checking build dependencies..."

# Required commands for the build process
REQUIRED_DEPS=(
    "curl"     # For downloading CDN resources
    "go"       # For building the Go binary
    "sed"      # For text processing
    "awk"      # For text processing
    "tr"       # For text transformation
    "find"     # For file operations
    "mkdir"    # For directory creation
    "numfmt"   # For size formatting
    "du"       # For calculating file sizes
    "cat"      # For file concatenation
    "gzip"     # For compression
    "jq"       # For JSON processing
    "node"     # For Tailwind CSS build
    "npm"      # For Tailwind CSS dependencies
    "perl"    # For advanced text processing (CSS minification fallback
)

# Optional minification tools (checked and reported but not required)
OPTIONAL_MINIFIERS=(
    "terser"   # Best JavaScript minification
    "esbuild"  # Fast JavaScript bundling/minification
)

# Check required dependencies
check_dependencies "${REQUIRED_DEPS[@]}"

# Check optional minification tools
log_substep "Checking optional minification tools:"
AVAILABLE_MINIFIERS=()

for tool in "${OPTIONAL_MINIFIERS[@]}"; do
    if command -v "$tool" &> /dev/null; then
        log_substep "  ✓ $tool available"
        AVAILABLE_MINIFIERS+=("$tool")
    else
        log_substep "  • $tool not available (will use fallback)"
    fi
done

if [ ${#AVAILABLE_MINIFIERS[@]} -eq 0 ]; then
    log_warning "No local minification tools found - will use online fallback API"
else
    log_success "Found ${#AVAILABLE_MINIFIERS[@]} minification tool(s)"
fi

# Export available tools for other scripts to use
export TERSER_AVAILABLE=$(command -v terser &> /dev/null && echo "true" || echo "false")
export ESBUILD_AVAILABLE=$(command -v esbuild &> /dev/null && echo "true" || echo "false")

# Check and setup Tailwind CSS dependencies
TAILWIND_DIR="scripts/build-prod/tailwind-build"
if [ -d "$TAILWIND_DIR" ]; then
    log_substep "Checking Tailwind CSS setup..."
    if [ ! -d "$TAILWIND_DIR/node_modules" ]; then
        log_substep "Installing Tailwind CSS dependencies..."
        (cd "$TAILWIND_DIR" && npm install --silent)
        log_substep "✓ Tailwind CSS dependencies installed"
    else
        log_substep "✓ Tailwind CSS dependencies already installed"
    fi
else
    log_warning "Tailwind CSS build directory not found at $TAILWIND_DIR"
fi

# Check and setup Font Awesome dependencies
FONTAWESOME_DIR="scripts/build-prod/fontawesome-build"
if [ -d "$FONTAWESOME_DIR" ]; then
    log_substep "Checking Font Awesome setup..."
    if [ ! -d "$FONTAWESOME_DIR/node_modules" ]; then
        log_substep "Installing Font Awesome dependencies..."
        (cd "$FONTAWESOME_DIR" && npm install --silent)
        log_substep "✓ Font Awesome dependencies installed"
    else
        log_substep "✓ Font Awesome dependencies already installed"
    fi
else
    log_warning "Font Awesome build directory not found at $FONTAWESOME_DIR"
fi

log_success "Dependency check complete"