#!/bin/bash

# Test script for Backthynk server
source "$(dirname "$0")/../common/load-config.sh"

echo -e "${BLUE}▶${NC} Running tests..."
go test ./... -short
