#!/bin/bash

# Publish Script
# Creates platform-specific release archives ready for distribution

set -e

# Check if running in workflow mode (set BUILD_MODE before loading config)
if [ "${BUILD_MODE:-}" != "workflow" ]; then
    # Detect if we have multiple platform directories already built
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
    RELEASES_DIR="$PROJECT_ROOT/releases"

    if [ -d "$RELEASES_DIR" ]; then
        PLATFORM_COUNT=$(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d | wc -l)
        if [ "$PLATFORM_COUNT" -gt 1 ]; then
            # Multiple platforms exist, assume workflow mode
            export BUILD_MODE="workflow"
        fi
    fi
fi

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

    # Create archive with files at root (no platform subfolder)
    cd "$RELEASES_DIR/$platform"
    if [[ "$platform" == "windows"* ]]; then
        zip -q -r "$VERSION_DIR/$archive_name.zip" .
        log_substep "✓ Created $archive_name.zip"
    else
        tar -czf "$VERSION_DIR/$archive_name.tar.gz" .
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
echo -e "${BOLD}${CYAN}Generating checksums...${NC}"
echo ""

# Generate checksums for binaries (not archives)
cd "$VERSION_DIR"
for archive in *.tar.gz *.zip 2>/dev/null; do
    [ -e "$archive" ] || continue

    # Extract binary name from archive
    if [[ "$archive" == *.tar.gz ]]; then
        # For tar.gz, extract binary and checksum it
        BINARY_IN_ARCHIVE=$(tar -tzf "$archive" | grep -E "^${BINARY_NAME}-v${APP_VERSION}$" | head -n1)
        if [ -n "$BINARY_IN_ARCHIVE" ]; then
            tar -xzf "$archive" "$BINARY_IN_ARCHIVE"
            sha256sum "$BINARY_IN_ARCHIVE" >> "SHA256SUMS.txt" 2>/dev/null || shasum -a 256 "$BINARY_IN_ARCHIVE" >> "SHA256SUMS.txt"
            rm "$BINARY_IN_ARCHIVE"
        fi
    elif [[ "$archive" == *.zip ]]; then
        # For zip, extract binary and checksum it
        BINARY_IN_ARCHIVE=$(unzip -l "$archive" | grep -oE "${BINARY_NAME}-v${APP_VERSION}\.exe" | head -n1)
        if [ -n "$BINARY_IN_ARCHIVE" ]; then
            unzip -q "$archive" "$BINARY_IN_ARCHIVE"
            sha256sum "$BINARY_IN_ARCHIVE" >> "SHA256SUMS.txt" 2>/dev/null || shasum -a 256 "$BINARY_IN_ARCHIVE" >> "SHA256SUMS.txt"
            rm "$BINARY_IN_ARCHIVE"
        fi
    fi
done

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
