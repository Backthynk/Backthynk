// Application Configuration Constants

// Application Info
const APP_NAME = 'Backthynk';
const APP_TAGLINE = 'Personal Micro Blog';
const APP_DESCRIPTION = 'Personal micro blog platform';

// Reserved Routes (cannot be used as space names)
const RESERVED_ROUTES = [
    'api',
    'static',
    'uploads',
    'settings'
];

// Special Space IDs
const ALL_SPACES_ID = 0; // Space ID 0 represents "all spaces"

// Space Configuration
const MAX_SPACE_DEPTH = 2; // Maximum space depth (0, 1, 2)

// Default Application Settings
const DEFAULT_SETTINGS = {
    maxFileSizeMB: 100,
    maxContentLength: 15000,
    maxFilesPerPost: 20,
    activityEnabled: true,
    fileStatsEnabled: true,
    retroactivePostingEnabled: false,
    retroactivePostingTimeFormat: '24h'
};

// Validation Limits
const VALIDATION_LIMITS = {
    minFileSizeMB: 1,
    maxFileSizeMB: 10240, // 10GB
    minContentLength: 100,
    maxContentLength: 50000,
    minFilesPerPost: 1,
    maxFilesPerPost: 50,
    maxSpaceNameLength: 30,
    maxSpaceDescriptionLength: 280,
    maxSiteTitleLength: 100,
    maxSiteDescriptionLength: 160
};

// User Messages
const USER_MESSAGES = {
    // Success messages
    success: {
        spaceDeleted: 'deleted successfully!',
        postMoved: 'Post successfully moved to',
        settingsSaved: 'Settings saved successfully!'
    },

    // Error messages
    error: {
        spaceNameEmpty: 'Space name cannot be empty',
        spaceNameTooLong: 'Space name must be {0} characters or less',
        spaceNameInvalidChars: 'Space name must start AND end with a letter or number, and can only contain letters, numbers, spaces, hyphens, underscores, apostrophes, and periods (no consecutive special characters)',
        spaceDescTooLong: 'Description cannot exceed {0} characters',
        noSpaceSelected: 'No space selected',
        pleaseSelectSpace: 'Please select a space first',
        contentRequired: 'Content is required',
        contentTooLong: 'Content exceeds maximum length of {0} characters',
        contentExceedsMax: 'Content exceeds maximum length',
        maxFilesExceeded: 'Maximum {0} files allowed per post',
        fileSizeExceeded: 'File "{0}" exceeds maximum file size of {1}MB',
        failedToLoadSettings: 'Failed to load settings: {0}',
        failedToSaveSettings: 'Failed to save settings: {0}',
        failedToDeleteSpace: 'Failed to delete space: {0}',
        failedToDeletePost: 'Failed to delete post: {0}',
        selectSpaceToMove: 'Please select a space to move the post to.'
    },

    // Validation messages
    validation: {
        fileSizeValidation: 'Maximum file size must be between {0}MB and {1}MB ({2}GB)',
        contentLengthValidation: 'Maximum content length must be between {0} and {1} characters',
        filesPerPostValidation: 'Maximum files per post must be between {0} and {1}'
    },

    // Info messages
    info: {
        savingSettings: 'Saving settings...',
        settingsResetInfo: 'Settings reset to defaults (not saved yet). Storage path is not changed as it requires server restart.',
        resetSettingsConfirm: 'Are you sure you want to reset all settings to their default values?',
        loadingMorePosts: 'Loading more posts...',
        noActivityData: 'No activity data available'
    },

    // Confirmation messages
    confirm: {
        unsavedContent: 'You have unsaved content. Are you sure you want to close?',
        deleteSpace: 'Are you sure you want to delete',
        undoWarning: '\n\nThis action cannot be undone.'
    },

    // File upload text template
    fileUpload: {
        dragDropText: 'Or drag and drop files here (max {0} files)'
    }
};

