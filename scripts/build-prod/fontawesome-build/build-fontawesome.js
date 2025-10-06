#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Font Awesome 6 unicode mappings
const ICON_UNICODES = {
  'fa-arrow-left': '\\f060',
  'fa-chart-line': '\\f201',
  'fa-chevron-down': '\\f078',
  'fa-chevron-left': '\\f053',
  'fa-chevron-right': '\\f054',
  'fa-clock': '\\f017',
  'fa-code': '\\f121',
  'fa-coffee': '\\f0f4',
  'fa-cog': '\\f013',
  'fa-database': '\\f1c0',
  'fa-edit': '\\f044',
  'fa-ellipsis-h': '\\f141',
  'fa-exchange-alt': '\\f362',
  'fa-exclamation-triangle': '\\f071',
  'fa-external-link-alt': '\\f35d',
  'fa-file': '\\f15b',
  'fa-file-alt': '\\f15c',
  'fa-file-archive': '\\f1c6',
  'fa-file-audio': '\\f1c7',
  'fa-file-excel': '\\f1c3',
  'fa-file-pdf': '\\f1c1',
  'fa-file-powerpoint': '\\f1c4',
  'fa-file-video': '\\f1c8',
  'fa-file-word': '\\f1c2',
  'fa-folder': '\\f07b',
  'fa-folder-open': '\\f07c',
  'fa-folder-plus': '\\f65e',
  'fa-gem': '\\f3a5',
  'fa-image': '\\f03e',
  'fa-inbox': '\\f01c',
  'fa-link': '\\f0c1',
  'fa-music': '\\f001',
  'fa-palette': '\\f53f',
  'fa-paper-plane': '\\f1d8',
  'fa-paperclip': '\\f0c6',
  'fa-play-circle': '\\f144',
  'fa-plus': '\\f067',
  'fa-save': '\\f0c7',
  'fa-sitemap': '\\f0e8',
  'fa-sort-alpha-down': '\\f15d',
  'fa-sort-alpha-up': '\\f15e',
  'fa-sort-numeric-down': '\\f162',
  'fa-sort-numeric-up': '\\f163',
  'fa-spinner': '\\f110',
  'fa-sync': '\\f021',
  'fa-table': '\\f0ce',
  'fa-terminal': '\\f120',
  'fa-times': '\\f00d',
  'fa-trash-alt': '\\f2ed',
  'fa-undo': '\\f0e2'
};

