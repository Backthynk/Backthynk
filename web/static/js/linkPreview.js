// Link preview management
let currentLinkPreviews = [];
let linkPreviewCounter = 0;

// URL detection regex - matches URLs with or without protocol
// Matches: http://example.com, https://example.com, example.com/path, github.com/user
const URL_WITH_PROTOCOL = /https?:\/\/[^\s]+/g;
const URL_WITHOUT_PROTOCOL = /(?:^|\s)((?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?)/g;

// Extract URLs from text
function extractURLsFromText(text) {
    const urls = new Set();

    // First, find all URLs with explicit protocol
    const withProtocol = text.match(URL_WITH_PROTOCOL);
    if (withProtocol) {
        withProtocol.forEach(url => urls.add(url));
    }

    // Then find URLs without protocol (like github.com/user)
    // We need to ensure these don't overlap with URLs that already have protocol
    let match;
    const regex = new RegExp(URL_WITHOUT_PROTOCOL);
    while ((match = regex.exec(text)) !== null) {
        const url = match[1];

        // Check if this URL is not already part of a URL with protocol
        const position = match.index + match[0].indexOf(url);
        const beforeUrl = text.substring(Math.max(0, position - 8), position);

        // Skip if preceded by protocol
        if (!beforeUrl.match(/https?:\/\/$/)) {
            // Add https:// prefix for fetching
            urls.add('https://' + url);
        }
    }

    return Array.from(urls);
}

// Local implementation of fetchLinkPreview to avoid dependency issues
async function fetchLinkPreviewLocal(url) {
    return await fetchLinkPreview(url);
}

// Update link preview display in the form
function updateLinkPreviewDisplay() {
    const container = document.getElementById('link-preview-container');

    if (!container) {
        return;
    }

    if (currentLinkPreviews.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    try {
        container.innerHTML = `
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Link Previews</label>
            <div class="space-y-3">
                ${currentLinkPreviews.map(preview => createLinkPreviewElement(preview)).join('')}
            </div>
        `;
    } catch (error) {
        // Silently handle display errors
    }
}

// Create link preview element for form
function createLinkPreviewElement(preview) {
    const hasImage = preview.image_url && preview.image_url.trim() !== '';

    return `
        <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:border-gray-300 dark:hover:border-gray-600 transition-colors" data-preview-id="${preview.id}">
            <div class="flex">
                ${hasImage ? `
                    <div class="flex-shrink-0 w-24 h-24">
                        <img src="${escapeHtml(preview.image_url)}"
                             alt=""
                             class="w-full h-full object-cover"
                             onerror="this.parentElement.style.display='none'">
                    </div>
                ` : ''}
                <div class="flex-1 p-3 min-w-0">
                    <div class="flex items-start justify-between">
                        <div class="flex-1 min-w-0">
                            <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 mb-1">
                                ${escapeHtml(preview.title)}
                            </h4>
                            ${preview.description ? `
                                <p class="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                                    ${escapeHtml(preview.description)}
                                </p>
                            ` : ''}
                            <div class="flex items-center text-xs text-gray-500 dark:text-gray-400">
                                <i class="fas fa-link mr-1"></i>
                                <span class="truncate">
                                    ${preview.site_name ? escapeHtml(preview.site_name) : new URL(preview.url).hostname}
                                </span>
                            </div>
                        </div>
                        <button type="button"
                                onclick="removeLinkPreview(${preview.id})"
                                class="ml-2 p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded">
                            <i class="fas fa-times text-xs"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Remove link preview
function removeLinkPreview(previewId) {
    currentLinkPreviews = currentLinkPreviews.filter(p => p.id !== previewId);
    updateLinkPreviewDisplay();
}

// Make function globally accessible for onclick handlers
window.removeLinkPreview = removeLinkPreview;

// Create link preview element for post display (deprecated - use createPostLinkPreviewsContainer)
function createPostLinkPreviewElement(preview) {
    const hasImage = preview.image_url && preview.image_url.trim() !== '';

    return `
        <a href="${escapeHtml(preview.url)}"
           target="_blank"
           rel="noopener noreferrer"
           class="block border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex-shrink-0 w-full">
            <div class="flex">
                ${hasImage ? `
                    <div class="flex-shrink-0 w-32 h-24">
                        <img src="${escapeHtml(preview.image_url)}"
                             alt=""
                             class="w-full h-full object-cover"
                             onerror="this.parentElement.style.display='none'">
                    </div>
                ` : ''}
                <div class="flex-1 p-4 min-w-0">
                    <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 mb-2">
                        ${escapeHtml(preview.title)}
                    </h4>
                    ${preview.description ? `
                        <p class="text-xs text-gray-600 dark:text-gray-400 line-clamp-3 mb-2">
                            ${escapeHtml(preview.description)}
                        </p>
                    ` : ''}
                    <div class="flex items-center text-xs text-gray-500 dark:text-gray-400">
                        <i class="fas fa-external-link-alt mr-1"></i>
                        <span class="truncate">
                            ${preview.site_name ? escapeHtml(preview.site_name) : new URL(preview.url).hostname}
                        </span>
                    </div>
                </div>
            </div>
        </a>
    `;
}

// Create link preview container for posts with navigation
function createPostLinkPreviewsContainer(linkPreviews, postId) {
    if (!linkPreviews || linkPreviews.length === 0) {
        return '';
    }

    return `
        <div class="mb-4 mt-4">
            <div class="flex items-center justify-between mb-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Link Previews</label>
                <div class="flex items-center space-x-2">
                    <button type="button" class="post-link-prev p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30" disabled onclick="navigatePostLinkPreview(${postId}, -1)">
                        <i class="fas fa-chevron-left text-xs"></i>
                    </button>
                    <span class="post-link-counter text-xs text-gray-500 dark:text-gray-400">1 / ${linkPreviews.length}</span>
                    <button type="button" class="post-link-next p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30" ${linkPreviews.length === 1 ? 'disabled' : ''} onclick="navigatePostLinkPreview(${postId}, 1)">
                        <i class="fas fa-chevron-right text-xs"></i>
                    </button>
                </div>
            </div>
            <div class="relative overflow-hidden">
                <div class="flex transition-transform duration-300 ease-in-out" data-post-link-list>
                    ${linkPreviews.map(preview => createPostLinkPreviewElement(preview)).join('')}
                </div>
            </div>
        </div>
    `;
}

// Post link preview navigation state (indexed by post ID)
const postLinkPreviewState = {};

// Navigate post link previews
function navigatePostLinkPreview(postId, direction) {
    const postElement = document.querySelector(`[data-post-id="${postId}"]`);
    if (!postElement) return;

    const list = postElement.querySelector('[data-post-link-list]');
    const counter = postElement.querySelector('.post-link-counter');
    const prevBtn = postElement.querySelector('.post-link-prev');
    const nextBtn = postElement.querySelector('.post-link-next');

    if (!list || !counter) return;

    const totalPreviews = list.children.length;
    if (totalPreviews === 0) return;

    // Initialize state if not exists
    if (!postLinkPreviewState[postId]) {
        postLinkPreviewState[postId] = { currentIndex: 0 };
    }

    const state = postLinkPreviewState[postId];

    // Update index
    if (direction === -1 && state.currentIndex > 0) {
        state.currentIndex--;
    } else if (direction === 1 && state.currentIndex < totalPreviews - 1) {
        state.currentIndex++;
    }

    // Update display
    const translateX = -state.currentIndex * 100;
    list.style.transform = `translateX(${translateX}%)`;

    // Update counter
    counter.textContent = `${state.currentIndex + 1} / ${totalPreviews}`;

    // Update navigation buttons
    if (prevBtn) prevBtn.disabled = state.currentIndex === 0;
    if (nextBtn) nextBtn.disabled = state.currentIndex === totalPreviews - 1;
}

// Make function globally accessible for onclick handlers
window.navigatePostLinkPreview = navigatePostLinkPreview;

// Initialize link preview functionality
function initializeLinkPreview() {
    const textArea = document.getElementById('post-content');

    if (!textArea) {
        return;
    }

    // Remove existing listener to prevent duplicates
    if (textArea.linkPreviewInputHandler) {
        textArea.removeEventListener('input', textArea.linkPreviewInputHandler);
    }

    // Create the working handler
    textArea.linkPreviewInputHandler = async (e) => {
        const text = e.target.value;

        // Clear timeout if exists
        if (textArea.linkPreviewTimeout) {
            clearTimeout(textArea.linkPreviewTimeout);
        }

        // Debounce for 500ms
        textArea.linkPreviewTimeout = setTimeout(async () => {
            await processTextForLinks(text);
        }, window.AppConstants.UI_CONFIG.debounceDelay);
    };

    textArea.addEventListener('input', textArea.linkPreviewInputHandler);

    // Process existing content if any
    if (textArea.value.trim()) {
        processTextForLinks(textArea.value);
    }
}

// Process text for links
async function processTextForLinks(text) {
    const urls = extractURLsFromText(text);

    if (urls.length === 0) {
        // No URLs found, clear previews
        currentLinkPreviews = [];
        updateLinkPreviewDisplay();
        return;
    }

    // Find new URLs to process
    const existingUrls = currentLinkPreviews.map(p => p.url);
    const newUrls = urls.filter(url => !existingUrls.includes(url));

    // Remove previews for URLs no longer in text
    currentLinkPreviews = currentLinkPreviews.filter(preview => urls.includes(preview.url));

    // Fetch previews for new URLs
    for (const url of newUrls) {
        try {
            const preview = await fetchLinkPreviewLocal(url);
            if (!preview.error) {
                currentLinkPreviews.push({
                    id: ++linkPreviewCounter,
                    url: preview.url,
                    title: preview.title || url,
                    description: preview.description || '',
                    image_url: preview.image_url || '',
                    site_name: preview.site_name || ''
                });
            }
        } catch (error) {
            // Silently handle fetch errors
        }
    }

    updateLinkPreviewDisplay();
}

// Reset link previews (called when form is cleared)
function resetLinkPreviews() {
    currentLinkPreviews = [];
    linkPreviewCounter = 0;
    const container = document.getElementById('link-preview-container');
    if (container) {
        container.style.display = 'none';
        container.innerHTML = '';
    }
}

// Get current link previews for form submission
function getCurrentLinkPreviews() {
    return currentLinkPreviews.map(preview => ({
        url: preview.url,
        title: preview.title,
        description: preview.description,
        image_url: preview.image_url,
        site_name: preview.site_name
    }));
}

// Modal link preview management
let modalCurrentLinkPreviews = [];
let modalLinkPreviewCounter = 0;
let modalCurrentLinkIndex = 0;

// Update modal link preview display
function updateModalLinkPreviewDisplay() {
    const container = document.getElementById('modal-link-preview-container');
    const list = document.getElementById('modal-link-preview-list');
    const counter = document.getElementById('modal-link-counter');
    const prevBtn = document.getElementById('modal-link-prev');
    const nextBtn = document.getElementById('modal-link-next');

    if (!container || !list) {
        return;
    }

    if (modalCurrentLinkPreviews.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    try {
        // Update preview list
        list.innerHTML = modalCurrentLinkPreviews.map(preview => createModalLinkPreviewElement(preview)).join('');

        // Update counter and navigation
        counter.textContent = `${modalCurrentLinkIndex + 1} / ${modalCurrentLinkPreviews.length}`;

        // Update navigation buttons
        prevBtn.disabled = modalCurrentLinkIndex === 0;
        nextBtn.disabled = modalCurrentLinkIndex === modalCurrentLinkPreviews.length - 1;

        // Update transform to show current preview
        const translateX = -modalCurrentLinkIndex * 100;
        list.style.transform = `translateX(${translateX}%)`;

    } catch (error) {
        // Silently handle display errors
    }
}

// Create modal link preview element
function createModalLinkPreviewElement(preview) {
    const hasImage = preview.image_url && preview.image_url.trim() !== '';

    return `
        <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:border-gray-300 dark:hover:border-gray-600 transition-colors flex-shrink-0 w-full" data-preview-id="${preview.id}">
            <div class="flex">
                ${hasImage ? `
                    <div class="flex-shrink-0 w-24 h-24">
                        <img src="${escapeHtml(preview.image_url)}"
                             alt=""
                             class="w-full h-full object-cover"
                             onerror="this.parentElement.style.display='none'">
                    </div>
                ` : ''}
                <div class="flex-1 p-3 min-w-0">
                    <div class="flex items-start justify-between">
                        <div class="flex-1 min-w-0">
                            <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 mb-1">
                                ${escapeHtml(preview.title)}
                            </h4>
                            ${preview.description ? `
                                <p class="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                                    ${escapeHtml(preview.description)}
                                </p>
                            ` : ''}
                            <div class="flex items-center text-xs text-gray-500 dark:text-gray-400">
                                <i class="fas fa-link mr-1"></i>
                                <span class="truncate">
                                    ${preview.site_name ? escapeHtml(preview.site_name) : new URL(preview.url).hostname}
                                </span>
                            </div>
                        </div>
                        <button type="button"
                                onclick="removeModalLinkPreview(${preview.id})"
                                class="ml-2 p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded">
                            <i class="fas fa-times text-xs"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Remove modal link preview
function removeModalLinkPreview(previewId) {
    modalCurrentLinkPreviews = modalCurrentLinkPreviews.filter(p => p.id !== previewId);

    // Adjust current index if needed
    if (modalCurrentLinkIndex >= modalCurrentLinkPreviews.length && modalCurrentLinkPreviews.length > 0) {
        modalCurrentLinkIndex = modalCurrentLinkPreviews.length - 1;
    } else if (modalCurrentLinkPreviews.length === 0) {
        modalCurrentLinkIndex = 0;
    }

    updateModalLinkPreviewDisplay();
}

// Make function globally accessible for onclick handlers
window.removeModalLinkPreview = removeModalLinkPreview;

// Navigate modal link previews
function navigateModalLinkPreview(direction) {
    if (direction === 'prev' && modalCurrentLinkIndex > 0) {
        modalCurrentLinkIndex--;
    } else if (direction === 'next' && modalCurrentLinkIndex < modalCurrentLinkPreviews.length - 1) {
        modalCurrentLinkIndex++;
    }
    updateModalLinkPreviewDisplay();
}

// Initialize modal link preview functionality
function initializeModalLinkPreview() {
    const textArea = document.getElementById('modal-post-content');

    if (!textArea) {
        return;
    }

    // Remove existing listener to prevent duplicates
    if (textArea.linkPreviewInputHandler) {
        textArea.removeEventListener('input', textArea.linkPreviewInputHandler);
    }

    // Create the working handler
    textArea.linkPreviewInputHandler = async (e) => {
        const text = e.target.value;

        // Clear timeout if exists
        if (textArea.linkPreviewTimeout) {
            clearTimeout(textArea.linkPreviewTimeout);
        }

        // Debounce for 500ms
        textArea.linkPreviewTimeout = setTimeout(async () => {
            await processModalTextForLinks(text);
        }, window.AppConstants.UI_CONFIG.debounceDelay);
    };

    textArea.addEventListener('input', textArea.linkPreviewInputHandler);

    // Process existing content if any
    if (textArea.value.trim()) {
        processModalTextForLinks(textArea.value);
    }
}

// Process modal text for links
async function processModalTextForLinks(text) {
    const urls = extractURLsFromText(text);

    if (urls.length === 0) {
        // No URLs found, clear previews
        modalCurrentLinkPreviews = [];
        updateModalLinkPreviewDisplay();
        return;
    }

    // Find new URLs to process
    const existingUrls = modalCurrentLinkPreviews.map(p => p.url);
    const newUrls = urls.filter(url => !existingUrls.includes(url));

    // Remove previews for URLs no longer in text
    modalCurrentLinkPreviews = modalCurrentLinkPreviews.filter(preview => urls.includes(preview.url));

    // Fetch previews for new URLs
    for (const url of newUrls) {
        try {
            const preview = await fetchLinkPreviewLocal(url);
            if (!preview.error) {
                modalCurrentLinkPreviews.push({
                    id: ++modalLinkPreviewCounter,
                    url: preview.url,
                    title: preview.title || url,
                    description: preview.description || '',
                    image_url: preview.image_url || '',
                    site_name: preview.site_name || ''
                });
            }
        } catch (error) {
            // Silently handle fetch errors
        }
    }

    updateModalLinkPreviewDisplay();
}

// Reset modal link previews
function resetModalLinkPreviews() {
    modalCurrentLinkPreviews = [];
    modalLinkPreviewCounter = 0;
    modalCurrentLinkIndex = 0;
    const container = document.getElementById('modal-link-preview-container');
    if (container) {
        container.style.display = 'none';
    }
}

// Get current modal link previews for form submission
function getCurrentModalLinkPreviews() {
    return modalCurrentLinkPreviews.map(preview => ({
        url: preview.url,
        title: preview.title,
        description: preview.description,
        image_url: preview.image_url,
        site_name: preview.site_name
    }));
}
