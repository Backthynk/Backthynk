#!/bin/bash

# Test script for Backthynk backend unit tests
source "$(dirname "$0")/../common/load-config.sh"

echo -e "${BLUE}▶${NC} Running backend unit tests..."
eval "$GO_TEST_COMMAND"
echo -e "${GREEN}✓${NC} All tests completed"