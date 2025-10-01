// Link preview management
let currentLinkPreviews = [];
let linkPreviewCounter = 0;

// URL detection regex
const URL_REGEX = /https?:\/\/[^\s\)]+/g;

// Extract URLs from text
function extractURLsFromText(text) {
    const matches = text.match(URL_REGEX);
    if (!matches) return [];

    // Remove duplicates
    return [...new Set(matches)];
}

// Local implementation of fetchLinkPreview to avoid dependency issues
async function fetchLinkPreviewLocal(url) {
    try {
        const response = await fetch('/api/link-preview', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }

        return response.json().catch(() => ({}));
    } catch (error) {
        throw error;
    }
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
            <label class="block text-sm font-medium text-gray-700 mb-2">Link Previews</label>
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
        <div class="border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors" data-preview-id="${preview.id}">
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
                            <h4 class="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
                                ${escapeHtml(preview.title)}
                            </h4>
                            ${preview.description ? `
                                <p class="text-xs text-gray-600 line-clamp-2 mb-2">
                                    ${escapeHtml(preview.description)}
                                </p>
                            ` : ''}
                            <div class="flex items-center text-xs text-gray-500">
                                <i class="fas fa-link mr-1"></i>
                                <span class="truncate">
                                    ${preview.site_name ? escapeHtml(preview.site_name) : new URL(preview.url).hostname}
                                </span>
                            </div>
                        </div>
                        <button type="button"
                                onclick="removeLinkPreview(${preview.id})"
                                class="ml-2 p-1 text-gray-400 hover:text-gray-600 rounded">
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

// Create link preview element for post display
function createPostLinkPreviewElement(preview) {
    const hasImage = preview.image_url && preview.image_url.trim() !== '';

    return `
        <a href="${escapeHtml(preview.url)}"
           target="_blank"
           rel="noopener noreferrer"
           class="block border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 hover:bg-gray-50 transition-all">
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
                    <h4 class="text-sm font-medium text-gray-900 line-clamp-2 mb-2">
                        ${escapeHtml(preview.title)}
                    </h4>
                    ${preview.description ? `
                        <p class="text-xs text-gray-600 line-clamp-3 mb-2">
                            ${escapeHtml(preview.description)}
                        </p>
                    ` : ''}
                    <div class="flex items-center text-xs text-gray-500">
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
        <div class="border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors flex-shrink-0 w-full" data-preview-id="${preview.id}">
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
                            <h4 class="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
                                ${escapeHtml(preview.title)}
                            </h4>
                            ${preview.description ? `
                                <p class="text-xs text-gray-600 line-clamp-2 mb-2">
                                    ${escapeHtml(preview.description)}
                                </p>
                            ` : ''}
                            <div class="flex items-center text-xs text-gray-500">
                                <i class="fas fa-link mr-1"></i>
                                <span class="truncate">
                                    ${preview.site_name ? escapeHtml(preview.site_name) : new URL(preview.url).hostname}
                                </span>
                            </div>
                        </div>
                        <button type="button"
                                onclick="removeModalLinkPreview(${preview.id})"
                                class="ml-2 p-1 text-gray-400 hover:text-gray-600 rounded">
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
