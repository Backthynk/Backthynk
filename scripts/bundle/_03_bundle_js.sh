#!/bin/bash

# Bundle Component: JavaScript Bundling with SWC
# Uses @swc/core for optimal JS bundling with better performance than esbuild

source "$(dirname "$0")/../common/common.sh"
source "$(dirname "$0")/../common/load-config.sh"

log_step "Bundling JavaScript with SWC..."

# Use dynamically constructed paths from config
BUNDLE_JS_DIR=$(get_bundle_js_dir)
mkdir -p "$BUNDLE_JS_DIR"

# Use config values - SOURCE_JS is set by load-config.sh
JS_DIR="$PROJECT_ROOT/web/$SOURCE_JS"
BUNDLE_JS="$BUNDLE_JS_DIR/bundle.js"
BUNDLER_DIR="$PROJECT_ROOT/scripts/bundle/js-bundler"

# Create bundler directory if it doesn't exist
mkdir -p "$BUNDLER_DIR"

# Check if package.json exists, create if not
if [ ! -f "$BUNDLER_DIR/package.json" ]; then
    log_substep "Creating package.json for SWC bundler..."
    cat > "$BUNDLER_DIR/package.json" << 'EOF'
{
  "name": "js-bundler",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@swc/core": "^1.10.1"
  }
}
EOF
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "$BUNDLER_DIR/node_modules" ]; then
    log_substep "Installing SWC dependencies..."
    (cd "$BUNDLER_DIR" && npm install --silent)
fi

# Create the bundler script
log_substep "Creating SWC bundler script..."
cat > "$BUNDLER_DIR/bundle.mjs" << 'BUNDLER_EOF'
import { transform } from '@swc/core';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function bundle(files, outputFile, minify = true) {
    console.log(`📦 Bundling ${files.length} JavaScript files...`);

    let bundledCode = '';

    // Read and concatenate all files
    for (const file of files) {
        try {
            const code = readFileSync(file, 'utf-8');
            bundledCode += `\n// Source: ${file}\n${code}\n`;
        } catch (err) {
            console.error(`Error reading ${file}:`, err.message);
            process.exit(1);
        }
    }

    // Transform with SWC
    try {
        const result = await transform(bundledCode, {
            jsc: {
                parser: {
                    syntax: 'ecmascript',
                    jsx: false,
                },
                target: 'es2020',
                minify: minify ? {
                    compress: {
                        unused: true,
                        dead_code: true,
                        conditionals: true,
                        evaluate: true,
                        booleans: true,
                        loops: true,
                        if_return: true,
                        join_vars: true,
                        drop_console: false,
                        drop_debugger: true,
                    },
                    mangle: {
                        toplevel: false,  // Don't mangle top-level names to preserve globals
                        keep_classnames: true,
                        keep_fnames: true,
                    },
                } : undefined,
            },
            minify: minify,
            sourceMaps: !minify,
        });

        writeFileSync(outputFile, result.code);
        console.log(`✓ Bundle created: ${outputFile}`);

        if (result.map) {
            writeFileSync(outputFile + '.map', result.map);
            console.log(`✓ Source map created: ${outputFile}.map`);
        }
    } catch (err) {
        console.error('Error during SWC transformation:', err.message);
        process.exit(1);
    }
}

// Get files from command line arguments
const files = process.argv.slice(2, -2);
const outputFile = process.argv[process.argv.length - 2];
const minify = process.argv[process.argv.length - 1] === 'true';

bundle(files, outputFile, minify);
BUNDLER_EOF

log_substep "Preparing file order..."

# Get priority and last files from JSON
readarray -t PRIORITY_FILES < <(get_js_priority_files)
readarray -t LAST_FILES < <(get_js_last_files)

# Build ordered file list
ORDERED_FILES=()

# Add priority files first
for priority_file in "${PRIORITY_FILES[@]}"; do
    if [ -f "$JS_DIR/$priority_file" ]; then
        ORDERED_FILES+=("$JS_DIR/$priority_file")
    fi
done

# Add remaining files (excluding priority and last files)
for jsfile in "$JS_DIR"/*.js; do
    if [ -f "$jsfile" ]; then
        filename=$(basename "$jsfile")
        # Skip if it's a priority file or last file
        if [[ ! " ${PRIORITY_FILES[@]} " =~ " ${filename} " ]] && [[ ! " ${LAST_FILES[@]} " =~ " ${filename} " ]]; then
            ORDERED_FILES+=("$jsfile")
        fi
    fi
done

# Add last files at the end
for last_file in "${LAST_FILES[@]}"; do
    if [ -f "$JS_DIR/$last_file" ]; then
        ORDERED_FILES+=("$JS_DIR/$last_file")
    fi
done

# Determine minification based on mode
if [ "$MINIFY_MODE" = "full" ]; then
    log_substep "Bundling and minifying JS with SWC..."
    MINIFY_FLAG="true"
else
    log_substep "Debug mode: bundling JS without minification..."
    MINIFY_FLAG="false"
fi

# Run the bundler
node "$BUNDLER_DIR/bundle.mjs" "${ORDERED_FILES[@]}" "$BUNDLE_JS" "$MINIFY_FLAG"

if [ -f "$BUNDLE_JS" ]; then
    BUNDLE_SIZE=$(du -h "$BUNDLE_JS" | cut -f1)
    log_success "JS bundle: $BUNDLE_SIZE"
else
    log_error "Failed to create JS bundle"
    exit 1
fi

log_success "JavaScript bundling complete"
