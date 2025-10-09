
// Simple client-side router for SPA functionality
class Router {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.currentSpacePath = null;

        // Handle browser back/forward buttons
        window.addEventListener('popstate', (e) => {
            this.handleRoute(window.location.pathname, false);
        });
    }

    // Register a route
    addRoute(path, handler) {
        this.routes.set(path, handler);
    }

    // Navigate to a route programmatically
    navigate(path, addToHistory = true) {
        if (addToHistory) {
            window.history.pushState({}, '', path);
        }
        this.handleRoute(path, false);
    }

    // Handle route changes
    handleRoute(path, addToHistory = true) {
        // Clean up path (remove trailing slash unless root)
        const cleanPath = path === '/' ? '/' : path.replace(/\/$/, '');

        if (this.routes.has(cleanPath)) {
            this.currentRoute = cleanPath;
            this.currentSpacePath = null;
            const handler = this.routes.get(cleanPath);
            handler();
        } else if (this.isSpacePath(cleanPath)) {
            // Handle space paths like /cat1/cat2/cat3
            this.currentRoute = 'space';
            this.currentSpacePath = cleanPath;
            this.handleSpaceRoute(cleanPath);
        } else {
            // Default to home route
            this.currentRoute = '/';
            this.currentSpacePath = null;
            if (this.routes.has('/')) {
                this.routes.get('/')();
            }
        }
    }

    // Initialize router with current URL
    init() {
        // If this looks like a space path, wait for spaces to load
        if (this.isSpacePath(window.location.pathname)) {
            // Don't handle the route yet - let fetchSpaces handle it
            return;
        }

        // Handle non-space routes immediately
        this.handleRoute(window.location.pathname, false);
    }

    // Get current route
    getCurrentRoute() {
        return this.currentRoute;
    }

    // Get current space path
    getCurrentSpacePath() {
        return this.currentSpacePath;
    }

    // Check if path is a space path
    isSpacePath(path) {
        if (path === '/')
            return false
        // Space paths start with / and contain only valid space name characters
        // They shouldn't match existing static routes
        for (const r of window.AppConstants.RESERVED_ROUTES){
            if (path === ('/'+r)){
                return false
            }
        }

        // Must start with / and contain valid characters for space names
        // Allow URL-encoded characters (like %20 for spaces) and regular space name characters
        return /^\/[a-zA-Z0-9\s\/%]+$/.test(path) && !path.includes('//');
    }

    // Handle space routing
    async handleSpaceRoute(path) {
        // Wait for spaces to be loaded
        if (typeof spaces === 'undefined' || !spaces || spaces.length === 0) {
            // Spaces not loaded yet, wait and try again
            setTimeout(() => this.handleSpaceRoute(path), 100);
            return;
        }

        const space = this.findSpaceByPath(path);
        if (space) {
            // Navigate to space page and select the space
            await this.showSpacePage(space);
        } else {
            // Space not found, redirect to home
            this.navigate('/', true);
        }
    }

    // Find space by URL path
    findSpaceByPath(path) {
        const pathParts = path.split('/').filter(part => part.length > 0);
        if (pathParts.length === 0) return null;

        let currentSpace = null;
        let currentLevel = spaces.filter(cat => !cat.parent_id);

        for (let i = 0; i < pathParts.length; i++) {
            const pathPart = pathParts[i];
            const decodedPart = decodeURIComponent(pathPart);

            currentSpace = currentLevel.find(cat =>
                cat.name.toLowerCase() === decodedPart.toLowerCase()
            );

            if (!currentSpace) {
                return null; // Space not found
            }


            // Get children for next level
            currentLevel = spaces.filter(cat => cat.parent_id === currentSpace.id);
        }

        return currentSpace;
    }

    // Build URL path from space
    buildSpacePath(space) {
        const path = [];
        let current = space;

        while (current) {
            path.unshift(encodeURIComponent(current.name));
            if (current.parent_id) {
                current = spaces.find(cat => cat.id === current.parent_id);
            } else {
                current = null;
            }
        }

        return '/' + path.join('/');
    }

    // Show space page
    async showSpacePage(space) {
        // Ensure we're on the home page layout
        const mainContainer = document.querySelector('.container');
        const settingsPage = document.getElementById('settings-page');

        if (mainContainer) mainContainer.style.display = 'block';
        if (settingsPage) settingsPage.classList.add('hidden');

        // Directly select the space without any intermediate steps
        if (typeof selectSpace === 'function') {
            selectSpace(space, false); // fromUserClick = false (programmatic)
        }

        // Update page title for space using breadcrumb (matches backend behavior)
        const settings = await loadAppSettings();
        const siteTitle = settings?.siteTitle || window.AppConstants.APP_NAME;
        if (space && space.id) {
            const breadcrumb = typeof getSpaceBreadcrumb === 'function'
                ? getSpaceBreadcrumb(space.id)
                : space.name;
            document.title = `${breadcrumb}`;
        }
    }

    // Navigate to space by space object
    navigateToSpace(space) {
        if (!space) {
            this.navigate('/');
            return;
        }

        const path = this.buildSpacePath(space);
        this.navigate(path);
    }

    // Check for cached space and redirect if needed
    checkCachedSpaceRedirect() {
        // Only check if we're on the root path
        if (window.location.pathname !== '/') return false;

        // Check if there's a cached space selection
        const lastSpaceId = localStorage.getItem(window.AppConstants.STORAGE_KEYS.lastSpace);
        if (lastSpaceId && spaces && spaces.length > 0) {
            const space = spaces.find(cat => cat.id === parseInt(lastSpaceId));
            if (space) {
                // Redirect to the space URL
                const spacePath = this.buildSpacePath(space);
                this.navigate(spacePath, true);
                return true;
            }
        }
        return false;
    }
}

