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

async function fetchPosts(categoryId, limit = 20, offset = 0) {
    try {
        return await apiRequest(`/categories/${categoryId}/posts?limit=${limit}&offset=${offset}`);
    } catch (error) {
        console.error('Failed to fetch posts:', error);
        throw error;
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

async function fetchCategoryStats(categoryId) {
    try {
        const posts = await fetchPosts(categoryId, 1000, 0); // Get all posts
        let totalFiles = 0;
        let totalSize = 0;

        posts.forEach(post => {
            if (post.attachments) {
                totalFiles += post.attachments.length;
                post.attachments.forEach(att => {
                    totalSize += att.file_size;
                });
            }
        });

        categoryStats[categoryId] = {
            posts: posts.length,
            files: totalFiles,
            size: totalSize
        };

        return categoryStats[categoryId];
    } catch (error) {
        console.error('Failed to fetch category stats:', error);
        return { posts: 0, files: 0, size: 0 };
    }
}

async function fetchGlobalStats() {
    try {
        globalStats = { totalPosts: 0, totalFiles: 0, totalSize: 0 };

        for (const category of categories) {
            const stats = await fetchCategoryStats(category.id);
            globalStats.totalPosts += stats.posts;
            globalStats.totalFiles += stats.files;
            globalStats.totalSize += stats.size;
        }

        updateGlobalStatsDisplay();
    } catch (error) {
        console.error('Failed to fetch global stats:', error);
    }
}

async function getTotalPostsInCategory(categoryId) {
    try {
        const posts = await fetchPosts(categoryId, 1000, 0);
        return posts.length;
    } catch (error) {
        return 0;
    }
}