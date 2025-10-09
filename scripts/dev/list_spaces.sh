#!/bin/bash

# Spaces Lister
# ============================
#
# This script lists all available spaces in the instance.
# Useful for finding space IDs before running other development scripts.
#
# USAGE:
#   ./scripts/dev/list_spaces.sh
#
# REQUIREMENTS:
#   - Server must be running (port configured in service.json or set APP_URL environment variable)
#   - curl and jq must be installed

set -e

# Load common utilities
source "$(dirname "$0")/../common/common.sh"

# Check dependencies and load configuration
check_dependencies curl jq
load_config

APP_URL=${APP_URL:-"http://localhost:$SERVER_PORT"}
API_BASE="$APP_URL/api"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE} Spaces${NC}"
echo "===================="
echo ""
echo -e "Server: ${YELLOW}$APP_URL${NC}"
echo ""

# Check server connectivity
if ! curl -s --max-time 5 "$APP_URL" > /dev/null; then
    echo -e "${RED}Error: Cannot connect to server at $APP_URL${NC}"
    echo "Make sure the server is running or set APP_URL environment variable"
    exit 1
fi

# Fetch spaces
SPACES_RESPONSE=$(curl -s "$API_BASE/spaces")
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to fetch spaces${NC}"
    exit 1
fi

# Check if we have any spaces
SPACE_COUNT=$(echo "$SPACES_RESPONSE" | jq length)
if [ "$SPACE_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}No spaces found${NC}"
    echo "Create some spaces in the web interface before generating posts."
    exit 0
fi

echo -e "${GREEN}Found $SPACE_COUNT spaces:${NC}"
echo ""

# Display spaces in a nice format
echo "$SPACES_RESPONSE" | jq -r '.[] | "  ID: \(.id) - \(.name)\(if .description and .description != "" then " (\(.description))" else "" end)"' | sort -n
