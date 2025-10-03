// Global state management
let currentCategory = null;
let categories = [];
let expandedCategories = new Set();
let selectedFiles = new Map(); // Store selected files with unique IDs
let fileCounter = 0;
let modalSelectedFiles = new Map(); // Store modal-specific selected files
let modalFileCounter = 0;
let currentImageGallery = [];
let currentImageIndex = window.AppConstants.UI_CONFIG.defaultImageIndex;
let categoryStats = {};
let globalStats = { totalPosts: 0, totalFiles: 0, totalSize: 0 };
let categoryActivity = {};
let currentActivityPeriod = window.AppConstants.UI_CONFIG.currentActivityPeriod; // 0 = current 6 months, -1 = previous 6 months, etc.
let activityEnabled = true; // Global activity system state
let fileStatsEnabled = true; // Global file statistics system state

// Local storage for last selected category
function saveLastCategory(categoryId) {
    localStorage.setItem(window.AppConstants.STORAGE_KEYS.lastCategory, categoryId);
}

function getLastCategory() {
    return localStorage.getItem(window.AppConstants.STORAGE_KEYS.lastCategory);
}

function saveExpandedCategories() {
    localStorage.setItem(window.AppConstants.STORAGE_KEYS.expandedCategories, JSON.stringify([...expandedCategories]));
}

function loadExpandedCategories() {
    const saved = localStorage.getItem(window.AppConstants.STORAGE_KEYS.expandedCategories);
    if (saved) {
        expandedCategories = new Set(JSON.parse(saved));
    }
}

// Activity system management
async function checkActivityEnabled() {
    try {
        const settings = window.currentSettings || await loadAppSettings();
        activityEnabled = settings.activityEnabled !== undefined ? settings.activityEnabled : window.AppConstants.DEFAULT_SETTINGS.activityEnabled;
    } catch (error) {
        console.warn('Failed to check activity status, using default:', error);
        activityEnabled = window.AppConstants.DEFAULT_SETTINGS.activityEnabled;
    }

    // Update UI visibility
    updateActivityVisibility();
}

// File statistics system management
async function checkFileStatsEnabled() {
    try {
        const settings = window.currentSettings || await loadAppSettings();
        fileStatsEnabled = settings.fileStatsEnabled !== undefined ? settings.fileStatsEnabled : window.AppConstants.DEFAULT_SETTINGS.fileStatsEnabled;
    } catch (error) {
        console.warn('Failed to check file stats status, using default:', error);
        fileStatsEnabled = window.AppConstants.DEFAULT_SETTINGS.fileStatsEnabled;
    }
}

function updateActivityVisibility() {
    const activityContainer = document.getElementById('activity-container');
    if (activityContainer) {
        if (activityEnabled) {
            // Remove inline style and let CSS classes handle visibility
            // CSS classes: "hidden lg:block" means hidden on mobile, visible on desktop
            activityContainer.style.display = '';
        } else {
            // Force hide when disabled regardless of screen size
            activityContainer.style.display = 'none';
        }
    }
}