// Create global router instance
const router = new Router();

// Route handlers
async function showHomePage() {
    // Show main container, hide settings page
    const mainContainer = document.querySelector('.container');
    const settingsPage = document.getElementById('settings-page');

    if (mainContainer) mainContainer.style.display = 'block';
    if (settingsPage) settingsPage.classList.add('hidden');

    // Get site title from settings or use default
    const settings = await loadAppSettings();
    const siteTitle = settings?.siteTitle || window.AppConstants.APP_NAME;
    document.title = `${siteTitle}`;

    // If there's a current space, deselect it to show all posts
    if (typeof currentSpace !== 'undefined' && currentSpace && currentSpace.id !== window.AppConstants?.ALL_SPACES_ID) {
        if (typeof deselectSpace === 'function') {
            deselectSpace();
        }
    }
}

async function showSettingsPage() {
    // Hide main container, show settings page
    const mainContainer = document.querySelector('.container');
    const settingsPage = document.getElementById('settings-page');

    if (mainContainer) mainContainer.style.display = 'none';
    if (settingsPage) settingsPage.classList.remove('hidden');

    // Load and populate settings
    try {
        if (typeof loadSettings === 'function') {
            await loadSettings();
        }
        if (typeof populateSettingsForm === 'function') {
            populateSettingsForm();
        }

        // Get site title from settings or use default
        const settings = await loadAppSettings();
        const siteTitle = settings?.siteTitle || window.AppConstants.APP_NAME;
        document.title = `${siteTitle} - Settings`;
    } catch (error) {
        console.error('Failed to load settings:', error);
        if (typeof showError === 'function') {
            showError(formatMessage(window.AppConstants.USER_MESSAGES.error.failedToLoadSettings, error.message));
        }
    }
}

// Register routes
router.addRoute('/', showHomePage);
router.addRoute('/settings', showSettingsPage);

// Initialize router when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    router.init();
});

// Export for use in other files
window.router = router;