// UI Configuration
const UI_CONFIG = {
    // Post Management
    defaultPostLimit: 20,
    maxPostLimit: 100,
    defaultOffset: 0,

    virtualScrollBuffer: 5,
    defaultItemHeight: 200,
    postsVirtualScrollHeight: 250,

    // Activity Tracker
    heatmapSquaresPerRow: 10,
    currentActivityPeriod: 0,

    // Post loading
    defaultPostsPerPage: 20,
    infiniteScrollThreshold: 1000, // px from bottom to load more
    virtualScrollThreshold: 50, // posts count to enable virtual scrolling
    spaceBatchLimit: 100,

    maxFilenameDisplay: 200, // pixels

    // Link Preview
    maxUrlDisplayLength: 30,

    // Image Viewer
    defaultImageIndex: 0,

    // UI Timing
    debounceDelay: 500,
    successMessageDelay: 1500,
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

// CSS Classes for Activity Levels (Light mode)
const ACTIVITY_CLASSES = [
    'bg-gray-100',           // No activity
    'bg-green-200',          // Low activity
    'bg-green-300',          // Medium activity
    'bg-green-400',          // High activity
    'bg-green-500'           // Very high activity
];

// CSS Classes for Activity Levels (Dark mode) - GitHub dark theme colors
const ACTIVITY_CLASSES_DARK = [
    'dark:bg-gray-700',      // No activity - lighter to be visible on gray-800 background
    'dark:bg-[#0e4429]',     // Low activity
    'dark:bg-[#006d32]',     // Medium activity
    'dark:bg-[#26a641]',     // High activity
    'dark:bg-[#39d353]'      // Very high activity
];

// Global UI Text Constants (for i18n support)
const UI_TEXT = {
    // Common words
    post: 'post',
    posts: 'posts',
    day: 'day',
    days: 'days',
    less: 'Less',
    more: 'More',
    allSpaces: 'All Spaces',

    // File sizes
    bytes: 'Bytes',
    kb: 'KB',
    mb: 'MB',
    gb: 'GB',
    zeroBytes: '0 Bytes',

    // Empty state messages
    noPostsYet: 'Your canvas awaits',
    noPostsYetSubtext: 'Share your first thought and bring this space to life',
    noSpacesYet: 'Begin your journey',
    noSpacesYetSubtext: 'Create your first space to organize your world',
};

// Retroactive Posting Constants
const MIN_RETROACTIVE_POST_TIMESTAMP = 946684800000; // 01/01/2000 00:00:00 UTC in milliseconds

// Locale Settings
const LOCALE_SETTINGS = {
    default: 'en-US'
};

// Date and Time Formats
const DATE_FORMAT = {
    monthStyle: 'short',
    timezone: 'UTC',
    format12h: 'MM/DD/YYYY HH:MM AM/PM',
    format24h: 'DD/MM/YYYY HH:MM'
};

const TIME_FORMAT = {
    am: 'AM',
    pm: 'PM'
};

// Local Storage Keys
const STORAGE_KEYS = {
    lastSpace: 'lastSelectedSpace',
    expandedSpaces: 'expandedSpaces',
    recursiveStates: 'recursiveToggleStates',
    spaceSortPref: 'spaceSortPreference'
};

// File Extensions
const FILE_EXTENSIONS = {
    // Code files
    code: ['.js', '.py', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.go', '.rs', '.ts', '.jsx', '.tsx', '.vue', '.swift', '.kt', '.scala', '.sh', '.bat', '.ps1', '.r', '.m', '.h', '.hpp', '.css', '.scss', '.sass', '.less', '.html', '.xml', '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.sql'],

    // Archive files
    archive: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.tgz'],

    // Document files
    document: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf', '.odt', '.ods', '.odp'],

    // Image files
    image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico', '.tiff', '.tif'],

    // Video files
    video: ['.mp4', '.webm', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.m4v'],

    // Audio files
    audio: ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.wma']
};

// Default allowed file extensions for uploads
const DEFAULT_ALLOWED_EXTENSIONS = 'jpg, jpeg, png, gif, webp, pdf, doc, docx, xls, xlsx, txt, zip, mp4, mov, avi';

// Language to Extension Mapping
const FILE_LANGUAGE_MAP = {
    js: 'JavaScript',
    py: 'Python',
    java: 'Java',
    cpp: 'C++',
    c: 'C',
    cs: 'C#',
    go: 'Go',
    rs: 'Rust'
};

// Video Format Mapping
const VIDEO_FORMAT_MAP = {
    mp4: 'MP4',
    webm: 'WEBM',
    avi: 'AVI',
    mov: 'MOV',
    mkv: 'MKV',
    flv: 'FLV',
    wmv: 'WMV',
    m4v: 'M4V'
};

// Audio Format Mapping
const AUDIO_FORMAT_MAP = {
    mp3: 'MP3',
    wav: 'WAV',
    ogg: 'OGG',
    m4a: 'M4A',
    flac: 'FLAC',
    aac: 'AAC',
    wma: 'WMA'
};

// File Icon Mapping
const FILE_ICON_MAP = {
    // Programming/Code files
    code: { extensions: ['js', 'ts', 'jsx', 'tsx', 'vue', 'react', 'html', 'htm', 'xml', 'py', 'python', 'c', 'cpp', 'cc', 'h', 'hpp', 'cs', 'csharp', 'php', 'go', 'rs', 'rust', 'swift', 'kt', 'kotlin', 'dart', 'm', 'mm', 'scala', 'clj', 'clojure', 'hs', 'haskell', 'lua', 'perl', 'pl'], icon: 'fa-code' },
    palette: { extensions: ['css', 'scss', 'sass', 'less'], icon: 'fa-palette' },
    coffee: { extensions: ['java', 'jar'], icon: 'fa-coffee' },
    gem: { extensions: ['rb', 'ruby'], icon: 'fa-gem' },
    chartLine: { extensions: ['r'], icon: 'fa-chart-line' },
    terminal: { extensions: ['sh', 'bash', 'zsh', 'fish', 'bat', 'cmd', 'ps1', 'powershell'], icon: 'fa-terminal' },

    // Documents
    pdf: { extensions: ['pdf'], icon: 'fa-file-pdf' },
    word: { extensions: ['doc', 'docx'], icon: 'fa-file-word' },
    excel: { extensions: ['xls', 'xlsx'], icon: 'fa-file-excel' },
    powerpoint: { extensions: ['ppt', 'pptx'], icon: 'fa-file-powerpoint' },
    text: { extensions: ['txt', 'text', 'rtf', 'odt', 'ods', 'odp', 'md', 'markdown', 'rst'], icon: 'fa-file-alt' },

    // Media
    image: { extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'tif'], icon: 'fa-image' },
    audio: { extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'], icon: 'fa-file-audio' },
    video: { extensions: ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v'], icon: 'fa-file-video' },

    // Archives
    archive: { extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'], icon: 'fa-file-archive' },

    // Data/Config
    config: { extensions: ['json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf'], icon: 'fa-cog' },
    table: { extensions: ['csv', 'tsv'], icon: 'fa-table' },
    database: { extensions: ['sql', 'db', 'sqlite'], icon: 'fa-database' }
};

// Export all constants
window.AppConstants = {
    // Application Info
    APP_NAME,
    APP_TAGLINE,
    APP_DESCRIPTION,

    // Routes
    RESERVED_ROUTES,

    // Space Constants
    ALL_SPACES_ID,
    MAX_SPACE_DEPTH,

    // Settings and Configuration
    DEFAULT_SETTINGS,
    VALIDATION_LIMITS,
    ERROR_MESSAGES: USER_MESSAGES.validation, // Legacy compatibility
    USER_MESSAGES,
    UI_CONFIG,

    // Activity System
    ACTIVITY_LEVELS,
    ACTIVITY_THRESHOLDS,
    ACTIVITY_CLASSES,
    ACTIVITY_CLASSES_DARK,

    // UI Text
    UI_TEXT,

    // Locale and Formatting
    LOCALE_SETTINGS,
    DATE_FORMAT,
    TIME_FORMAT,

    // Storage
    STORAGE_KEYS,

    // File Management
    FILE_EXTENSIONS,
    DEFAULT_ALLOWED_EXTENSIONS,
    FILE_LANGUAGE_MAP,
    VIDEO_FORMAT_MAP,
    AUDIO_FORMAT_MAP,
    FILE_ICON_MAP,

    // Other
    MIN_RETROACTIVE_POST_TIMESTAMP
};