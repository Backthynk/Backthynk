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