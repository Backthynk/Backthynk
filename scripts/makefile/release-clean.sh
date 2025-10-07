#!/bin/bash

# Release Clean Script
# Clean up a failed or incomplete release (delete tag and remote release)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SCRIPT_DIR/common/load-config.sh"

echo -e "${BOLD}${CYAN}Release Cleanup${NC}"
echo -e "${CYAN}===============${NC}"
echo ""

TAG_NAME="v${APP_VERSION}"

echo -e "${BOLD}Version:${NC} ${TAG_NAME}"
echo ""

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed.${NC}"
    echo -e "${YELLOW}Please install gh: https://cli.github.com/${NC}"
    exit 1
fi

# Check what exists
TAG_EXISTS_LOCAL=false
TAG_EXISTS_REMOTE=false
RELEASE_EXISTS=false

if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
    TAG_EXISTS_LOCAL=true
fi

if git ls-remote --tags origin | grep -q "refs/tags/$TAG_NAME"; then
    TAG_EXISTS_REMOTE=true
fi

if gh release view "$TAG_NAME" &> /dev/null; then
    RELEASE_EXISTS=true
fi

# Show current state
echo -e "${BOLD}${CYAN}Current state:${NC}"
echo ""
if [ "$TAG_EXISTS_LOCAL" = true ]; then
    echo -e "  ${YELLOW}✓${NC} Local tag exists"
else
    echo -e "  ${GREEN}✗${NC} Local tag does not exist"
fi

if [ "$TAG_EXISTS_REMOTE" = true ]; then
    echo -e "  ${YELLOW}✓${NC} Remote tag exists"
else
    echo -e "  ${GREEN}✗${NC} Remote tag does not exist"
fi

if [ "$RELEASE_EXISTS" = true ]; then
    echo -e "  ${YELLOW}✓${NC} GitHub release exists"
else
    echo -e "  ${GREEN}✗${NC} GitHub release does not exist"
fi

echo ""

# If nothing exists, we're done
if [ "$TAG_EXISTS_LOCAL" = false ] && [ "$TAG_EXISTS_REMOTE" = false ] && [ "$RELEASE_EXISTS" = false ]; then
    echo -e "${GREEN}Nothing to clean up. Release $TAG_NAME does not exist.${NC}"
    exit 0
fi

# Confirm cleanup
echo -e "${BOLD}${YELLOW}Warning: This will delete:${NC}"
if [ "$TAG_EXISTS_LOCAL" = true ]; then
    echo -e "  • Local tag ${TAG_NAME}"
fi
if [ "$TAG_EXISTS_REMOTE" = true ]; then
    echo -e "  • Remote tag ${TAG_NAME}"
fi
if [ "$RELEASE_EXISTS" = true ]; then
    echo -e "  • GitHub release ${TAG_NAME} (including all assets)"
fi
echo ""
echo -e "${YELLOW}This action cannot be undone!${NC}"
echo ""
read -p "Are you sure you want to proceed? (yes/N): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Cleanup cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${BOLD}${CYAN}Cleaning up...${NC}"
echo ""

# Delete GitHub release first (if exists)
if [ "$RELEASE_EXISTS" = true ]; then
    echo -e "${YELLOW}Deleting GitHub release...${NC}"
    if gh release delete "$TAG_NAME" --yes 2>/dev/null; then
        echo -e "${GREEN}✓ GitHub release deleted${NC}"
    else
        echo -e "${RED}Failed to delete GitHub release${NC}"
    fi
fi

# Delete remote tag (if exists)
if [ "$TAG_EXISTS_REMOTE" = true ]; then
    echo -e "${YELLOW}Deleting remote tag...${NC}"
    if git push origin --delete "$TAG_NAME" 2>/dev/null; then
        echo -e "${GREEN}✓ Remote tag deleted${NC}"
    else
        echo -e "${RED}Failed to delete remote tag${NC}"
    fi
fi

# Delete local tag (if exists)
if [ "$TAG_EXISTS_LOCAL" = true ]; then
    echo -e "${YELLOW}Deleting local tag...${NC}"
    if git tag -d "$TAG_NAME" 2>/dev/null; then
        echo -e "${GREEN}✓ Local tag deleted${NC}"
    else
        echo -e "${RED}Failed to delete local tag${NC}"
    fi
fi

echo ""
echo -e "${BOLD}${GREEN}✓ Cleanup completed!${NC}"
echo ""
echo -e "${CYAN}You can now run 'make release' again to retry the release.${NC}"
echo ""
