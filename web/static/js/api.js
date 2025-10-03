// API functions
let appSettings = null;
let settingsPromise = null;

// Load application settings
async function loadAppSettings(forceRefresh = false) {
    if (appSettings && !forceRefresh) return appSettings;

    // If a request is already in progress, wait for it
    if (settingsPromise && !forceRefresh) {
        return await settingsPromise;
    }

    // Create new promise for settings loading
    settingsPromise = loadSettingsInternal();

    try {
        appSettings = await settingsPromise;
        return appSettings;
    } finally {
        settingsPromise = null;
    }
}

async function loadSettingsInternal() {
    try {
        const response = await fetch('/api/settings');
        if (response.ok) {
            return await response.json();
        } else {
            // Use defaults if settings can't be loaded
            return { ...window.AppConstants.DEFAULT_SETTINGS };
        }
    } catch (error) {
        console.error('Failed to load settings, using defaults:', error);
        return { ...window.AppConstants.DEFAULT_SETTINGS };
    }
}

// Initialize settings early and cache them
async function initializeAppSettings() {
    if (!appSettings) {
        appSettings = await loadAppSettings();
    }
    return appSettings;
}

// Clear settings cache (used when settings are updated)
function clearSettingsCache() {
    appSettings = null;
    settingsPromise = null;
}
async function apiRequest(endpoint, options = {}) {
    const response = await fetch(`/api${endpoint}`, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
    }

    // Check if response has content before trying to parse JSON
    const text = await response.text();
    if (!text || text.trim() === '') {
        return null;
    }

    try {
        const data = JSON.parse(text);
        return data || null;
    } catch (error) {
        console.error('Failed to parse JSON response:', error);
        return null;
    }
}

async function fetchCategories(skipRender = false) {
    try {
        categories = await apiRequest('/categories');
        if (!categories || !Array.isArray(categories)) {
            categories = [];
        }

        // Clean up any orphaned recursive toggle states
        cleanupRecursiveToggleStates();

        if (!skipRender) {
            renderCategories();
            populateCategorySelect();
        }


        // Check if we should handle URL routing or cached category logic
        if (typeof router !== 'undefined') {
            // If we're on a category path, let the router handle it
            if (window.location.pathname !== '/' && router.isCategoryPath && router.isCategoryPath(window.location.pathname)) {
                // This is a category URL, trigger router handling
                router.handleRoute(window.location.pathname, false);
            } else if (router.checkCachedCategoryRedirect) {
                // On root path, check for cached category redirect
                if (!router.checkCachedCategoryRedirect()) {
                    // No redirect happened, show all categories
                    await deselectCategory();
                }
            }
        } else {
            // Fallback to original logic
            const lastCategoryId = getLastCategory();
            if (lastCategoryId) {
                const lastCategory = categories.find(cat => cat.id == lastCategoryId);
                if (lastCategory) {
                    selectCategory(lastCategory); // Programmatic selection of last selected category
                } else {
                    // Last category no longer exists, show all categories
                    await deselectCategory();
                }
            } else {
                // No last category, show all categories
                await deselectCategory();
            }
        }
    } catch (error) {
        console.error('Failed to fetch categories:', error);
        categories = [];
        renderCategories();
        populateCategorySelect();
    }
}

async function createCategory(name, parentId, description = '') {
    try {
        const parent_id = parentId ? parseInt(parentId) : null;
        const category = await apiRequest('/categories', {
            method: 'POST',
            body: JSON.stringify({ name, description, parent_id })
        });

        // Add the new category to the existing categories array instead of refetching
        if (category && Array.isArray(categories)) {
            categories.push(category);
            cleanupRecursiveToggleStates();
        }

        return category;
    } catch (error) {
        console.error('Failed to create category:', error);
        throw error;
    }
}

