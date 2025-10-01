#!/bin/bash

# Force clean script for Backthynk - removes all cached data and temporary files
source "$(dirname "$0")/../common/load-config.sh"

echo -e "${BLUE}▶${NC} Force cleaning all cached data and temporary files..."

# Clean force clean directories (cache, node_modules, etc.)
get_fclean_dirs | while read -r dir; do
    if [ -n "$dir" ] && [ -d "$dir" ]; then
        echo -e "  ${YELLOW}Removing${NC} $dir"
        rm -rf "$dir"
    elif [ -n "$dir" ] && [ -f "$dir" ]; then
        echo -e "  ${YELLOW}Removing${NC} $dir"
        rm -f "$dir"
    fi
done

echo -e "${GREEN}✓${NC} Force clean complete"