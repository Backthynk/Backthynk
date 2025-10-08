#!/bin/bash

# Build Local Script
# Runs the full release build process in Docker, producing releases, bundle, SHA256SUMS, and BUILD_INFO locally

set -e

# Load configuration for version info
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source load-config for colors and helper functions
source "$PROJECT_ROOT/scripts/common/load-config.sh"

echo -e "${BOLD}${CYAN}Local Release Build${NC}"
echo -e "${CYAN}==================${NC}"
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed or not in PATH${NC}"
    echo -e "${YELLOW}Please install Docker to use this command${NC}"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo -e "${RED}Error: Docker daemon is not running${NC}"
    echo -e "${YELLOW}Please start Docker and try again${NC}"
    exit 1
fi

# Get current commit info
COMMIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
COMMIT_SHORT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
REPO_URL=$(git config --get remote.origin.url 2>/dev/null | sed 's/\.git$//' || echo "unknown")
if [[ "$REPO_URL" == git@github.com:* ]]; then
    REPO_URL="https://github.com/${REPO_URL#git@github.com:}"
fi

echo -e "${BOLD}Build Information:${NC}"
echo -e "  Version:    ${GREEN}v${APP_VERSION}${NC}"
echo -e "  Commit:     ${GRAY}${COMMIT_SHORT}${NC}"
echo -e "  Date:       ${GRAY}${BUILD_DATE}${NC}"
echo ""

# Build Docker image
DOCKER_IMAGE="backthynk-builder:latest"
echo -e "${BOLD}Building Docker image...${NC}"
DOCKER_BUILDKIT=1 docker build -f scripts/build-docker/Dockerfile -t "$DOCKER_IMAGE" "$PROJECT_ROOT"
echo ""

# Use releases directory for local builds (not archives)
OUTPUT_DIR="$PROJECT_ROOT/releases"
mkdir -p "$OUTPUT_DIR"

# Run build in Docker container
echo -e "${BOLD}Running build in Docker container...${NC}"
echo ""

docker run --rm \
    -v "$PROJECT_ROOT:/workspace" \
    -w /workspace \
    "$DOCKER_IMAGE" \
    bash -c "
        set -e

        # Configure git to trust the workspace directory
        git config --global --add safe.directory /workspace

        echo '${CYAN}Running tests...${NC}'
        go test -v ./... || { echo 'Tests failed!'; exit 1; }
        echo ''

        echo '${CYAN}Building bundle...${NC}'
        ./scripts/bundle/bundle.sh --full
        echo ''

        echo '${CYAN}Building binaries for all platforms...${NC}'
        ./scripts/makefile/build.sh --all
        echo ''
    "

# Generate BUILD_INFO in releases folder
echo -e "${BOLD}Generating BUILD_INFO...${NC}"
sed -e "s|{{VERSION}}|$APP_VERSION|g" \
    -e "s|{{COMMIT_SHA}}|$COMMIT_SHA|g" \
    -e "s|{{REF_NAME}}|$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')|g" \
    -e "s|{{BUILD_DATE}}|$BUILD_DATE|g" \
    -e "s|{{BUILDER}}|Local Docker Build|g" \
    -e "s|{{REPO_URL}}|$REPO_URL|g" \
    "$PROJECT_ROOT/docs/templates/build-info.txt" > "$OUTPUT_DIR/BUILD_INFO.txt"

echo -e "${GREEN}✓ BUILD_INFO.txt created${NC}"
echo ""

# Generate SHA256SUMS for binaries in releases folder
echo -e "${BOLD}Generating SHA256SUMS...${NC}"
cd "$OUTPUT_DIR"

# Remove old checksums if exists
rm -f SHA256SUMS.txt

# Generate checksums for all platform binaries
for platform_dir in linux-amd64 linux-arm64 macos-amd64 macos-arm64 windows-amd64; do
    if [ -d "$platform_dir" ]; then
        for binary in "$platform_dir"/*; do
            if [ -f "$binary" ] && [[ "$binary" != *".txt" ]]; then
                sha256sum "$binary" >> SHA256SUMS.txt 2>/dev/null || shasum -a 256 "$binary" >> SHA256SUMS.txt
            fi
        done
    fi
done

if [ -f SHA256SUMS.txt ]; then
    echo -e "${GREEN}✓ SHA256SUMS.txt created${NC}"
else
    echo -e "${YELLOW}⚠ No binaries found to checksum${NC}"
fi

cd "$PROJECT_ROOT"
echo ""

# Display summary
echo -e "${BOLD}${GREEN}✓ Local release build completed!${NC}"
echo ""
echo -e "${BOLD}Output locations:${NC}"
echo -e "  Binaries:  ${GRAY}releases/${NC}"
echo -e "  Bundle:    ${GRAY}bundle/${NC}"
echo ""
echo -e "${BOLD}Generated files in releases/:${NC}"
if [ -f "$OUTPUT_DIR/SHA256SUMS.txt" ]; then
    echo -e "  ${GREEN}✓${NC} SHA256SUMS.txt"
fi
if [ -f "$OUTPUT_DIR/BUILD_INFO.txt" ]; then
    echo -e "  ${GREEN}✓${NC} BUILD_INFO.txt"
fi
echo ""
echo -e "${BOLD}Platform binaries:${NC}"
for platform_dir in "$OUTPUT_DIR"/*/; do
    if [ -d "$platform_dir" ]; then
        platform=$(basename "$platform_dir")
        echo -e "  ${CYAN}$platform:${NC}"
        ls -lh "$platform_dir" | tail -n +2 | grep -v "\.txt$" | awk '{printf "    %s  %s\n", $5, $9}'
    fi
done
echo ""