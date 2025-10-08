#!/bin/bash

# Build Script - New Version
# Builds Go binaries for specified platforms with embedded bundle assets

set -e  # Exit on error

# Parse command-line arguments
BUILD_TYPE=""  # Must be explicitly set

while [[ $# -gt 0 ]]; do
    case $1 in
        --all)
            BUILD_TYPE="all"
            shift
            ;;
        --type)
            if [ -z "$2" ]; then
                echo "Error: --type requires a platform argument"
                exit 1
            fi
            # Validate platform
            case "$2" in
                linux-amd64|linux-arm64|macos-amd64|macos-arm64|windows-amd64)
                    BUILD_TYPE="$2"
                    ;;
                *)
                    echo "Error: Invalid platform '$2'"
                    echo ""
                    echo "Available platforms:"
                    echo "  linux-amd64, linux-arm64"
                    echo "  macos-amd64, macos-arm64"
                    echo "  windows-amd64"
                    exit 1
                    ;;
            esac
            shift 2
            ;;
        --auto)
            BUILD_TYPE="auto"
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 --all|--auto|--type <platform>"
            echo ""
            echo "Options:"
            echo "  --auto            Auto-detect current platform and build for it"
            echo "  --all             Build for all platforms"
            echo "  --type <platform> Build for specific platform (e.g., linux-amd64, macos-arm64)"
            echo ""
            echo "Available platforms:"
            echo "  linux-amd64, linux-arm64"
            echo "  macos-amd64, macos-arm64"
            echo "  windows-amd64"
            exit 1
            ;;
    esac
done

# Ensure build type is specified
if [ -z "$BUILD_TYPE" ]; then
    echo ""
    echo "❌ No build target specified"
    echo ""
    echo "Usage:"
    echo "  make build auto              Auto-detect and build for current platform"
    echo "  make build all               Build for all platforms"
    echo "  make build type <platform>   Build for specific platform"
    echo ""
    echo "Supported platforms:"
    echo "  linux-amd64, linux-arm64, macos-amd64, macos-arm64, windows-amd64"
    echo ""
    echo "Examples:"
    echo "  make build auto"
    echo "  make build type linux-amd64"
    echo ""
    exit 1
fi

# Load configuration
source "$(dirname "$0")/../common/load-config.sh"

echo -e "${BOLD}${CYAN}Building Backthynk v${APP_VERSION}...${NC}"
echo -e "${CYAN}====================================${NC}"
echo ""

# Start build timer
BUILD_START=$(date +%s)

# Check if bundle exists
BUNDLE_DIR="$PROJECT_ROOT/bundle"
if [ ! -d "$BUNDLE_DIR" ]; then
    if [ "$BUILD_TYPE" = "all" ]; then
        echo -e "${YELLOW}Bundle folder not found. Creating with full minification...${NC}"
        "$PROJECT_ROOT/scripts/bundle/bundle.sh" --full
    else
        echo -e "${YELLOW}Bundle folder not found. Creating...${NC}"
        "$PROJECT_ROOT/scripts/bundle/bundle.sh" --full
    fi
elif [ "$BUILD_TYPE" = "all" ]; then
    echo -e "${YELLOW}Rebuilding bundle with full minification for --all build...${NC}"
    rm -rf "$BUNDLE_DIR"
    "$PROJECT_ROOT/scripts/bundle/bundle.sh" --full
else
    echo -e "${GREEN}Using existing bundle folder${NC}"
fi

# Determine platforms to build
PLATFORMS_TO_BUILD=()

if [ "$BUILD_TYPE" = "all" ]; then
    # Build all platforms
    PLATFORMS_TO_BUILD=(
        "linux-amd64:GOOS=linux GOARCH=amd64"
        "linux-arm64:GOOS=linux GOARCH=arm64 CC=aarch64-linux-gnu-gcc"
        "macos-amd64:GOOS=darwin GOARCH=amd64 CC=o64-clang"
        "macos-arm64:GOOS=darwin GOARCH=arm64 CC=oa64-clang"
        "windows-amd64:GOOS=windows GOARCH=amd64 CC=x86_64-w64-mingw32-gcc"
    )
elif [ "$BUILD_TYPE" = "auto" ]; then
    # Auto-detect current platform
    CURRENT_PLATFORM=$(detect_current_platform)

    # Find configuration for current platform
    for platform_config in "${ALL_PLATFORMS[@]}"; do
        platform="${platform_config%%:*}"
        if [ "$platform" = "$CURRENT_PLATFORM" ]; then
            PLATFORMS_TO_BUILD=("$platform_config")
            break
        fi
    done

    # Fallback
    if [ ${#PLATFORMS_TO_BUILD[@]} -eq 0 ]; then
        echo -e "${YELLOW}Platform $CURRENT_PLATFORM not in supported list, defaulting to linux-amd64${NC}"
        PLATFORMS_TO_BUILD=("linux-amd64:GOOS=linux GOARCH=amd64")
    fi
else
    # Build specific platform (already validated in argument parsing)
    case "$BUILD_TYPE" in
        linux-amd64)
            PLATFORMS_TO_BUILD=("linux-amd64:GOOS=linux GOARCH=amd64")
            ;;
        linux-arm64)
            PLATFORMS_TO_BUILD=("linux-arm64:GOOS=linux GOARCH=arm64 CC=aarch64-linux-gnu-gcc")
            ;;
        macos-amd64)
            PLATFORMS_TO_BUILD=("macos-amd64:GOOS=darwin GOARCH=amd64 CC=o64-clang")
            ;;
        macos-arm64)
            PLATFORMS_TO_BUILD=("macos-arm64:GOOS=darwin GOARCH=arm64 CC=oa64-clang")
            ;;
        windows-amd64)
            PLATFORMS_TO_BUILD=("windows-amd64:GOOS=windows GOARCH=amd64 CC=x86_64-w64-mingw32-gcc")
            ;;
    esac
