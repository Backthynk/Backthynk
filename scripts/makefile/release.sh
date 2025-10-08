#!/bin/bash

# Release Script
# Creates a new release by tagging and pushing to GitHub

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

echo -e "${BOLD}${CYAN}Release Preparation for Backthynk${NC}"
echo -e "${CYAN}===================================${NC}"
echo ""

# Get current version from config
echo -e "${BOLD}Current version:${NC} ${GREEN}v${APP_VERSION}${NC}"
echo ""

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${RED}Error: You have uncommitted changes.${NC}"
    echo -e "${YELLOW}Please commit or stash your changes before creating a release.${NC}"
    exit 1
fi

# Check if we're on the correct branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo -e "${BOLD}Current branch:${NC} ${CURRENT_BRANCH}"

# Check if tag already exists
TAG_NAME="v${APP_VERSION}"
if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
    echo -e "${RED}Error: Tag $TAG_NAME already exists.${NC}"
    echo -e "${YELLOW}Please update the version in scripts/.config.json before releasing.${NC}"
    exit 1
fi

# Check if remote release exists
if command -v gh &> /dev/null && gh release view "$TAG_NAME" &> /dev/null; then
    echo -e "${RED}Error: GitHub release $TAG_NAME already exists.${NC}"
    exit 1
fi

echo ""
echo -e "${BOLD}${CYAN}Pre-release checks:${NC}"
echo -e "${CYAN}-------------------${NC}"

# Run tests
echo -e "${YELLOW}Running tests...${NC}"
if ! go test -v ./...; then
    echo -e "${RED}Tests failed! Please fix them before releasing.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ All tests passed${NC}"

# Extract and validate changelog
echo ""
echo -e "${BOLD}${CYAN}Extracting release notes from CHANGELOG.md:${NC}"
echo -e "${CYAN}-------------------------------------------${NC}"

CHANGELOG_CONTENT=$(get_version_changelog)

if [ -z "$CHANGELOG_CONTENT" ] || [ "$CHANGELOG_CONTENT" = "" ]; then
    echo -e "${RED}Error: No changelog found for version ${APP_VERSION} in CHANGELOG.md${NC}"
    echo -e "${YELLOW}Please add release notes for version ${APP_VERSION} in docs/CHANGELOG.md${NC}"
    echo ""
    echo -e "${BOLD}Expected format:${NC}"
    echo -e "## [${APP_VERSION}] - YYYY-MM-DD"
    echo -e ""
    echo -e "Description of changes..."
    exit 1
fi

# Display changelog and ask for confirmation
echo -e "${GREEN}Found changelog:${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "$CHANGELOG_CONTENT"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
read -p "Are you satisfied with these release notes? (y/N): " changelog_confirm

if [ "$changelog_confirm" != "y" ] && [ "$changelog_confirm" != "Y" ]; then
    echo -e "${YELLOW}Please update the changelog in docs/CHANGELOG.md and try again.${NC}"
    exit 0
fi

echo ""
echo -e "${BOLD}${YELLOW}Ready to create release v${APP_VERSION}${NC}"
echo -e "${YELLOW}This will:${NC}"
echo -e "  1. Create git tag ${TAG_NAME}"
echo -e "  2. Push tag to GitHub"
echo -e "  3. Trigger automatic build and release via GitHub Actions"
echo ""
read -p "Continue? (y/N): " confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo -e "${YELLOW}Release cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${BOLD}${CYAN}Creating release...${NC}"

# Create lightweight tag
echo -e "${YELLOW}Creating tag ${TAG_NAME}...${NC}"
git tag "$TAG_NAME"

# Push tag
echo -e "${YELLOW}Pushing tag to GitHub...${NC}"
git push origin "$TAG_NAME"

echo ""
echo -e "${BOLD}${GREEN}✓ Release initiated successfully!${NC}"
echo ""
echo -e "${CYAN}GitHub Actions is now:${NC}"
echo -e "  • Running tests"
echo -e "  • Building bundle with modern tooling"
echo -e "  • Building binaries for all platforms"
echo -e "  • Creating release archives"
echo -e "  • Publishing to GitHub Releases"
echo ""
echo -e "${BOLD}Monitor progress:${NC}"
echo -e "  https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions"
echo ""
echo -e "${BOLD}Release page:${NC}"
echo -e "  https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/releases/tag/$TAG_NAME"
echo ""
