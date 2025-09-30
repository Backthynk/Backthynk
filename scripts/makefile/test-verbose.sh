#!/bin/bash

# Verbose test script for Backthynk backend unit tests
source "$(dirname "$0")/../common/load-config.sh"

echo -e "${BLUE}▶${NC} Running backend unit tests with verbose output..."
eval "$GO_TEST_VERBOSE_COMMAND"
echo -e "${GREEN}✓${NC} All tests completed"