// Dark Mode Toggle Functionality

// Initialize dark mode from localStorage on page load
function initDarkMode() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

// Toggle dark mode
function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', isDark);

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
