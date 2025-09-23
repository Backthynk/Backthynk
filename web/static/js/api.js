// API functions
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

    return response.json().catch(() => ({}));
}

async function fetchCategories() {
    try {
        categories = await apiRequest('/categories');
        renderCategories();
        populateCategorySelect();

        // Fetch global stats
        await fetchGlobalStats();

        // Auto-select last category if exists
        const lastCategoryId = getLastCategory();
        if (lastCategoryId) {
            const lastCategory = categories.find(cat => cat.id == lastCategoryId);
            if (lastCategory) {
                selectCategory(lastCategory);
            }
        }
    } catch (error) {
        console.error('Failed to fetch categories:', error);
        categories = [];
        renderCategories();
        populateCategorySelect();
    }
}

async function createCategory(name, parentId) {
    try {
        const parent_id = parentId ? parseInt(parentId) : null;
        const category = await apiRequest('/categories', {
            method: 'POST',
            body: JSON.stringify({ name, parent_id })
        });
        await fetchCategories();
        return category;
    } catch (error) {
        console.error('Failed to create category:', error);
        throw error;
    }
}

async function fetchPosts(categoryId, limit = 20, offset = 0, withMeta = false) {
    try {
        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString()
        });

        if (withMeta) {
            params.set('with_meta', 'true');
        }

        return await apiRequest(`/categories/${categoryId}/posts?${params.toString()}`);
    } catch (error) {
        console.error('Failed to fetch posts:', error);
        throw error;
    }
}

async function fetchCategoryStats(categoryId) {
    try {
        // First get post count from metadata
        const metaResponse = await apiRequest(`/categories/${categoryId}/posts?limit=1&with_meta=true`);
        const postCount = metaResponse.total_count || 0;

        // Then get all posts to calculate file stats
        let fileCount = 0;
        let totalSize = 0;
        let offset = 0;
        const limit = 100; // Process in batches

        while (true) {
            const response = await apiRequest(`/categories/${categoryId}/posts?limit=${limit}&offset=${offset}`);
            const posts = response.posts || response;

            if (posts.length === 0) break;

            posts.forEach(post => {
                if (post.attachments && post.attachments.length > 0) {
                    fileCount += post.attachments.length;
                    post.attachments.forEach(attachment => {
                        totalSize += attachment.file_size || 0;
                    });
                }
            });

            if (posts.length < limit) break; // Last batch
            offset += limit;
        }

        return {
            post_count: postCount,
            file_count: fileCount,
            total_size: totalSize
        };
    } catch (error) {
        console.error('Failed to fetch category stats:', error);
        return { post_count: 0, file_count: 0, total_size: 0 };
    }
}

async function createPost(categoryId, content) {
    try {
        return await apiRequest('/posts', {
            method: 'POST',
            body: JSON.stringify({ category_id: categoryId, content })
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
        console.error('Failed to upload file:', error);
        throw error;
    }
}

async function fetchGlobalStats() {
    try {
        const categories = await apiRequest('/categories');

        globalStats = { totalPosts: 0, totalFiles: 0, totalSize: 0 };

        // Get stats for each category using the posts endpoint
        for (const category of categories) {
            try {
                const stats = await fetchCategoryStats(category.id);
                globalStats.totalPosts += stats.post_count;
                globalStats.totalFiles += stats.file_count;
                globalStats.totalSize += stats.total_size;
            } catch (error) {
                console.error(`Failed to get stats for category ${category.id}:`, error);
            }
        }

        updateGlobalStatsDisplay();
    } catch (error) {
        console.error('Failed to fetch global stats:', error);
    }
}