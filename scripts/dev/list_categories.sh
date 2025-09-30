#!/bin/bash

# Backthynk Categories Lister
# ============================
#
# This script lists all available categories in the Backthynk instance.
# Useful for finding category IDs before running other development scripts.
#
# USAGE:
#   ./scripts/dev/list_categories.sh
#
# REQUIREMENTS:
#   - Server must be running (port configured in service.json or set BACKTHYNK_URL environment variable)
#   - curl and jq must be installed

set -e

# Load common utilities
source "$(dirname "$0")/../common/common.sh"

# Check dependencies and load configuration
check_dependencies curl jq
load_config

BACKTHYNK_URL=${BACKTHYNK_URL:-"http://localhost:$SERVER_PORT"}
API_BASE="$BACKTHYNK_URL/api"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Backthynk Categories${NC}"
echo "===================="
echo ""
echo -e "Server: ${YELLOW}$BACKTHYNK_URL${NC}"
echo ""

# Check server connectivity
if ! curl -s --max-time 5 "$BACKTHYNK_URL" > /dev/null; then
    echo -e "${RED}Error: Cannot connect to server at $BACKTHYNK_URL${NC}"
    echo "Make sure the server is running or set BACKTHYNK_URL environment variable"
    exit 1
fi

# Fetch categories
CATEGORIES_RESPONSE=$(curl -s "$API_BASE/categories")
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to fetch categories${NC}"
    exit 1
fi

# Check if we have any categories
CATEGORY_COUNT=$(echo "$CATEGORIES_RESPONSE" | jq length)
if [ "$CATEGORY_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}No categories found${NC}"
    echo "Create some categories in the web interface before generating posts."
    exit 0
fi

echo -e "${GREEN}Found $CATEGORY_COUNT categories:${NC}"
echo ""

# Display categories in a nice format
echo "$CATEGORIES_RESPONSE" | jq -r '.[] | "  ID: \(.id) - \(.name)\(if .description and .description != "" then " (\(.description))" else "" end)"' | sort -n
