#!/bin/bash

# Component 07a: Cross-platform binary builds
# Builds binaries for all platforms and creates release directory structure

log_step "Preparing release configuration..."

# Clean previous releases
rm -rf "$RELEASES_DIR"
mkdir -p "$RELEASES_DIR"

# Create a temporary config file for production
TEMP_CONFIG=$(mktemp)
if [ -f "$SCRIPT_DIR/.config.json" ]; then
    cp "$SCRIPT_DIR/.config.json" "$TEMP_CONFIG"

    # Update paths for production (relative to release directory)
    # Use platform-agnostic sed (works on both Linux and macOS)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' 's|"build_dir": "build"|"build_dir": "."|g' "$TEMP_CONFIG"
        sed -i '' 's|"build/assets|"assets|g' "$TEMP_CONFIG"
        sed -i '' 's|"build/bin"|"bin"|g' "$TEMP_CONFIG"
        sed -i '' 's|"web/static"|"assets/static"|g' "$TEMP_CONFIG"
        sed -i '' 's|"web/templates"|"assets/templates"|g' "$TEMP_CONFIG"
        sed -i '' 's|"web/static/js"|"assets/js"|g' "$TEMP_CONFIG"
        sed -i '' 's|"web/static/css"|"assets/css"|g' "$TEMP_CONFIG"
    else
        sed -i 's|"build_dir": "build"|"build_dir": "."|g' "$TEMP_CONFIG"
        sed -i 's|"build/assets|"assets|g' "$TEMP_CONFIG"
        sed -i 's|"build/bin"|"bin"|g' "$TEMP_CONFIG"
        sed -i 's|"web/static"|"assets/static"|g' "$TEMP_CONFIG"
        sed -i 's|"web/templates"|"assets/templates"|g' "$TEMP_CONFIG"
        sed -i 's|"web/static/js"|"assets/js"|g' "$TEMP_CONFIG"
        sed -i 's|"web/static/css"|"assets/css"|g' "$TEMP_CONFIG"
    fi
else
    echo -e "${RED}Error: .config.json not found at $SCRIPT_DIR/.config.json${NC}" >&2
    exit 1
fi

log_step "Building optimized Go binaries for all platforms..."

# Build for all platforms
for platform_config in "${BUILD_PLATFORMS[@]}"; do
    # Parse platform configuration
    platform="${platform_config%%:*}"
    env_vars="${platform_config#*:}"

    log_substep "Building for $platform (v${APP_VERSION})..."

    # Create platform-specific release directory
    RELEASE_PLATFORM_DIR="$RELEASES_DIR/$platform"
    mkdir -p "$RELEASE_PLATFORM_DIR/bin"

    # Copy assets to platform directory
    if [ -d "$BUILD_DIR/assets" ]; then
        cp -r "$BUILD_DIR/assets" "$RELEASE_PLATFORM_DIR/"
    fi

    # Copy configured config file to platform directory
    cp "$TEMP_CONFIG" "$RELEASE_PLATFORM_DIR/.config.json"

    # Copy and customize platform-specific templates
    TEMPLATES_DIR="$COMPONENTS_DIR/templates"

    # Platform-friendly name for display
    PLATFORM_DISPLAY_NAME=$(echo "$platform" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)}1')

    if [[ "$platform" == "windows"* ]]; then
        # Windows: Copy run.bat and customize get-started.txt
        if [ -f "$TEMPLATES_DIR/run.bat" ]; then
            sed "s/__VERSION__/$APP_VERSION/g; s/__PLATFORM__/$PLATFORM_DISPLAY_NAME/g" \
                "$TEMPLATES_DIR/run.bat" > "$RELEASE_PLATFORM_DIR/run.bat"
        fi

        if [ -f "$TEMPLATES_DIR/get-started.txt" ]; then
            sed "s/__VERSION__/$APP_VERSION/g; s/__PLATFORM__/$PLATFORM_DISPLAY_NAME/g; s|__INSTRUCTIONS__|Double-click run.bat to start the application\nOr run: .\\\\bin\\\\backthynk-latest.exe|g" \
                "$TEMPLATES_DIR/get-started.txt" > "$RELEASE_PLATFORM_DIR/GET-STARTED.txt"
        fi
    else
        # Unix/Linux/macOS: Copy Makefile and customize get-started.txt
        if [ -f "$TEMPLATES_DIR/Makefile" ]; then
            sed "s/__VERSION__/$APP_VERSION/g; s/__PLATFORM__/$PLATFORM_DISPLAY_NAME/g" \
                "$TEMPLATES_DIR/Makefile" > "$RELEASE_PLATFORM_DIR/Makefile"
        fi

        if [ -f "$TEMPLATES_DIR/get-started.txt" ]; then
            sed "s/__VERSION__/$APP_VERSION/g; s/__PLATFORM__/$PLATFORM_DISPLAY_NAME/g; s|__INSTRUCTIONS__|Run: make run\nOr run: ./bin/backthynk-latest|g" \
                "$TEMPLATES_DIR/get-started.txt" > "$RELEASE_PLATFORM_DIR/GET-STARTED.txt"
        fi
    fi

    # Determine binary name and extension
    if [[ "$platform" == "windows"* ]]; then
        BINARY_OUTPUT="$RELEASE_PLATFORM_DIR/bin/$BINARY_NAME-v$APP_VERSION.exe"
        BINARY_LATEST="$BINARY_NAME-latest.exe"
    else
        BINARY_OUTPUT="$RELEASE_PLATFORM_DIR/bin/$BINARY_NAME-v$APP_VERSION"
        BINARY_LATEST="$BINARY_NAME-latest"
    fi

    # Build binary with proper environment variable handling
    # Export each env var separately
    eval "export $env_vars"
    CGO_ENABLED=1 go build -o "$BINARY_OUTPUT" ./cmd/server/

    # Create latest symlink/copy
    if [[ "$platform" == "windows"* ]]; then
        cp "$BINARY_OUTPUT" "$RELEASE_PLATFORM_DIR/bin/$BINARY_LATEST"
    else
        ln -sf "$BINARY_NAME-v$APP_VERSION" "$RELEASE_PLATFORM_DIR/bin/$BINARY_LATEST"
    fi

    log_substep "✓ $platform build complete"
done

# Clean up temporary config
rm -f "$TEMP_CONFIG"

log_substep "✓ All platform builds completed"
echo ""
echo -e "${BOLD}${CYAN}Platform builds:${NC}"
echo -e "${CYAN}=================${NC}"
for platform_config in "${BUILD_PLATFORMS[@]}"; do
    platform="${platform_config%%:*}"
    echo -e "${GREEN}  ✓${NC} releases/$platform/"
done
