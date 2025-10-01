#!/bin/bash

# Build Component: CDN Caching and Download
# This script downloads and caches CDN packages to avoid repeated downloads

source "$(dirname "$0")/../common/common.sh"
source "$(dirname "$0")/../common/load-config.sh"

log_step "Caching CDN packages..."

# Create cache directory
CACHE_DIR="$SCRIPT_DIR/.cache/cdn"
mkdir -p "$CACHE_DIR"

# Function to get and cache remote file
cache_cdn_resource() {
    local url="$1"
    local name="$2"
    local cache_file="$CACHE_DIR/${name}.cached"
    local size_file="$CACHE_DIR/${name}.size"

    # Check if we have a cached version
    if [ -f "$cache_file" ] && [ -f "$size_file" ]; then
        local cached_size=$(cat "$size_file" 2>/dev/null || echo "0")
        if [ "$cached_size" -gt 0 ] 2>/dev/null; then
            log_substep "Using cached $name ($(numfmt --to=iec-i --suffix=B "$cached_size"))"
        else
            log_substep "Using cached $name"
        fi
        return 0
    fi

    log_substep "Downloading and caching $name from CDN..."

    # Try HEAD request first to get size
    local size=$(curl -sI "$url" 2>/dev/null | grep -i content-length | awk '{print $2}' | tr -d '\r\n')
    if [ -n "$size" ] && [ "$size" -gt 0 ] 2>/dev/null; then
        echo "$size" > "$size_file"
        log_substep "  $name size: $(numfmt --to=iec-i --suffix=B "$size")"
    fi

    # Download the file with timeout
    if timeout 30 curl -sL "$url" -o "$cache_file" 2>/dev/null && [ -s "$cache_file" ]; then
        # If we didn't get size from HEAD, calculate from downloaded file
        if [ ! -s "$size_file" ]; then
            local actual_size=$(du -sb "$cache_file" | awk '{print $1}')
            echo "$actual_size" > "$size_file"
            log_substep "  $name size: $(numfmt --to=iec-i --suffix=B "$actual_size")"
        fi
        log_substep "  Cached $name successfully"
        return 0
    else
        rm -f "$cache_file" "$size_file"
        log_warning "  Failed to download $name from $url"
        return 1
    fi
}

# Function to get cached file size
get_cached_size() {
    local name="$1"
    local size_file="$CACHE_DIR/${name}.size"

    if [ -f "$size_file" ]; then
        cat "$size_file"
    else
        echo "0"
    fi
}

# Cache CDN resources from _script.json
log_substep "Caching CDN resources from configuration..."

# Dynamically cache all CDN resources from configuration
jq -r '.urls.cdn | to_entries[] | "\(.key) \(.value)"' "$SCRIPT_DIR/_script.json" 2>/dev/null | while read -r name url; do
    if [ -n "$name" ] && [ -n "$url" ]; then
        cache_cdn_resource "$url" "$name"
    fi
done

# Export functions and cache directory for other scripts
export CACHE_DIR
export -f get_cached_size

log_success "CDN caching complete"