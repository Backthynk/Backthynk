#!/bin/bash

# Release Status Script
# Check the status of the latest release workflow

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

echo -e "${BOLD}${CYAN}Release Workflow Status${NC}"
echo -e "${CYAN}=======================${NC}"
echo ""

TAG_NAME="v${APP_VERSION}"

# Check if tag exists locally
if ! git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
    echo -e "${RED}Tag $TAG_NAME does not exist locally.${NC}"
    echo -e "${YELLOW}Run 'make release' to create a release.${NC}"
    exit 1
fi

echo -e "${BOLD}Version:${NC} ${TAG_NAME}"
echo ""

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed.${NC}"
    echo -e "${YELLOW}Please install gh: https://cli.github.com/${NC}"
    exit 1
fi

# Get workflow runs for this tag
echo -e "${BOLD}${CYAN}Checking GitHub Actions...${NC}"
echo ""

# Get the latest workflow run for the tag
WORKFLOW_RUN=$(gh run list --workflow=release.yml --json status,conclusion,createdAt,headBranch,databaseId --limit 1 --branch "$TAG_NAME" 2>/dev/null || echo "[]")

if [ "$WORKFLOW_RUN" = "[]" ] || [ -z "$WORKFLOW_RUN" ]; then
    echo -e "${YELLOW}No workflow runs found for tag $TAG_NAME${NC}"
    echo -e "${CYAN}The workflow may not have started yet, or the tag was not pushed.${NC}"
    echo ""
    echo -e "${BOLD}To check all workflows:${NC}"
    echo -e "  https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions"
    exit 0
fi

# Parse workflow status
STATUS=$(echo "$WORKFLOW_RUN" | jq -r '.[0].status')
CONCLUSION=$(echo "$WORKFLOW_RUN" | jq -r '.[0].conclusion')
RUN_ID=$(echo "$WORKFLOW_RUN" | jq -r '.[0].databaseId')

echo -e "${BOLD}Workflow Status:${NC} $STATUS"

if [ "$STATUS" = "completed" ]; then
    if [ "$CONCLUSION" = "success" ]; then
        echo -e "${BOLD}Conclusion:${NC} ${GREEN}✓ Success${NC}"
        echo ""
        echo -e "${GREEN}The release workflow completed successfully!${NC}"
        echo ""

        # Check if release exists
        if gh release view "$TAG_NAME" &> /dev/null; then
            echo -e "${BOLD}${GREEN}✓ Release published${NC}"
            echo ""
            echo -e "${BOLD}Release URL:${NC}"
            echo -e "  https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/releases/tag/$TAG_NAME"
            echo ""
            echo -e "${BOLD}Download statistics:${NC}"
            gh release view "$TAG_NAME" --json assets --jq '.assets[] | "  \(.name): \(.downloadCount) downloads"'
        else
            echo -e "${YELLOW}Warning: Workflow succeeded but release not found${NC}"
        fi
    elif [ "$CONCLUSION" = "failure" ]; then
        echo -e "${BOLD}Conclusion:${NC} ${RED}✗ Failed${NC}"
        echo ""
        echo -e "${RED}The release workflow failed.${NC}"
        echo ""
        echo -e "${BOLD}View logs:${NC}"
        echo -e "  gh run view $RUN_ID --log-failed"
        echo -e "  https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions/runs/$RUN_ID"
        echo ""
        echo -e "${BOLD}To retry:${NC}"
        echo -e "  1. Fix any issues"
        echo -e "  2. Run: ${CYAN}make release-clean${NC}"
        echo -e "  3. Run: ${CYAN}make release${NC}"
    else
        echo -e "${BOLD}Conclusion:${NC} ${YELLOW}$CONCLUSION${NC}"
    fi
elif [ "$STATUS" = "in_progress" ]; then
    echo -e "${YELLOW}The workflow is currently running...${NC}"
    echo ""
    echo -e "${BOLD}Watch progress:${NC}"
    echo -e "  gh run watch $RUN_ID"
    echo -e "  https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions/runs/$RUN_ID"
else
    echo -e "${YELLOW}Status: $STATUS${NC}"
fi

echo ""
echo -e "${BOLD}Workflow URL:${NC}"
echo -e "  https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions/runs/$RUN_ID"
echo ""
