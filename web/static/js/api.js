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

    try {
        const data = await response.json();
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
        // Use efficient cached API that returns all statistics in one request
        const params = new URLSearchParams({
            recursive: recursive.toString()
        });

        const response = await apiRequest(`/category-stats/${categoryId}?${params.toString()}`);

        return {
            post_count: response.post_count || 0,
            file_count: response.file_count || 0,
            total_size: response.total_size || 0,
            last_updated: response.last_updated || 0
        };
    } catch (error) {
        console.error('Failed to fetch category stats:', error);
        return { post_count: 0, file_count: 0, total_size: 0, last_updated: 0 };
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

