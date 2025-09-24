// Smooth sticky header transformation
function initializeStickyHeader() {
    window.addEventListener('scroll', handleStickyHeaderScroll);
}

function handleStickyHeaderScroll() {
    const header = document.getElementById('timeline-header');

    if (!header) return;

    const scrollY = window.scrollY;
    const shouldBeScrolled = scrollY > window.AppConstants.UI_CONFIG.scrollThreshold;

    if (shouldBeScrolled && !header.classList.contains('scrolled')) {
        header.classList.add('scrolled');
        document.body.classList.add('header-scrolled');
    } else if (!shouldBeScrolled && header.classList.contains('scrolled')) {
        header.classList.remove('scrolled');
        document.body.classList.remove('header-scrolled');
    }
}

// Add sticky New Post button functionality
function createStickyNewPostButton() {
    // Check if sticky button already exists
    if (document.getElementById('new-post-btn-sticky')) {
        return;
    }

    const stickyButton = document.createElement('button');
    stickyButton.id = 'new-post-btn-sticky';
    stickyButton.className = 'fixed bottom-6 right-6 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg z-50 transition-all duration-300';
    stickyButton.innerHTML = '<i class="fas fa-plus text-xl"></i>';
    stickyButton.onclick = window.showCreatePost;
    stickyButton.style.display = 'none';

    document.body.appendChild(stickyButton);
}

// Initialize sticky button on page load
document.addEventListener('DOMContentLoaded', function() {
    createStickyNewPostButton();
});