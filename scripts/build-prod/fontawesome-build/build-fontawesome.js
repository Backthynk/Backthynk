#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Font Awesome 6 unicode mappings
const ICON_UNICODES = {
  'fa-arrow-left': '\\f060',
  'fa-chevron-down': '\\f078',
  'fa-chevron-left': '\\f053',
  'fa-chevron-right': '\\f054',
  'fa-ellipsis-h': '\\f141',
  'fa-times': '\\f00d',
  'fa-plus': '\\f067',
  'fa-edit': '\\f044',
  'fa-trash-alt': '\\f2ed',
  'fa-save': '\\f0c7',
  'fa-undo': '\\f0e2',
  'fa-exchange-alt': '\\f362',
  'fa-sync': '\\f021',
  'fa-cog': '\\f013',
  'fa-sitemap': '\\f0e8',
  'fa-file': '\\f15b',
  'fa-file-alt': '\\f15c',
  'fa-file-pdf': '\\f1c1',
  'fa-file-word': '\\f1c2',
  'fa-file-excel': '\\f1c3',
  'fa-file-powerpoint': '\\f1c4',
  'fa-file-archive': '\\f1c6',
  'fa-file-audio': '\\f1c7',
  'fa-file-video': '\\f1c8',
  'fa-folder': '\\f07b',
  'fa-folder-open': '\\f07c',
  'fa-folder-plus': '\\f65e',
  'fa-image': '\\f03e',
  'fa-paperclip': '\\f0c6',
  'fa-paper-plane': '\\f1d8',
  'fa-sort-alpha-down': '\\f15d',
  'fa-sort-alpha-up': '\\f15e',
  'fa-sort-numeric-down': '\\f162',
  'fa-sort-numeric-up': '\\f163',
  'fa-spinner': '\\f110',
  'fa-exclamation-triangle': '\\f071',
  'fa-inbox': '\\f01c',
  'fa-clock': '\\f017',
  'fa-link': '\\f0c1',
  'fa-external-link-alt': '\\f35d',
  'fa-code': '\\f121',
  'fa-terminal': '\\f120',
  'fa-database': '\\f1c0',
  'fa-table': '\\f0ce',
  'fa-music': '\\f001',
  'fa-play-circle': '\\f144',
  'fa-coffee': '\\f0f4',
  'fa-gem': '\\f3a5',
  'fa-palette': '\\f53f',
  'fa-chart-line': '\\f201'
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

      // Regex to match Font Awesome icon classes: fa-xxx or fa-xxx-yyy (but not partial matches or template literals)
      const iconRegex = /(?:class=["'][^"']*\s|class=["'])fa-[a-z]+(?:-[a-z]+)*(?=\s|["'])/g;
      const matches = content.match(iconRegex);

      if (matches) {
        matches.forEach(match => {
          // Extract just the fa-xxx part
          const iconMatch = match.match(/fa-[a-z]+(?:-[a-z]+)*/);
          if (iconMatch) {
            const cleanIcon = iconMatch[0];
            if (cleanIcon.startsWith('fa-') && cleanIcon.length > 3) {
              usedIcons.add(cleanIcon);
            }
          }
        });
      }
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
  let css = `/* Font Awesome Optimized Build */
/* Generated automatically from icons found in web/ directory */
/* Icons included: ${usedIcons.join(', ')} */


/* Base Font Awesome styles */
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