#!/bin/bash

# CSS extraction script
source "$(dirname "$0")/../../common/load-config.sh"

echo -e "${BLUE}▶${NC} Extracting minimal CSS from Tailwind and Font Awesome..."
go run "$(dirname "$0")/../extract-css/main.go"
echo -e "${GREEN}✓${NC} CSS extraction complete"
echo -e "${YELLOW}⚠${NC} Remember to update your HTML to use the minimal CSS files"