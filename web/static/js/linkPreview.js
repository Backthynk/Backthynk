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

// Debounce function for text input
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Handle text input changes to detect links
const handleTextInputChange = debounce(async (textArea) => {
    console.log('🚀 handleTextInputChange called with text:', textArea.value);
    const text = textArea.value;
    const urls = extractURLsFromText(text);
    console.log('🔍 Extracted URLs:', urls);

    if (urls.length === 0) {
        console.log('No URLs found, clearing previews');
        currentLinkPreviews = [];
        updateLinkPreviewDisplay();
        return;
    }

    // Find new URLs that we haven't processed yet
    const existingUrls = currentLinkPreviews.map(p => p.url);
    const newUrls = urls.filter(url => !existingUrls.includes(url));
    console.log('✨ New URLs to process:', newUrls);

    // Remove previews for URLs that are no longer in the text
    const beforeCount = currentLinkPreviews.length;
    currentLinkPreviews = currentLinkPreviews.filter(preview => urls.includes(preview.url));
    if (currentLinkPreviews.length !== beforeCount) {
        console.log('🗑️ Removed old previews, now have:', currentLinkPreviews.length);
    }

    // Fetch previews for new URLs
    for (const url of newUrls) {
        console.log('📡 Fetching preview for URL:', url);
        await fetchAndAddLinkPreview(url);
    }

    console.log('📝 Current previews count:', currentLinkPreviews.length);
    updateLinkPreviewDisplay();
}, 500);

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
        console.error('Failed to fetch link preview:', error);
        throw error;
    }
}

// Fetch and add link preview
async function fetchAndAddLinkPreview(url) {
    try {
        const preview = await fetchLinkPreviewLocal(url);

        if (!preview.error) {
            const linkPreview = {
                id: ++linkPreviewCounter,
                url: preview.url,
                title: preview.title || url,
                description: preview.description || '',
                image_url: preview.image_url || '',
                site_name: preview.site_name || ''
            };
            currentLinkPreviews.push(linkPreview);
        }
    } catch (error) {
        console.error('Failed to fetch link preview for:', url, error);
    }
}

// Update link preview display in the form
function updateLinkPreviewDisplay() {
    console.log('🎨 Updating link preview display');
    const container = document.getElementById('link-preview-container');

    if (!container) {
        console.error('❌ Link preview container not found');
        return;
    }

    if (currentLinkPreviews.length === 0) {
        console.log('📭 No previews to display, hiding container');
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }

    console.log('📋 Displaying', currentLinkPreviews.length, 'previews');
    container.style.display = 'block';

    try {
        container.innerHTML = `
            <label class="block text-sm font-medium text-gray-700 mb-2">Link Previews</label>
            <div class="space-y-3">
                ${currentLinkPreviews.map(preview => createLinkPreviewElement(preview)).join('')}
            </div>
        `;
        console.log('✅ Successfully updated preview display');
    } catch (error) {
        console.error('❌ Error updating preview display:', error);
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
    console.log('🚀 initializeLinkPreview called');
    const textArea = document.getElementById('post-content');

    if (!textArea) {
        console.error('❌ Text area not found!');
        return;
    }

    // Remove existing listener to prevent duplicates
    if (textArea.linkPreviewInputHandler) {
        textArea.removeEventListener('input', textArea.linkPreviewInputHandler);
    }

    // Create the actual working handler (similar to our test)
    textArea.linkPreviewInputHandler = async (e) => {
        const text = e.target.value;
        console.log('🔗 Link preview handler triggered:', text);

        // Clear timeout if exists
        if (textArea.linkPreviewTimeout) {
            clearTimeout(textArea.linkPreviewTimeout);
        }

        // Debounce for 500ms
        textArea.linkPreviewTimeout = setTimeout(async () => {
            await processTextForLinks(text);
        }, 500);
    };

    textArea.addEventListener('input', textArea.linkPreviewInputHandler);
    console.log('✅ Link preview handler attached successfully');

    // Process existing content if any
    if (textArea.value.trim()) {
        console.log('Processing existing content:', textArea.value);
        processTextForLinks(textArea.value);
    }
}

// Process text for links (replaces the complex handleTextInputChange)
async function processTextForLinks(text) {
    console.log('🔍 Processing text for links:', text);

    const urls = extractURLsFromText(text);
    console.log('Found URLs:', urls);

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
        console.log('🌐 Fetching preview for:', url);
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
                console.log('✅ Added preview for:', url);
            }
        } catch (error) {
            console.error('❌ Failed to fetch preview for:', url, error);
        }
    }

    console.log('📦 Current previews:', currentLinkPreviews.length);
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

