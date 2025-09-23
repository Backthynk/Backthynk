# Modular JavaScript Architecture

This directory contains the modularized JavaScript code for the Backthynk web application, organized into logical modules for better maintainability.

## File Structure

### Core Modules
- **`state.js`** - Global state variables and localStorage management
- **`utils.js`** - Utility functions (escapeHtml, formatFileSize, formatRelativeDate, etc.)
- **`api.js`** - All API communication functions

### Feature Modules
- **`categoryManager.js`** - Category rendering, creation, deletion, and selection
- **`postManager.js`** - Post display, creation, and deletion functionality
- **`fileManager.js`** - File upload, selection, and preview management
- **`imageViewer.js`** - Image gallery and viewer functionality
- **`activityTracker.js`** - Activity heatmap and statistics tracking
- **`ui.js`** - General UI functions and modal management

### Initialization
- **`main.js`** - Event listeners and application initialization

## Load Order

Scripts must be loaded in this order to ensure dependencies are available:

1. `state.js` - Global variables
2. `utils.js` - Utility functions
3. `api.js` - API functions
4. `ui.js` - UI functions
5. `categoryManager.js` - Category management
6. `postManager.js` - Post management
7. `fileManager.js` - File management
8. `imageViewer.js` - Image viewer
9. `activityTracker.js` - Activity tracking
10. `main.js` - Event listeners and initialization

## Benefits

- **Maintainability**: Code is organized by functionality
- **Readability**: Each file has a single responsibility
- **Debugging**: Easier to locate and fix issues
- **Performance**: Better browser caching of individual modules
- **Collaboration**: Multiple developers can work on different modules

## Removed Code

The following unused functions were removed during the reorganization:
- `createImageGrid()`
- `createCompactFileCard()`
- `loadMarkdownPreview()`
- `loadCodePreview()`
- `openImageViewer()`
- `createSmartImageGallery()`
- `createSmartFileGrid()`
- `createElegantFileCard()`
- `togglePostContent()`
- `toggleAllFiles()`
- `generateHeatmapGrid()`