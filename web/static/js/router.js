// Simple client-side router for SPA functionality
class Router {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;

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
            const handler = this.routes.get(cleanPath);
            handler();
        } else {
            // Default to home route
            this.currentRoute = '/';
            if (this.routes.has('/')) {
                this.routes.get('/')();
            }
        }
    }

    // Initialize router with current URL
    init() {
        this.handleRoute(window.location.pathname, false);
    }

    // Get current route
    getCurrentRoute() {
        return this.currentRoute;
    }
}

// Create global router instance
const router = new Router();

// Route handlers
function showHomePage() {
    // Show main container, hide settings page
    const mainContainer = document.querySelector('.container');
    const settingsPage = document.getElementById('settings-page');

    if (mainContainer) mainContainer.style.display = 'block';
    if (settingsPage) settingsPage.classList.add('hidden');

    document.title = 'Backthynk - Personal Micro Blog';
}

async function showSettingsPage() {
    // Hide main container, show settings page
    const mainContainer = document.querySelector('.container');
    const settingsPage = document.getElementById('settings-page');

    if (mainContainer) mainContainer.style.display = 'none';
    if (settingsPage) settingsPage.classList.remove('hidden');

    document.title = 'Settings - Backthynk';

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
            showError('Failed to load settings: ' + error.message);
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