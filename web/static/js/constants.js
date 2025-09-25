// Application Configuration Constants

// Special Category IDs
const ALL_CATEGORIES_ID = 0; // Category ID 0 represents "all categories"

// Category Configuration
const MAX_CATEGORY_DEPTH = 2; // Maximum category depth (0, 1, 2)

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
    maxFilesPerPost: 50,
    maxCategoryNameLength: 30,
    maxCategoryDescriptionLength: 280
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
    activityPeriodMonths: 4,
    heatmapSquaresPerRow: 10,
    currentActivityPeriod: 0,

    // Post loading
    defaultPostsPerPage: 20,
    infiniteScrollThreshold: 1000, // px from bottom to load more
    virtualScrollThreshold: 50, // posts count to enable virtual scrolling
    categoryBatchLimit: 100,

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

// Global UI Text Constants (for i18n support)
const UI_TEXT = {
    // Common words
    post: 'post',
    posts: 'posts',
    day: 'day',
    days: 'days',
    on: 'on',
    less: 'Less',
    more: 'More',
    all: 'All',
    categories: 'Categories',
    allCategories: 'All Categories',
    settings: 'Settings',

    // Time expressions
    now: 'now',
    ago: 'ago',
    minutesAgo: 'm ago',
    hoursAgo: 'h ago',
    daysAgo: 'd ago',

    // File sizes
    bytes: 'Bytes',
    kb: 'KB',
    mb: 'MB',
    gb: 'GB',
    zeroBytes: '0 Bytes',

    // Common actions
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    update: 'Update',
    loading: 'Loading',

    // Error messages
    error: 'Error',
    failed: 'Failed',
    success: 'Success',

    // Console error messages (for developers, but could be translated)
    failedToLoad: 'Failed to load',
    failedToParse: 'Failed to parse JSON response',
    failedToFetch: 'Failed to fetch',
    failedToCreate: 'Failed to create',
    failedToDelete: 'Failed to delete',
    usingDefaults: 'using defaults',

    // Navigation
    next: 'Next',
    previous: 'Previous',

    // File operations
    file: 'file',
    files: 'files',
    upload: 'Upload',
    download: 'Download',

    // Form labels (common ones found in HTML)
    content: 'Content',
    attachments: 'Attachments',
    createNewPost: 'Create New Post',

    // Settings categories
    fileUploadSettings: 'File Upload Settings',
    contentSettings: 'Content Settings',
    performanceSettings: 'Performance Settings',
    activityTracking: 'Activity Tracking',
    fileStatistics: 'File Statistics',

    // Empty state messages
    noPostsYet: 'No posts yet. Create your first post!',
    noFilesSelected: 'No files selected',
    chooseFiles: 'Choose Files',

    // Punctuation
    ellipsis: '...',
    colon: ':',
    dash: '-'
};

// Export all constants
window.AppConstants = {
    ALL_CATEGORIES_ID,
    MAX_CATEGORY_DEPTH,
    DEFAULT_SETTINGS,
    VALIDATION_LIMITS,
    ERROR_MESSAGES,
    UI_CONFIG,
    ACTIVITY_LEVELS,
    ACTIVITY_THRESHOLDS,
    ACTIVITY_CLASSES,
    UI_TEXT
};