async function updateCategory(categoryId, name, description, parentId) {
    try {
        const parent_id = parentId ? parseInt(parentId) : null;
        const category = await apiRequest(`/categories/${categoryId}`, {
            method: 'PUT',
            body: JSON.stringify({ name, description, parent_id })
        });

        // Update the category in the existing categories array instead of refetching
        if (category && Array.isArray(categories)) {
            const index = categories.findIndex(cat => cat.id === categoryId);
            if (index !== -1) {
                categories[index] = category;
            }
            cleanupRecursiveToggleStates();
        }

        return category;
    } catch (error) {
        console.error('Failed to update category:', error);
        throw error;
    }
}

async function fetchPosts(categoryId, limit = window.AppConstants.UI_CONFIG.defaultPostLimit, offset = window.AppConstants.UI_CONFIG.defaultOffset, withMeta = false, recursive = false) {
    try {
        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString()
        });

        if (withMeta) {
            params.set('with_meta', 'true');
        }

        if (recursive) {
            params.set('recursive', 'true');
        }

        const response = await apiRequest(`/categories/${categoryId}/posts?${params.toString()}`);
        return response || { posts: [], has_more: false };
    } catch (error) {
        console.error('Failed to fetch posts:', error);
        return { posts: [], has_more: false };
    }
}


async function fetchCategoryStats(categoryId, recursive = false) {
    try {
        // Check if detailed stats feature is enabled
        const settings = await loadAppSettings();
        if (!settings.fileStatsEnabled) {
            return { file_count: 0, total_size: 0, last_updated: 0 };
        }

        // Use efficient cached API that returns all statistics in one request
        const params = new URLSearchParams({
            recursive: recursive.toString()
        });

        const response = await apiRequest(`/category-stats/${categoryId}?${params.toString()}`);

        return {
            file_count: response.file_count || 0,
            total_size: response.total_size || 0,
            last_updated: response.last_updated || 0
        };
    } catch (error) {
        console.error('Failed to fetch category stats:', error);
        return { file_count: 0, total_size: 0, last_updated: 0 };
    }
}

async function createPost(categoryId, content, options = {}) {
    try {
        const payload = {
            category_id: categoryId,
            content: content
        };

        // Add optional parameters
        if (options.linkPreviews && options.linkPreviews.length > 0) {
            payload.link_previews = options.linkPreviews;
        }

        if (options.customTimestamp) {
            payload.custom_timestamp = options.customTimestamp;
        }

        return await apiRequest('/posts', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error('Failed to create post:', error);
        throw error;
    }
}

async function deletePost(postId) {
    try {
        await apiRequest(`/posts/${postId}`, {
            method: 'DELETE'
        });
    } catch (error) {
        console.error('Failed to delete post:', error);
        throw error;
    }
}

async function movePost(postId, newCategoryId) {
    try {
        return await apiRequest(`/posts/${postId}/move`, {
            method: 'PUT',
            body: JSON.stringify({ category_id: newCategoryId })
        });
    } catch (error) {
        console.error('Failed to move post:', error);
        throw error;
    }
}

async function deleteCategoryApi(categoryId) {
    try {
        await apiRequest(`/categories/${categoryId}`, {
            method: 'DELETE'
        });
    } catch (error) {
        console.error('Failed to delete category:', error);
        throw error;
    }
}

async function uploadFile(postId, file) {
    try {
        const formData = new FormData();
        formData.append('post_id', postId);
        formData.append('file', file);

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }

        return response.json();
    } catch (error) {
        console.error('Failed to load file:', error);
        throw error;
    }
}

async function fetchActivityData(categoryId, recursive, period) {
    try {
        const params = new URLSearchParams({
            recursive: recursive.toString(),
            period: period.toString(),
            period_months: window.AppConstants.UI_CONFIG.activityPeriodMonths.toString()
        });

        const response = await fetch(`/api/activity/${categoryId}?${params}`, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to fetch activity data:', error);
        throw error;
    }
}

async function fetchLinkPreview(url) {
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

async function saveSettings(newSettings) {
    try {
        const response = await fetch('/api/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(newSettings)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `HTTP error! status: ${response.status}`);
        }

        const savedSettings = await response.json();

        // Clear settings cache
        clearSettingsCache();

        return savedSettings;
    } catch (error) {
        console.error('Failed to save settings:', error);
        throw error;
    }
}

