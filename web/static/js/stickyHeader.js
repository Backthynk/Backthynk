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
