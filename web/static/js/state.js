// Global state management
let currentCategory = null;
let categories = [];
let expandedCategories = new Set();
let selectedFiles = new Map(); // Store selected files with unique IDs
let fileCounter = 0;
let currentImageGallery = [];
let currentImageIndex = window.AppConstants.UI_CONFIG.defaultImageIndex;
let categoryStats = {};
let globalStats = { totalPosts: 0, totalFiles: 0, totalSize: 0 };
let categoryActivity = {};
let currentActivityPeriod = window.AppConstants.UI_CONFIG.currentActivityPeriod; // 0 = current 6 months, -1 = previous 6 months, etc.
let activityEnabled = true; // Global activity system state

// Local storage for last selected category
function saveLastCategory(categoryId) {
    localStorage.setItem('lastSelectedCategory', categoryId);
}

function getLastCategory() {
    return localStorage.getItem('lastSelectedCategory');
}

function saveExpandedCategories() {
    localStorage.setItem('expandedCategories', JSON.stringify([...expandedCategories]));
}

function loadExpandedCategories() {
    const saved = localStorage.getItem('expandedCategories');
    if (saved) {
        expandedCategories = new Set(JSON.parse(saved));
    }
}

// Activity system management
async function checkActivityEnabled() {
    try {
        const response = await fetch('/api/activity-enabled');
        if (response.ok) {
            const data = await response.json();
            activityEnabled = data.enabled;
        } else {
            // Fallback to default if API fails
            activityEnabled = window.AppConstants.DEFAULT_SETTINGS.activityEnabled;
        }
    } catch (error) {
        console.warn('Failed to check activity status, using default:', error);
        activityEnabled = window.AppConstants.DEFAULT_SETTINGS.activityEnabled;
    }

    // Update UI visibility
    updateActivityVisibility();
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

// Activity system wrapper - only execute if enabled
function withActivityEnabled(fn) {
    return function(...args) {
        if (activityEnabled) {
            return fn.apply(this, args);
        }
        // Return empty result if activity is disabled
        return Promise.resolve();
    };
}