// Scan files in the web directory for Font Awesome icon usage
function scanForIcons(webDir) {
  const usedIcons = new Set();
  const fileExtensions = ['.html', '.js', '.css'];

  function scanDirectory(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(dir, file.name);

      if (file.isDirectory()) {
        scanDirectory(fullPath);
      } else if (fileExtensions.some(ext => file.name.endsWith(ext))) {
        scanFile(fullPath);
      }
    }
  }

  function scanFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Utility classes that are not actual icons (handled separately in CSS)
      const utilityClasses = new Set(['fa-spin', 'fa-pulse', 'fa-fw', 'fa-li', 'fa-border', 'fa-pull-left', 'fa-pull-right',
                                       'fa-stack', 'fa-stack-1x', 'fa-stack-2x', 'fa-inverse', 'fa-flip-horizontal',
                                       'fa-flip-vertical', 'fa-rotate-90', 'fa-rotate-180', 'fa-rotate-270']);

      // Multiple regex patterns to catch different icon usage patterns
      const patterns = [
        // class="fas fa-icon-name" or class="far fa-icon-name"
        /(?:class=["'][^"']*\s|class=["'])fa-[a-z]+(?:-[a-z]+)*(?=\s|["'])/g,
        // data-asc="fa-icon" or data-desc="fa-icon" or similar data attributes
        /data-[a-z]+\s*=\s*["']fa-[a-z]+(?:-[a-z]+)*["']/g,
        // icon: 'fa-icon-name' in JS objects
        /icon:\s*['"]fa-[a-z]+(?:-[a-z]+)*['"]/g,
        // Template literals with dynamic parts: fa-folder${...} captures fa-folder
        /fa-[a-z]+(?:-[a-z]+)*(?=\$\{|['"`])/g,
        // String concatenation: 'fa-icon' or "fa-icon"
        /['"]fa-[a-z]+(?:-[a-z]+)*['"]/g
      ];

      patterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach(match => {
            // Extract all fa-xxx patterns from the match
            const iconMatches = match.match(/fa-[a-z]+(?:-[a-z]+)*/g);
            if (iconMatches) {
              iconMatches.forEach(icon => {
                // Filter out utility classes and incomplete icons
                if (icon.startsWith('fa-') && icon.length > 3 && !utilityClasses.has(icon)) {
                  usedIcons.add(icon);
                }
              });
            }
          });
        }
      });

      // Special handling for dynamic template literals like:
      // - fa-folder${isSelected ? '-open' : ''} -> captures fa-folder and fa-folder-open
      // - fa-chevron-${isExpanded ? 'down' : 'right'} -> captures fa-chevron-down and fa-chevron-right
      const patterns2 = [
        // Pattern 1: fa-folder${...'-open'...}
        /fa-([a-z]+(?:-[a-z]+)*)\$\{[^}]*['"]-([a-z]+(?:-[a-z]+)*)['"]/g,
        // Pattern 2: fa-chevron-${...'down'...'right'...}
        /fa-([a-z]+)-\$\{[^}]*['"]([a-z]+(?:-[a-z]+)*)['"][^}]*['"]([a-z]+(?:-[a-z]+)*)['"]/g
      ];

      patterns2.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          if (match.length === 3) {
            // Pattern 1: base icon + suffix
            const baseIcon = `fa-${match[1]}`;
            const suffixIcon = `fa-${match[1]}-${match[2]}`;
            if (!utilityClasses.has(baseIcon)) usedIcons.add(baseIcon);
            if (!utilityClasses.has(suffixIcon)) usedIcons.add(suffixIcon);
          } else if (match.length === 4) {
            // Pattern 2: base + two alternatives
            const option1 = `fa-${match[1]}-${match[2]}`;
            const option2 = `fa-${match[1]}-${match[3]}`;
            if (!utilityClasses.has(option1)) usedIcons.add(option1);
            if (!utilityClasses.has(option2)) usedIcons.add(option2);
          }
        }
      });
    } catch (error) {
      console.warn(`Warning: Could not read file ${filePath}: ${error.message}`);
    }
  }

  console.log(`🔍 Scanning ${webDir} for Font Awesome icons...`);
  scanDirectory(webDir);

  const iconsArray = Array.from(usedIcons).sort();
  console.log(`📊 Found ${iconsArray.length} unique icons:`, iconsArray.join(', '));

  return iconsArray;
}

// Generate CSS content for the discovered icons
function generateIconCSS(usedIcons) {
  let css = `/* Base Font Awesome styles */
.fas, .far {
  font-family: "Font Awesome 6 Free";
  font-weight: 900;
  font-style: normal;
  font-variant: normal;
  text-rendering: auto;
  line-height: 1;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.far {
  font-weight: 400;
}

/* Font face definitions */
@font-face {
  font-family: "Font Awesome 6 Free";
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/webfonts/fa-regular-400.woff2") format("woff2");
}

@font-face {
  font-family: "Font Awesome 6 Free";
  font-style: normal;
  font-weight: 900;
  font-display: block;
  src: url("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/webfonts/fa-solid-900.woff2") format("woff2");
}

/* Icon definitions */
`;

  // Generate CSS for each discovered icon
  usedIcons.forEach(iconClass => {
    const unicode = ICON_UNICODES[iconClass];
    if (unicode) {
      css += `.${iconClass}::before { content: "${unicode}"; }\n`;
    } else {
      console.warn(`⚠️  Warning: Unicode not found for icon '${iconClass}' - skipping`);
    }
  });

  // Always add spin animation as it's a utility class
  css += `
/* Animations */
.fa-spin {
  animation: fa-spin 2s infinite linear;
}

@keyframes fa-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;

  return css;
}

// Main build function
function buildFontAwesome() {
  try {
    console.log('🔧 Building optimized Font Awesome CSS...');

    // Path to web directory
    const webDir = path.join(__dirname, '../../../web');

    if (!fs.existsSync(webDir)) {
      throw new Error(`Web directory not found: ${webDir}`);
    }

    // Scan for used icons
    const usedIcons = scanForIcons(webDir);

    if (usedIcons.length === 0) {
      console.warn('⚠️  No Font Awesome icons found in web directory');
      return false;
    }

    // Generate CSS
    const css = generateIconCSS(usedIcons);
    const outputPath = path.join(__dirname, '../../../scripts/.cache/fontawesome-optimized.css');

    // Ensure cache directory exists
    const cacheDir = path.dirname(outputPath);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Write the optimized CSS
    fs.writeFileSync(outputPath, css);

    const stats = fs.statSync(outputPath);
    const sizeKB = (stats.size / 1024).toFixed(2);

    console.log(`✅ Font Awesome build complete!`);
    console.log(`   📁 Output: ${outputPath}`);
    console.log(`   📊 Size: ${sizeKB} KB`);
    console.log(`   🎯 Icons included: ${usedIcons.length}`);

    return true;
  } catch (error) {
    console.error('❌ Font Awesome build failed:', error.message);
    return false;
  }
}

// Run the build if this script is executed directly
if (require.main === module) {
  const success = buildFontAwesome();
  process.exit(success ? 0 : 1);
}

module.exports = { buildFontAwesome };