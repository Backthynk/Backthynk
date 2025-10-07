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
if gh release view "$TAG_NAME" &> /dev/null; then
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

# Prompt for release notes
echo ""
echo -e "${BOLD}${CYAN}Release Notes:${NC}"
echo -e "${CYAN}---------------${NC}"
echo -e "You have two options for adding release notes:"
echo -e "  1. ${BOLD}Annotated tag${NC} - Write notes now (will open editor)"
echo -e "  2. ${BOLD}CHANGELOG.md${NC} - Use existing changelog entry"
echo ""
read -p "Choose method (1 for tag message, 2 for CHANGELOG.md, Enter to skip): " notes_choice

TAG_OPTS=""
if [ "$notes_choice" = "1" ]; then
    echo -e "${YELLOW}Opening editor for release notes...${NC}"
    TAG_OPTS="-a"
elif [ "$notes_choice" = "2" ]; then
    if [ ! -f "docs/CHANGELOG.md" ]; then
        echo -e "${RED}Error: CHANGELOG.md not found.${NC}"
        exit 1
    fi
    echo -e "${GREEN}Using CHANGELOG.md for release notes${NC}"
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

# Create tag
if [ "$notes_choice" = "1" ]; then
    echo -e "${YELLOW}Creating annotated tag (editor will open)...${NC}"
    git tag -a "$TAG_NAME"
else
    echo -e "${YELLOW}Creating tag...${NC}"
    git tag "$TAG_NAME"
fi

# Push tag
echo -e "${YELLOW}Pushing tag to GitHub...${NC}"
git push origin "$TAG_NAME"

echo ""
echo -e "${BOLD}${GREEN}✓ Release initiated successfully!${NC}"
echo ""
echo -e "${CYAN}GitHub Actions is now:${NC}"
echo -e "  • Running tests"
echo -e "  • Building binaries"
echo -e "  • Creating release archive"
echo -e "  • Publishing to GitHub Releases"
echo ""
echo -e "${BOLD}Monitor progress:${NC}"
echo -e "  https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions"
echo ""
echo -e "${BOLD}Release page:${NC}"
echo -e "  https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/releases/tag/$TAG_NAME"
echo ""
