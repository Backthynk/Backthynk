// Application Configuration Constants

// Special Category IDs
const ALL_CATEGORIES_ID = 0; // Category ID 0 represents "all categories"

// Default Application Settings
const DEFAULT_SETTINGS = {
    maxFileSizeMB: 100,
    maxContentLength: 15000,
    maxFilesPerPost: 20,
    storagePath: '.storage',
    activityEnabled: true,
    fileStatsEnabled: true
};

// Validation Limits
const VALIDATION_LIMITS = {
    minFileSizeMB: 1,
    maxFileSizeMB: 10240, // 10GB
    minContentLength: 100,
    maxContentLength: 50000,
    minFilesPerPost: 1,
    maxFilesPerPost: 50
};

// Error Messages
const ERROR_MESSAGES = {
    fileSizeValidation: 'Maximum file size must be between 1MB and 10,240MB (10GB)',
    contentLengthValidation: 'Maximum content length must be between 100 and 50,000 characters',
    filesPerPostValidation: 'Maximum files per post must be between 1 and 50'
};

// UI Configuration
const UI_CONFIG = {
    // Post Management
    defaultPostLimit: 20,
    maxPostLimit: 100,
    defaultOffset: 0,

    // Pagination & Batch Processing
    batchProcessLimit: 100,
    virtualScrollBuffer: 5,
    defaultItemHeight: 200,
    postsVirtualScrollHeight: 250,

    // Activity Tracker
    activityPeriodMonths: 6,
    heatmapSquaresPerRow: 12,
    currentActivityPeriod: 0,

    // File Management
    maxImagePreviewWidth: 12, // w-12 (48px)
    maxImagePreviewHeight: 12, // h-12 (48px)
    maxFilenameDisplay: 200, // pixels

    // Link Preview
    maxUrlDisplayLength: 30,

    // Image Viewer
    defaultImageIndex: 0,

    // UI Timing
    debounceDelay: 500,
    successMessageDelay: 1500,
    scrollThreshold: 50,
    settingsTransitionDelay: 100,

    // File Size Display
    fileSizeUnit: 1024,

    // Time Display
    minutesInMs: 60 * 1000,
    hoursInMs: 60 * 60 * 1000,
    daysInMs: 24 * 60 * 60 * 1000,
    weekInDays: 7
};

// Activity Level Mapping for Heatmap
const ACTIVITY_LEVELS = {
    none: 0,
    low: 1,
    medium: 2,
    high: 3,
    veryHigh: 4
};

// Activity Level Thresholds
const ACTIVITY_THRESHOLDS = {
    low: 1,
    medium: 3,
    high: 5
};

// CSS Classes for Activity Levels
const ACTIVITY_CLASSES = [
    'bg-gray-100',           // No activity
    'bg-green-200',          // Low activity
    'bg-green-300',          // Medium activity
    'bg-green-400',          // High activity
    'bg-green-500'           // Very high activity
];

// Export all constants
window.AppConstants = {
    ALL_CATEGORIES_ID,
    DEFAULT_SETTINGS,
    VALIDATION_LIMITS,
    ERROR_MESSAGES,
    UI_CONFIG,
    ACTIVITY_LEVELS,
    ACTIVITY_THRESHOLDS,
    ACTIVITY_CLASSES
};