// Simple setup that actually works
function setupSimpleLinkPreview() {
    const textArea = document.getElementById('post-content');
    const container = document.getElementById('link-preview-container');

    if (!textArea || !container) return;

    // Remove any existing handler
    textArea.removeEventListener('input', textArea.linkHandler);

    // Create simple handler
    textArea.linkHandler = async (e) => {
        const text = e.target.value;

        // Clear existing timeout
        if (textArea.linkTimeout) clearTimeout(textArea.linkTimeout);

        // Wait 500ms before processing
        textArea.linkTimeout = setTimeout(async () => {
            const urls = text.match(/https?:\/\/[^\s\)]+/g) || [];

            if (urls.length === 0) {
                currentLinkPreviews = [];
                container.style.display = 'none';
                return;
            }

            // Process only new URLs
            for (const url of urls) {
                if (!currentLinkPreviews.find(p => p.url === url)) {
                    try {
                        const response = await fetch('/api/link-preview', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ url })
                        });
                        const preview = await response.json();

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
                        console.error('Link preview failed:', error);
                    }
                }
            }

            // Remove previews for URLs no longer in text
            currentLinkPreviews = currentLinkPreviews.filter(p => urls.includes(p.url));

            // Update display
            if (currentLinkPreviews.length > 0) {
                container.style.display = 'block';
                container.innerHTML = `
                    <label class="block text-sm font-medium text-gray-700 mb-2">Link Previews</label>
                    <div class="space-y-3">
                        ${currentLinkPreviews.map(preview => `
                            <div class="border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors">
                                <div class="flex">
                                    ${preview.image_url ? `
                                        <div class="flex-shrink-0 w-24 h-24">
                                            <img src="${preview.image_url}" alt="" class="w-full h-full object-cover" onerror="this.parentElement.style.display='none'">
                                        </div>
                                    ` : ''}
                                    <div class="flex-1 p-3 min-w-0">
                                        <div class="flex items-start justify-between">
                                            <div class="flex-1 min-w-0">
                                                <h4 class="text-sm font-medium text-gray-900 line-clamp-2 mb-1">${preview.title}</h4>
                                                ${preview.description ? `<p class="text-xs text-gray-600 line-clamp-2 mb-2">${preview.description}</p>` : ''}
                                                <div class="flex items-center text-xs text-gray-500">
                                                    <i class="fas fa-link mr-1"></i>
                                                    <span class="truncate">${preview.site_name || new URL(preview.url).hostname}</span>
                                                </div>
                                            </div>
                                            <button type="button" onclick="removeLinkPreview(${preview.id})" class="ml-2 p-1 text-gray-400 hover:text-gray-600 rounded">
                                                <i class="fas fa-times text-xs"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                container.style.display = 'none';
            }
        }, 500);
    };

    textArea.addEventListener('input', textArea.linkHandler);
}

// Test function for debugging
window.testLinkPreview = function() {
    console.log('Testing link preview functionality...');
    console.log('currentLinkPreviews:', currentLinkPreviews);
    console.log('linkPreviewCounter:', linkPreviewCounter);

    const textArea = document.getElementById('post-content');
    console.log('textArea exists:', !!textArea);

    const container = document.getElementById('link-preview-container');
    console.log('container exists:', !!container);

    if (textArea) {
        console.log('textArea value:', textArea.value);
        console.log('textArea has linkPreviewInputHandler:', !!textArea.linkPreviewInputHandler);

        // Test basic event listener
        console.log('🧪 Adding basic test event listener...');
        textArea.addEventListener('input', function testHandler(e) {
            console.log('🎯 BASIC TEST HANDLER TRIGGERED:', e.target.value);
        });
    }

    // Test URL extraction
    const testText = 'Check this link: https://x.com/florinpop1705/status/1970158938206425256';
    const urls = extractURLsFromText(testText);
    console.log('Test URL extraction:', urls);

    // Check if fetchLinkPreview function exists
    console.log('fetchLinkPreview function exists:', typeof fetchLinkPreview);
    console.log('fetchLinkPreviewLocal function exists:', typeof fetchLinkPreviewLocal);

    // Test manual preview fetch using local implementation
    console.log('Testing fetchAndAddLinkPreview...');
    fetchAndAddLinkPreview('https://x.com/florinpop1705/status/1970158938206425256')
        .then(() => {
            console.log('Manual fetch completed, previews:', currentLinkPreviews);
            updateLinkPreviewDisplay();
        })
        .catch(error => {
            console.error('Manual fetch failed:', error);
        });
};

// Simple test function to attach basic handler
window.testBasicHandler = function() {
    const textArea = document.getElementById('post-content');
    if (textArea) {
        console.log('🔧 Attaching basic input handler...');
        textArea.addEventListener('input', (e) => {
            console.log('🟢 BASIC INPUT DETECTED:', e.target.value);
        });
    } else {
        console.error('❌ Text area not found');
    }
};

// Super simple link preview test
window.testSimpleLinkPreview = function() {
    const textArea = document.getElementById('post-content');
    if (textArea) {
        console.log('🔧 Attaching simple link preview handler...');

        // Remove any existing listeners
        textArea.removeEventListener('input', textArea.simpleLinkHandler);

        textArea.simpleLinkHandler = (e) => {
            const text = e.target.value;
            console.log('📝 Simple handler got text:', text);

            const urlMatch = text.match(/https?:\/\/[^\s\)]+/);
            if (urlMatch) {
                console.log('🔗 Found URL:', urlMatch[0]);

                // Show in container immediately (no debouncing for test)
                const container = document.getElementById('link-preview-container');
                if (container) {
                    container.style.display = 'block';
                    container.innerHTML = `
                        <div class="p-3 bg-blue-50 border border-blue-200 rounded">
                            <strong>Link detected:</strong> ${urlMatch[0]}
                        </div>
                    `;
                }
            } else {
                console.log('❌ No URL found');
                const container = document.getElementById('link-preview-container');
                if (container) {
                    container.style.display = 'none';
                }
            }
        };

        textArea.addEventListener('input', textArea.simpleLinkHandler);
        console.log('✅ Simple link preview handler attached');
    } else {
        console.error('❌ Text area not found');
    }
};

// Test API function
window.testAPI = async function() {
    console.log('Testing API directly...');
    try {
        const response = await fetch('/api/link-preview', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: 'https://x.com/florinpop1705/status/1970158938206425256'
            })
        });
        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);
    } catch (error) {
        console.error('API test failed:', error);
    }
};