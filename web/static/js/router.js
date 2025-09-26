// Simple client-side router for SPA functionality
class Router {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.currentCategoryPath = null;

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
            this.currentCategoryPath = null;
            const handler = this.routes.get(cleanPath);
            handler();
        } else if (this.isCategoryPath(cleanPath)) {
            // Handle category paths like /cat1/cat2/cat3
            this.currentRoute = 'category';
            this.currentCategoryPath = cleanPath;
            this.handleCategoryRoute(cleanPath);
        } else {
            // Default to home route
            this.currentRoute = '/';
            this.currentCategoryPath = null;
            if (this.routes.has('/')) {
                this.routes.get('/')();
            }
        }
    }

    // Initialize router with current URL
    init() {
        // If this looks like a category path, wait for categories to load
        if (this.isCategoryPath(window.location.pathname)) {
            // Don't handle the route yet - let fetchCategories handle it
            return;
        }

        // Handle non-category routes immediately
        this.handleRoute(window.location.pathname, false);
    }

    // Get current route
    getCurrentRoute() {
        return this.currentRoute;
    }

    // Get current category path
    getCurrentCategoryPath() {
        return this.currentCategoryPath;
    }

    // Check if path is a category path
    isCategoryPath(path) {
        if (path === '/')
            return false
        // Category paths start with / and contain only valid category name characters
        // They shouldn't match existing static routes
        for (const r in window.AppConstants.RESERVED_ROUTES){
            if (path === ('/'+r)){
                return false
            }
        }

        // Must start with / and contain valid characters for category names
        return /^\/[a-zA-Z0-9\s\/]+$/.test(path) && !path.includes('//');
    }

    // Handle category routing
    async handleCategoryRoute(path) {
        // Wait for categories to be loaded
        if (typeof categories === 'undefined' || !categories || categories.length === 0) {
            // Categories not loaded yet, wait and try again
            setTimeout(() => this.handleCategoryRoute(path), 100);
            return;
        }

        const category = this.findCategoryByPath(path);
        if (category) {
            // Navigate to category page and select the category
            await this.showCategoryPage(category);
        } else {
            // Category not found, redirect to home
            this.navigate('/', true);
        }
    }

    // Find category by URL path
    findCategoryByPath(path) {
        const pathParts = path.split('/').filter(part => part.length > 0);
        if (pathParts.length === 0) return null;

        let currentCategory = null;
        let currentLevel = categories.filter(cat => !cat.parent_id);

        for (const pathPart of pathParts) {
            const decodedPart = decodeURIComponent(pathPart);
            currentCategory = currentLevel.find(cat =>
                cat.name.toLowerCase() === decodedPart.toLowerCase()
            );

            if (!currentCategory) {
                return null; // Category not found
            }

            // Get children for next level
            currentLevel = categories.filter(cat => cat.parent_id === currentCategory.id);
        }

        return currentCategory;
    }

    // Build URL path from category
    buildCategoryPath(category) {
        const path = [];
        let current = category;

        while (current) {
            path.unshift(encodeURIComponent(current.name));
            if (current.parent_id) {
                current = categories.find(cat => cat.id === current.parent_id);
            } else {
                current = null;
            }
        }

        return '/' + path.join('/');
    }

    // Show category page
    async showCategoryPage(category) {
        // Ensure we're on the home page
        showHomePage();

        // Wait a bit to ensure the page is loaded
        await new Promise(resolve => setTimeout(resolve, 50));

        // Select the category (this will load posts and update UI)
        if (typeof selectCategory === 'function') {
            await selectCategory(category, false); // fromUserClick = false (programmatic)
        }
    }

    // Navigate to category by category object
    navigateToCategory(category) {
        if (!category) {
            this.navigate('/');
            return;
        }

        const path = this.buildCategoryPath(category);
        this.navigate(path);
    }

    // Check for cached category and redirect if needed
    checkCachedCategoryRedirect() {
        // Only check if we're on the root path
        if (window.location.pathname !== '/') return false;

        // Check if there's a cached category selection
        const lastCategoryId = localStorage.getItem('lastSelectedCategory');
        if (lastCategoryId && categories && categories.length > 0) {
            const category = categories.find(cat => cat.id === parseInt(lastCategoryId));
            if (category) {
                // Redirect to the category URL
                const categoryPath = this.buildCategoryPath(category);
                this.navigate(categoryPath, true);
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

    document.title = `${window.AppConstants.APP_NAME} - ${window.AppConstants.APP_TAGLINE}`

    // If there's a current category, deselect it to show all posts
    if (typeof currentCategory !== 'undefined' && currentCategory && currentCategory.id !== window.AppConstants?.ALL_CATEGORIES_ID) {
        if (typeof deselectCategory === 'function') {
            await deselectCategory();
        }
    }
}

async function showSettingsPage() {
    // Hide main container, show settings page
    const mainContainer = document.querySelector('.container');
    const settingsPage = document.getElementById('settings-page');

    if (mainContainer) mainContainer.style.display = 'none';
    if (settingsPage) settingsPage.classList.remove('hidden');

    document.title = `${window.AppConstants.APP_NAME} - Settings`;

    // Load and populate settings
    try {
        if (typeof loadSettings === 'function') {
            await loadSettings();
        }
        if (typeof populateSettingsForm === 'function') {
            populateSettingsForm();
        }
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