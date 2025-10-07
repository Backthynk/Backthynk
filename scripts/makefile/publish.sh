#!/bin/bash

# Publish Script
# Creates platform-specific release archives ready for distribution

set -e

# Load configuration
source "$(dirname "$0")/../common/load-config.sh"
source "$(dirname "$0")/../common/common.sh"

echo -e "${BOLD}${CYAN}Creating release archives for v${APP_VERSION}...${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

# Check if releases directory exists
if [ ! -d "$RELEASES_DIR" ]; then
    echo -e "${RED}Error: Releases directory not found at $RELEASES_DIR${NC}"
    echo -e "${YELLOW}Run 'make build' first to create the builds${NC}"
    exit 1
fi

# Create versioned archives directory
ARCHIVES_DIR="$PROJECT_ROOT/archives"
VERSION_DIR="$ARCHIVES_DIR/v$APP_VERSION"
mkdir -p "$VERSION_DIR"

echo -e "${BOLD}Platform-specific archives:${NC}"
echo ""

# Function to create platform-specific archive
create_platform_archive() {
    local platform=$1
    local archive_name="$BINARY_NAME-v$APP_VERSION-$platform"

    # Check if platform release directory exists
    if [ ! -d "$RELEASES_DIR/$platform" ]; then
        echo -e "${YELLOW}  Skipping $platform (not built)${NC}"
        return 0
    fi

    log_step "Creating $platform archive..."

    # Note: GET-STARTED.txt, Makefile, and run.bat are already created during build
    # No need to create additional README files here

    # Create archive
    cd "$RELEASES_DIR"
    if [[ "$platform" == "windows"* ]]; then
        zip -q -r "$VERSION_DIR/$archive_name.zip" "$platform"
        log_substep "✓ Created $archive_name.zip"
    else
        tar -czf "$VERSION_DIR/$archive_name.tar.gz" "$platform"
        log_substep "✓ Created $archive_name.tar.gz"
    fi
    cd - > /dev/null
}

# Create archives for each platform
for platform_config in "${BUILD_PLATFORMS[@]}"; do
    platform="${platform_config%%:*}"
    create_platform_archive "$platform"
done

echo ""
echo -e "${BOLD}Creating universal archive:${NC}"
echo ""

# Create universal archive with all platforms
log_step "Creating universal multi-platform archive..."
UNIVERSAL_NAME="$BINARY_NAME-v$APP_VERSION-all-platforms"

# Create comprehensive README
cat > "$RELEASES_DIR/README.txt" << EOF
Backthynk v$APP_VERSION - All Platforms

This archive contains binaries for all supported platforms.

Quick Start:
============
Choose the directory for your platform and run the binary:

Linux (AMD64/x86_64):
  cd linux-amd64 && ./bin/$BINARY_NAME-latest

Linux (ARM64):
  cd linux-arm64 && ./bin/$BINARY_NAME-latest

macOS (Intel):
  cd macos-amd64 && ./bin/$BINARY_NAME-latest

macOS (Apple Silicon):
  cd macos-arm64 && ./bin/$BINARY_NAME-latest

Windows (AMD64):
  cd windows-amd64 && .\bin\$BINARY_NAME-latest.exe

After running, open your browser to: http://localhost:8080

Documentation:
==============
Visit: https://github.com/Backthynk/backthynk

Support:
========
Issues: https://github.com/Backthynk/backthynk/issues
EOF

cd "$PROJECT_ROOT"
zip -q -r "$VERSION_DIR/$UNIVERSAL_NAME.zip" releases/
cd - > /dev/null
log_substep "✓ Created $UNIVERSAL_NAME.zip"

echo ""
echo -e "${BOLD}${CYAN}Generating checksums...${NC}"
echo ""

# Generate checksums
cd "$VERSION_DIR"
sha256sum *.tar.gz *.zip > "SHA256SUMS.txt" 2>/dev/null || shasum -a 256 *.tar.gz *.zip > "SHA256SUMS.txt"
echo -e "${GREEN}✓ Checksums saved to SHA256SUMS.txt${NC}"

# Display summary
echo ""
echo -e "${BOLD}${GREEN}✓ Release archives created successfully!${NC}"
echo ""
echo -e "${BOLD}Location:${NC} $VERSION_DIR"
echo ""
echo -e "${BOLD}Files created:${NC}"
ls -lh "$VERSION_DIR" | tail -n +2 | awk '{printf "  %s  %s\n", $5, $9}'
echo ""
echo -e "${GRAY}To upload to GitHub, use: gh release create v$APP_VERSION --generate-notes${NC}"
echo -e "${GRAY}Or use: make release${NC}"
echo ""
