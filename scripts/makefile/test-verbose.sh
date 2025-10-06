#!/bin/bash

# Verbose test script for Backthynk server
source "$(dirname "$0")/../common/load-config.sh"

echo -e "${BLUE}▶${NC} Running tests (verbose)..."
go test ./... -v -short
