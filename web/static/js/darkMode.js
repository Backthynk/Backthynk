// Dark Mode Toggle Functionality

// Update favicon based on theme
function updateFavicon(isDark) {
    const theme = isDark ? 'dark' : 'light';
    const faviconIco = document.getElementById('favicon-ico');
    const favicon16 = document.getElementById('favicon-16');
    const favicon32 = document.getElementById('favicon-32');

    if (faviconIco) faviconIco.href = `/static/images/${theme}/favicon.ico`;
    if (favicon16) favicon16.href = `/static/images/${theme}/favicon-16x16.png`;
    if (favicon32) favicon32.href = `/static/images/${theme}/favicon-32x32.png`;
}

// Initialize dark mode from localStorage on page load
function initDarkMode() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    updateFavicon(isDarkMode);
}

// Toggle dark mode
function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', isDark);
    updateFavicon(isDark);

    // Update activity heatmap colors if visible
    if (typeof updateActivityHeatmapColors === 'function') {
        updateActivityHeatmapColors();
    }
}

// Initialize dark mode as soon as possible (before DOMContentLoaded to prevent flash)
initDarkMode();

// Set up toggle button when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleDarkMode);
    }
});
