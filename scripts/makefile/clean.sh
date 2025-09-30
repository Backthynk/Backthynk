#!/bin/bash

# Clean script for Backthynk build artifacts
source "$(dirname "$0")/../common/load-config.sh"

echo -e "${BLUE}▶${NC} Cleaning build artifacts..."

# Clean files
get_clean_files | while read -r file; do
    [ -n "$file" ] && rm -f "$file"
done

# Clean directories
get_clean_dirs | while read -r dir; do
    [ -n "$dir" ] && rm -rf "$dir"
done

# Clean individual files
get_clean_individual_files | while read -r file; do
    [ -n "$file" ] && rm -f "$file"
done

echo -e "${GREEN}✓${NC} Clean complete"