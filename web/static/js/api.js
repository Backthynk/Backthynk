// API functions
let appSettings = null;

// Load application settings
async function loadAppSettings(forceRefresh = false) {
    if (appSettings && !forceRefresh) return appSettings;

    try {
        const response = await fetch('/api/settings');
        if (response.ok) {
            appSettings = await response.json();
        } else {
            // Use defaults if settings can't be loaded
            appSettings = { ...window.AppConstants.DEFAULT_SETTINGS };
        }
    } catch (error) {
        console.error(`${window.AppConstants.UI_TEXT.failedToLoad} settings, ${window.AppConstants.UI_TEXT.usingDefaults}:`, error);
        appSettings = { ...window.AppConstants.DEFAULT_SETTINGS };
    }
    return appSettings;
}

// Clear settings cache (used when settings are updated)
function clearSettingsCache() {
    appSettings = null;
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
        console.error(`${window.AppConstants.UI_TEXT.failedToParse}:`, error);
        return null;
    }
}

async function fetchCategories() {
    try {
        categories = await apiRequest('/categories');
        if (!categories || !Array.isArray(categories)) {
            categories = [];
        }

        // Clean up any orphaned recursive toggle states
        cleanupRecursiveToggleStates();

        renderCategories();
        populateCategorySelect();


        // Auto-select last category if exists, otherwise show all categories
        const lastCategoryId = getLastCategory();
        if (lastCategoryId) {
            const lastCategory = categories.find(cat => cat.id == lastCategoryId);
            if (lastCategory) {
                selectCategory(lastCategory);
            } else {
                // Last category no longer exists, show all categories
                await deselectCategory();
            }
        } else {
            // No last category, show all categories
            await deselectCategory();
        }
    } catch (error) {
        console.error(`${window.AppConstants.UI_TEXT.failedToFetch} categories:`, error);
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
        await fetchCategories();
        return category;
    } catch (error) {
        console.error(`${window.AppConstants.UI_TEXT.failedToCreate} category:`, error);
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
        await fetchCategories();
        return category;
    } catch (error) {
        console.error(`${window.AppConstants.UI_TEXT.failedToUpdate} category:`, error);
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
        console.error(`${window.AppConstants.UI_TEXT.failedToFetch} posts:`, error);
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
        console.error(`${window.AppConstants.UI_TEXT.failedToFetch} category stats:`, error);
        return { post_count: 0, file_count: 0, total_size: 0, last_updated: 0 };
    }
}

async function createPost(categoryId, content) {
    try {
        return await apiRequest('/posts', {
            method: 'POST',
            body: JSON.stringify({ category_id: categoryId, content })
        });
    } catch (error) {
        console.error(`${window.AppConstants.UI_TEXT.failedToCreate} post:`, error);
        throw error;
    }
}

async function deletePost(postId) {
    try {
        await apiRequest(`/posts/${postId}`, {
            method: 'DELETE'
        });
    } catch (error) {
        console.error(`${window.AppConstants.UI_TEXT.failedToDelete} post:`, error);
        throw error;
    }
}

async function deleteCategoryApi(categoryId) {
    try {
        await apiRequest(`/categories/${categoryId}`, {
            method: 'DELETE'
        });
    } catch (error) {
        console.error(`${window.AppConstants.UI_TEXT.failedToDelete} category:`, error);
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
        console.error(`${window.AppConstants.UI_TEXT.failedToLoad} file:`, error);
        throw error;
    }
}