fi

# Build binaries
BUILD_DIR="$PROJECT_ROOT/build"
RELEASES_DIR="$PROJECT_ROOT/releases"

echo -e "${BOLD}Building for platforms:${NC}"
for platform_config in "${PLATFORMS_TO_BUILD[@]}"; do
    platform="${platform_config%%:*}"
    echo -e "  - $platform"
done
echo ""

for platform_config in "${PLATFORMS_TO_BUILD[@]}"; do
    platform="${platform_config%%:*}"
    env_vars="${platform_config#*:}"

    echo -e "${BOLD}${CYAN}Building $platform...${NC}"

    # Set up build environment
    eval "export $env_vars"

    # Determine binary extension
    BINARY_EXT=""
    if [[ "$platform" == "windows"* ]]; then
        BINARY_EXT=".exe"
    fi

    # Create platform-specific directory under releases
    PLATFORM_RELEASE_DIR="$RELEASES_DIR/$platform"
    mkdir -p "$PLATFORM_RELEASE_DIR"

    # Build with embedded bundle - output to releases/<platform>/
    OUTPUT_BINARY="$PLATFORM_RELEASE_DIR/${BINARY_NAME}-v${APP_VERSION}${BINARY_EXT}"

    # Copy bundle and config to cmd/server for embed (symlinks don't work with embed)
    BUNDLE_COPY="$PROJECT_ROOT/cmd/server/bundle"
    CONFIG_COPY="$PROJECT_ROOT/cmd/server/.config.json"
    cp -r "$BUNDLE_DIR" "$BUNDLE_COPY"
    cp "$PROJECT_ROOT/scripts/.config.json" "$CONFIG_COPY"

    # Backup existing init_prod.go if it exists
    INIT_PROD_FILE="$PROJECT_ROOT/cmd/server/init_prod.go"
    INIT_PROD_BACKUP="$PROJECT_ROOT/cmd/server/init_prod.go.bak"
    if [ -f "$INIT_PROD_FILE" ]; then
        mv "$INIT_PROD_FILE" "$INIT_PROD_BACKUP"
    fi

    # Create temporary init_prod.go with embed directive
    cat > "$INIT_PROD_FILE" << 'EMBED_EOF'
//go:build production
// +build production

package main

import (
	"backthynk/internal/embedded"
	"embed"
)

//go:embed all:bundle
var bundleFS embed.FS

//go:embed .config.json
var configJSON []byte

func init() {
	embedded.SetBundleFS(bundleFS)
	embedded.SetConfigJSON(configJSON)
}
EMBED_EOF

    echo -e "${YELLOW}Compiling Go binary with embedded assets...${NC}"
    CGO_ENABLED=1 go build \
        -ldflags="-X main.Version=$APP_VERSION -s -w" \
        -tags production \
        -o "$OUTPUT_BINARY" \
        ./cmd/server

    # Restore original init_prod.go or remove temporary one
    if [ -f "$INIT_PROD_BACKUP" ]; then
        mv "$INIT_PROD_BACKUP" "$INIT_PROD_FILE"
    else
        rm -f "$INIT_PROD_FILE"
    fi
    rm -rf "$BUNDLE_COPY"
    rm -f "$CONFIG_COPY"

    if [ -f "$OUTPUT_BINARY" ]; then
        BINARY_SIZE=$(du -h "$OUTPUT_BINARY" | cut -f1)
        echo -e "${GREEN}✓ Built: $OUTPUT_BINARY ($BINARY_SIZE)${NC}"
    else
        echo -e "${RED}✗ Failed to build $platform${NC}"
        exit 1
    fi

    echo ""
done

# Calculate build time
BUILD_END=$(date +%s)
BUILD_TIME=$((BUILD_END - BUILD_START))

echo ""
echo -e "${BOLD}${CYAN}Build Performance:${NC}"
echo -e "${CYAN}==================${NC}"
printf "${GREEN}Total build time:${NC}        %02d:%02d\n" $((BUILD_TIME / 60)) $((BUILD_TIME % 60))

echo ""
echo -e "${BOLD}${GREEN}✓ Build completed successfully!${NC}"
echo -e "${GRAY}  • Binaries include embedded bundle assets${NC}"
echo -e "${GRAY}  • Production-optimized with brotli+gzip compression${NC}"
echo -e "${GRAY}  • Built ${#PLATFORMS_TO_BUILD[@]} platform(s)${NC}"
echo ""
