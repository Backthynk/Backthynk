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
