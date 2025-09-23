// State management
let currentCategory = null;
let categories = [];
let expandedCategories = new Set();
let selectedFiles = new Map(); // Store selected files with unique IDs
let fileCounter = 0;
let currentImageGallery = [];
let currentImageIndex = 0;
let categoryStats = {};
let globalStats = { totalPosts: 0, totalFiles: 0, totalSize: 0 };
let categoryActivity = {};
let currentActivityPeriod = 0; // 0 = current 6 months, -1 = previous 6 months, etc.


// Local storage for last selected category
function saveLastCategory(categoryId) {
    localStorage.setItem('lastSelectedCategory', categoryId);
}

function getLastCategory() {
    return localStorage.getItem('lastSelectedCategory');
}

function saveExpandedCategories() {
    localStorage.setItem('expandedCategories', JSON.stringify([...expandedCategories]));
}

function loadExpandedCategories() {
    const saved = localStorage.getItem('expandedCategories');
    if (saved) {
        expandedCategories = new Set(JSON.parse(saved));
    }
}

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

// UI functions
function renderCategories() {
    const container = document.getElementById('categories-tree');
    container.innerHTML = '';

    const rootCategories = categories.filter(cat => !cat.parent_id);

    rootCategories.forEach(category => {
        const element = createCategoryElement(category);
        container.appendChild(element);
    });
}

function createCategoryElement(category, level = 0) {
    const div = document.createElement('div');
    div.className = 'category-item';

    const hasChildren = categories.some(cat => cat.parent_id === category.id);
    const isExpanded = expandedCategories.has(category.id);
    const shouldShowChildren = isExpanded; // Remove the level === 0 condition

    const mainDiv = document.createElement('div');
    mainDiv.className = 'flex items-center group hover:bg-gray-50 rounded-lg transition-colors';

    // Expand/collapse button (separate from main button)
    let expandButton = '';
    if (hasChildren) {
        expandButton = `
            <button class="expand-btn flex-shrink-0 w-6 h-6 flex items-center justify-center hover:bg-gray-200 rounded transition-colors mr-1" style="margin-left: ${level * 16}px;">
                <i class="fas fa-chevron-${isExpanded ? 'down' : 'right'} text-xs text-gray-400"></i>
            </button>
        `;
    } else {
        expandButton = `<div class="w-6 h-6 mr-1" style="margin-left: ${level * 16 + (hasChildren ? 0 : 6)}px;"></div>`;
    }

    // Main category button
    const categoryButton = document.createElement('button');
    categoryButton.className = `category-btn flex-1 text-left px-2 py-2 rounded-md transition-colors min-w-0 ${
        currentCategory?.id === category.id ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
    }`;

    categoryButton.innerHTML = `
        <div class="flex items-center justify-between min-w-0">
            <div class="flex items-center min-w-0">
                <i class="fas fa-folder${currentCategory?.id === category.id ? '-open' : ''} mr-2 flex-shrink-0"></i>
                <span class="font-medium truncate" title="${category.name}">${category.name}</span>
            </div>
            <div class="text-xs text-gray-400 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                ${formatRelativeDate(category.created)}
            </div>
        </div>
    `;

    // Delete button
    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-btn flex-shrink-0 w-8 h-8 flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100 ml-1';
    deleteButton.innerHTML = '<i class="fas fa-trash-alt text-xs"></i>';

    mainDiv.innerHTML = expandButton;
    mainDiv.appendChild(categoryButton);
    mainDiv.appendChild(deleteButton);
    
    div.appendChild(mainDiv);

    // Add event listeners after elements are created
    const expandBtn = mainDiv.querySelector('.expand-btn');
    if (expandBtn) {
        expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCategory(category.id);
        });
    }

    categoryButton.addEventListener('click', (e) => {
        e.stopPropagation();
        selectCategory(category);
    });

    deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCategory(category);
    });

    // Add subcategories only if expanded
    if (hasChildren && shouldShowChildren) {
        const subcategories = categories.filter(cat => cat.parent_id === category.id);
        subcategories.forEach(subcat => {
            const subElement = createCategoryElement(subcat, level + 1);
            div.appendChild(subElement);
        });
    }

    return div;
}


function toggleCategory(categoryId) {
    if (expandedCategories.has(categoryId)) {
        expandedCategories.delete(categoryId);
    } else {
        expandedCategories.add(categoryId);
    }
    saveExpandedCategories();
    renderCategories();
}

async function selectCategory(category) {
    currentCategory = category;
    saveLastCategory(category.id);
    renderCategories();
    loadPosts(category.id);

    // Reset activity period when switching categories
    currentActivityPeriod = 0;

    const stats = await fetchCategoryStats(category.id);
    const statsText = `${stats.posts} posts • ${stats.files} files • ${formatFileSize(stats.size)}`;
    
    document.getElementById('timeline-title').innerHTML = `
        <div>
            <h2 class="text-2xl font-bold text-gray-900">${category.name}</h2>
            <p class="text-sm text-gray-500">${statsText}</p>
        </div>
    `;
    document.getElementById('new-post-btn').style.display = 'block';
    
    generateActivityHeatmap();
}

async function loadPosts(categoryId) {
    try {
        const posts = await fetchPosts(categoryId);
        renderPosts(posts);
    } catch (error) {
        console.error('Failed to fetch posts:', error);
        renderPosts([]);
    }
}

function renderPosts(posts) {
    const container = document.getElementById('posts-container');
    container.innerHTML = '';

    if (posts.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-inbox text-4xl mb-4"></i>
                <p>No posts yet. Create your first post!</p>
            </div>
        `;
        return;
    }

    posts.forEach(post => {
        const element = createPostElement(post);
        container.appendChild(element);
    });
}

function createPostElement(post) {
    const div = document.createElement('div');
    div.className = 'bg-white rounded-lg shadow-sm border p-6 mb-6 hover:shadow-md transition-shadow group max-w-full';

    const images = post.attachments ? post.attachments.filter(att => att.file_type.startsWith('image/')) : [];
    const otherFiles = post.attachments ? post.attachments.filter(att => !att.file_type.startsWith('image/')) : [];
    const totalAttachments = images.length + otherFiles.length;

    // Simple header
    const headerHtml = `
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-2">
                <span class="text-sm text-gray-500">${formatRelativeDate(post.created)}</span>
                ${totalAttachments > 0 ? `
                    <span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                        ${totalAttachments} file${totalAttachments > 1 ? 's' : ''}
                    </span>
                ` : ''}
            </div>
            <button onclick="confirmDeletePost(${post.id})" class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1 rounded transition-all">
                <i class="fas fa-trash-alt text-sm"></i>
            </button>
        </div>
    `;

    // Content
    const contentHtml = `
        <div class="mb-4">
            <p class="text-gray-900 leading-relaxed whitespace-pre-wrap">${escapeHtml(post.content)}</p>
        </div>
    `;

    // Simple attachments
    let attachmentsHtml = '';
    if (totalAttachments > 0) {
        attachmentsHtml = '<div class="border-t pt-4 space-y-3">';
        
        // Images - simple grid
        if (images.length > 0) {
            const imageData = images.map(img => ({url: '/uploads/' + img.file_path, filename: img.filename}));
            
            if (images.length === 1) {
                attachmentsHtml += `
                    <div class="max-w-lg">
                        <img src="/uploads/${images[0].file_path}" 
                             alt="${images[0].filename}" 
                             class="w-full rounded-lg border cursor-pointer hover:opacity-90"
                             onclick="openImageGallery(0)" 
                             data-images='${JSON.stringify(imageData)}'>
                    </div>
                `;
            } else {
                attachmentsHtml += `
                    <div class="grid grid-cols-2 gap-2 max-w-lg">
                        ${images.slice(0, 4).map((img, idx) => `
                            <img src="/uploads/${img.file_path}" 
                                 alt="${img.filename}" 
                                 class="w-full h-32 object-cover rounded border cursor-pointer hover:opacity-90"
                                 onclick="openImageGallery(${idx})" 
                                 data-images='${JSON.stringify(imageData)}'>
                        `).join('')}
                    </div>
                `;
                
                if (images.length > 4) {
                    attachmentsHtml += `<p class="text-sm text-gray-500">+${images.length - 4} more images</p>`;
                }
            }
        }

        // Other files - simple list
        if (otherFiles.length > 0) {
            attachmentsHtml += `
                <div class="space-y-2">
                    ${otherFiles.map(file => `
                        <div class="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                             onclick="window.open('/uploads/${file.file_path}', '_blank')">
                            <i class="fas fa-file text-gray-500 mr-3"></i>
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium text-gray-900 truncate">${file.filename}</p>
                                <p class="text-xs text-gray-500">${formatFileSize(file.file_size)}</p>
                            </div>
                            <i class="fas fa-external-link-alt text-gray-400 text-xs"></i>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        attachmentsHtml += '</div>';
    }

    div.innerHTML = headerHtml + contentHtml + attachmentsHtml;
    return div;
}




// File Management
function addFileToSelection(file) {
    if (selectedFiles.size >= 20) {
        showError('Maximum 20 files allowed per post');
        return false;
    }
    
    const fileId = ++fileCounter;
    selectedFiles.set(fileId, file);
    updateFilePreview();
    return true;
}

function removeFileFromSelection(fileId) {
    selectedFiles.delete(fileId);
    updateFilePreview();
}

function updateFilePreview() {
    const container = document.getElementById('file-preview-container');
    container.innerHTML = '';
    
    if (selectedFiles.size === 0) return;
    
    const filesArray = Array.from(selectedFiles.entries());
    filesArray.forEach(([fileId, file]) => {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'flex items-center justify-between bg-gray-50 border border-gray-200 rounded p-3';
        
        const isImage = file.type.startsWith('image/');
        let preview = '';
        
        if (isImage) {
            const objectUrl = URL.createObjectURL(file);
            preview = `<img src="${objectUrl}" class="w-12 h-12 object-cover rounded mr-3">`;
        } else {
            preview = `<div class="w-12 h-12 bg-gray-200 rounded mr-3 flex items-center justify-center">
                <i class="fas fa-file text-gray-500"></i>
            </div>`;
        }
        
        fileDiv.innerHTML = `
            <div class="flex items-center">
                ${preview}
                <div>
                    <p class="text-sm font-medium text-gray-900 truncate" style="max-width: 200px;">${file.name}</p>
                    <p class="text-xs text-gray-500">${formatFileSize(file.size)}</p>
                </div>
            </div>
            <button type="button" onclick="removeFileFromSelection(${fileId})" class="text-red-600 hover:text-red-800 p-1">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(fileDiv);
    });
}

function updatePastedFilesDisplay() {
    const container = document.getElementById('pasted-files-display');
    container.innerHTML = '';

    if (window.pastedFiles && window.pastedFiles.length > 0) {
        const label = document.createElement('div');
        label.className = 'text-sm font-medium text-gray-700 mb-2';
        label.textContent = 'Pasted Images:';
        container.appendChild(label);

        window.pastedFiles.forEach((file, index) => {
            const fileDiv = document.createElement('div');
            fileDiv.className = 'flex items-center justify-between bg-blue-50 border border-blue-200 rounded p-2 mb-1';
            fileDiv.innerHTML = `
                <span class="text-sm text-blue-700">
                    <i class="fas fa-image mr-2"></i>${file.name}
                </span>
                <button type="button" onclick="removePastedFile(${index})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-times"></i>
                </button>
            `;
            container.appendChild(fileDiv);
        });
    }
}

function removePastedFile(index) {
    if (window.pastedFiles && window.pastedFiles.length > index) {
        window.pastedFiles.splice(index, 1);
        updatePastedFilesDisplay();
    }
}


function openImageGallery(startIndex = 0) {
    const element = event.target.closest('[data-images]');
    const imagesData = element.getAttribute('data-images');
    
    if (imagesData) {
        currentImageGallery = JSON.parse(imagesData);
    } else {
        // Single image case
        const img = element.querySelector('img');
        currentImageGallery = [{
            url: img.src,
            filename: img.alt
        }];
    }
    
    currentImageIndex = startIndex;
    
    const modal = document.getElementById('image-viewer-modal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    updateImageViewer();
    
    const prevBtn = document.getElementById('viewer-prev');
    const nextBtn = document.getElementById('viewer-next');
    
    prevBtn.style.display = currentImageGallery.length > 1 ? 'block' : 'none';
    nextBtn.style.display = currentImageGallery.length > 1 ? 'block' : 'none';
}

function updateImageViewer() {
    const img = document.getElementById('viewer-image');
    const filename = document.getElementById('viewer-filename');
    const counter = document.getElementById('viewer-counter');
    
    const currentImage = currentImageGallery[currentImageIndex];
    
    img.src = currentImage.url;
    filename.textContent = currentImage.filename;
    
    if (currentImageGallery.length > 1) {
        counter.textContent = `${currentImageIndex + 1} / ${currentImageGallery.length}`;
        } else {
        counter.textContent = '';
    }
}

function closeImageViewer() {
    const modal = document.getElementById('image-viewer-modal');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

function navigateImage(direction) {
    if (currentImageGallery.length <= 1) return;
    
    if (direction === 'prev') {
        currentImageIndex = currentImageIndex > 0 ? currentImageIndex - 1 : currentImageGallery.length - 1;
    } else {
        currentImageIndex = currentImageIndex < currentImageGallery.length - 1 ? currentImageIndex + 1 : 0;
    }
    
    updateImageViewer();
}

// Utility functions
function populateCategorySelect() {
    const select = document.getElementById('category-parent');
    select.innerHTML = '<option value="">None (Root Category)</option>';

    const availableCategories = categories.filter(cat => cat.depth < 2);

    availableCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = '  '.repeat(category.depth) + category.name;
        select.appendChild(option);
    });
}

function showCreatePost() {
    if (!currentCategory) {
        showError('Please select a category first');
        return;
    }

    document.getElementById('create-post-section').style.display = 'block';
    document.getElementById('post-content').focus();
}

function hideCreatePost() {
    document.getElementById('create-post-section').style.display = 'none';
    document.getElementById('create-post-form').reset();
    selectedFiles.clear();
    updateFilePreview();
    window.pastedFiles = [];
    updatePastedFilesDisplay();
}

function showCategoryModal() {
    document.getElementById('category-modal').classList.remove('hidden');
    document.getElementById('category-name').focus();
}

function hideCategoryModal() {
    document.getElementById('category-modal').classList.add('hidden');
    document.getElementById('category-form').reset();
}

function showError(message) {
    alert(message);
}

async function deleteCategory(category) {
    const subcategories = categories.filter(cat => cat.parent_id === category.id);
    const totalPosts = await getTotalPostsInCategory(category.id);

    let message = `Are you sure you want to delete "${category.name}"?`;

    if (subcategories.length > 0) {
        message += `\n\nThis will also delete ${subcategories.length} subcategory(ies)`;
    }

    if (totalPosts > 0) {
        message += ` and ${totalPosts} post(s) with all their files.`;
    }

    message += '\n\nThis action cannot be undone.';

    if (confirm(message)) {
        try {
            await deleteCategoryApi(category.id);
            await fetchCategories();
            if (currentCategory && currentCategory.id === category.id) {
                currentCategory = null;
                localStorage.removeItem('lastSelectedCategory');
                document.getElementById('timeline-title').textContent = 'Select a category';
                document.getElementById('new-post-btn').style.display = 'none';
                document.getElementById('posts-container').innerHTML = '';
            }
        } catch (error) {
            showError('Failed to delete category: ' + error.message);
        }
    }
}

async function confirmDeletePost(postId) {
    if (confirm('Are you sure you want to delete this post?\n\nThis will also delete all attached files.\n\nThis action cannot be undone.')) {
        try {
            await deletePost(postId);
            loadPosts(currentCategory.id);
        } catch (error) {
            showError('Failed to delete post: ' + error.message);
        }
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


function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Load saved state
    loadExpandedCategories();
    
    // Load initial data
    fetchCategories();

    // Category modal events
    document.getElementById('add-category-btn').onclick = showCategoryModal;
    document.getElementById('cancel-category').onclick = hideCategoryModal;

    document.getElementById('category-form').onsubmit = async function(e) {
        e.preventDefault();

        const name = document.getElementById('category-name').value;
        
        if (name.length > 30) {
            showError('Category name must be 30 characters or less');
            return;
        }
        
        const parentId = document.getElementById('category-parent').value || null;

        try {
            await createCategory(name, parentId);
            hideCategoryModal();
        } catch (error) {
            showError(error.message);
        }
    };

    // Post creation events
    document.getElementById('new-post-btn').onclick = showCreatePost;
    document.getElementById('cancel-post').onclick = hideCreatePost;

    // File input handling
    const fileInput = document.getElementById('post-files');
    fileInput.addEventListener('change', function(e) {
        for (let file of e.target.files) {
            addFileToSelection(file);
        }
        // Reset input to allow selecting same file again
        e.target.value = '';
    });

    // Drag and drop
    const dropZone = fileInput.parentElement;
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        dropZone.classList.add('bg-blue-50', 'border-blue-300');
    });

    dropZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        dropZone.classList.remove('bg-blue-50', 'border-blue-300');
    });

    dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        dropZone.classList.remove('bg-blue-50', 'border-blue-300');
        
        for (let file of e.dataTransfer.files) {
            addFileToSelection(file);
        }
    });

    document.getElementById('create-post-form').onsubmit = async function(e) {
        e.preventDefault();

        if (!currentCategory) {
            showError('No category selected');
            return;
        }

        const content = document.getElementById('post-content').value;

        if (!content.trim()) {
            showError('Content is required');
            return;
        }

        try {
            const post = await createPost(currentCategory.id, content);

            // Upload selected files
            for (let [fileId, file] of selectedFiles) {
                await uploadFile(post.id, file);
            }

            // Upload pasted files
            if (window.pastedFiles && window.pastedFiles.length > 0) {
                for (let file of window.pastedFiles) {
                    await uploadFile(post.id, file);
                }
                window.pastedFiles = [];
            }

            hideCreatePost();
            loadPosts(currentCategory.id);
        } catch (error) {
            showError(error.message);
        }
    };

    // Paste event for images
    document.getElementById('post-content').addEventListener('paste', function(e) {
        const items = e.clipboardData.items;

        for (let item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();

                const file = item.getAsFile();
                if (file) {
                    if (!window.pastedFiles) {
                        window.pastedFiles = [];
                    }

                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const extension = file.type.split('/')[1] || 'png';
                    const newFile = new File([file], `pasted-image-${timestamp}.${extension}`, { type: file.type });

                    window.pastedFiles.push(newFile);

                    const currentContent = document.getElementById('post-content').value;
                    document.getElementById('post-content').value = currentContent + (currentContent ? '\n\n' : '') + `[Image pasted: ${newFile.name}]`;

                    updatePastedFilesDisplay();
                }
            }
        }
    });

    // Image viewer events
    document.getElementById('viewer-close').onclick = closeImageViewer;
    document.getElementById('viewer-prev').onclick = () => navigateImage('prev');
    document.getElementById('viewer-next').onclick = () => navigateImage('next');
    
    // Keyboard navigation for image viewer
    document.addEventListener('keydown', function(e) {
        const modal = document.getElementById('image-viewer-modal');
        if (!modal.classList.contains('hidden')) {
            switch(e.key) {
                case 'Escape':
                    closeImageViewer();
                    break;
                case 'ArrowLeft':
                    navigateImage('prev');
                    break;
                case 'ArrowRight':
                    navigateImage('next');
                    break;
            }
        }
    });

    // Close modal when clicking outside
    document.getElementById('category-modal').onclick = function(e) {
        if (e.target === this) {
            hideCategoryModal();
        }
    };
    
    document.getElementById('image-viewer-modal').onclick = function(e) {
        if (e.target === this) {
            closeImageViewer();
        }
    };
});

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

function updateGlobalStatsDisplay() {
    const statsHtml = `
        <div>Total: ${globalStats.totalPosts} posts</div>
        <div>${globalStats.totalFiles} files • ${formatFileSize(globalStats.totalSize)}</div>
    `;
    
    // Update header stats
    const headerStats = document.getElementById('global-stats-header');
    if (headerStats) {
        headerStats.innerHTML = statsHtml;
    }
}

function formatRelativeDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) return 'now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    // More than a week ago
    if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
}



async function generateActivityHeatmap() {
    if (!currentCategory) {
        document.getElementById('activity-container').style.display = 'none';
        return;
    }

    document.getElementById('activity-container').style.display = 'block';

    try {
        const posts = await fetchPosts(currentCategory.id, 1000, 0);
        
        if (posts.length === 0) {
            document.getElementById('activity-heatmap').innerHTML = '<p class="text-xs text-gray-500">No posts in this category</p>';
            return;
        }

        // Find the earliest post date
        const earliestPost = new Date(Math.min(...posts.map(post => new Date(post.created))));
        const today = new Date();
        
        // Calculate how many 6-month periods we need to go back to include the earliest post
        const monthsDiff = (today.getFullYear() - earliestPost.getFullYear()) * 12 + (today.getMonth() - earliestPost.getMonth());
        const maxPeriods = Math.ceil(monthsDiff / 6);
        
        // If this is the first time viewing, start from the period that contains posts
        if (currentActivityPeriod === 0 && maxPeriods > 0) {
            currentActivityPeriod = -Math.max(0, maxPeriods - 1);
        }
        
        const activityMap = {};
        posts.forEach(post => {
            const date = new Date(post.created);
            const dateKey = date.toISOString().split('T')[0];
            activityMap[dateKey] = (activityMap[dateKey] || 0) + 1;
        });

        generateHeatmapForPeriod(activityMap, maxPeriods);
        
    } catch (error) {
        console.error('Failed to generate activity heatmap:', error);
        document.getElementById('activity-heatmap').innerHTML = '<p class="text-xs text-red-500">Failed to load activity</p>';
    }
}

function generateHeatmapForPeriod(activityMap, maxPeriods) {
    const today = new Date();
    const periodStart = new Date(today);
    periodStart.setMonth(today.getMonth() + (6 * currentActivityPeriod));
    periodStart.setDate(1);
    
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodStart.getMonth() + 6);
    
    // Update period label
    const startMonth = periodStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const endMonth = new Date(periodEnd.getTime() - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    document.getElementById('activity-period').textContent = `${startMonth} - ${endMonth}`;
    
    // Generate all days in the 6-month period
    const days = [];
    const currentDate = new Date(periodStart);
    
    while (currentDate < periodEnd) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const count = activityMap[dateKey] || 0;
        const intensity = getIntensityLevel(count);
        
        days.push({
            date: dateKey,
            count: count,
            intensity: intensity,
            month: currentDate.getMonth(),
            day: currentDate.getDate()
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Calculate dynamic squares per row
    const squaresPerRow = 12; // Fixed number that works well for sidebar
    const rows = Math.ceil(days.length / squaresPerRow);
    
    let html = '<div class="space-y-1">';
    let lastMonthShown = -1;
    
    for (let row = 0; row < rows; row++) {
        const startIndex = row * squaresPerRow;
        const endIndex = Math.min(startIndex + squaresPerRow, days.length);
        
        // Get the first day of this row to determine month label
        const firstDay = days[startIndex];
        const currentMonth = firstDay ? firstDay.month : -1;
        
        // Only show month label when it changes
        let monthLabel = '';
        if (currentMonth !== lastMonthShown) {
            monthLabel = new Date(firstDay.date).toLocaleDateString('en-US', { month: 'short' });
            lastMonthShown = currentMonth;
        }
        
        html += '<div class="flex items-center">';
        
        // Month label aligned to the left (no margin-right)
        html += `<div class="w-8 text-xs text-gray-400 flex-shrink-0">${monthLabel}</div>`;
        
        // Squares row starting right after month label
        html += '<div class="flex gap-1">';
        
        for (let i = startIndex; i < endIndex; i++) {
            if (i < days.length) {
                const day = days[i];
                const colorClass = getColorClass(day.intensity);
                html += `<div class="w-3 h-3 ${colorClass} rounded-sm cursor-pointer heatmap-cell hover:ring-1 hover:ring-gray-300 transition-all flex-shrink-0" 
                             data-date="${day.date}" 
                             data-count="${day.count}"
                             data-day="${new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}">
                         </div>`;
            }
        }
        
        html += '</div></div>';
    }
    
    html += '</div>';
    document.getElementById('activity-heatmap').innerHTML = html;
    
    // Update summary
    const totalPosts = days.reduce((sum, day) => sum + day.count, 0);
    const activeDays = days.filter(day => day.count > 0).length;
    document.getElementById('activity-summary').textContent = `${totalPosts} posts on ${activeDays} days`;
    
    // Update navigation buttons
    document.getElementById('activity-next').disabled = currentActivityPeriod >= 0;
    document.getElementById('activity-prev').disabled = currentActivityPeriod <= -maxPeriods;
    
    addHeatmapTooltips();
}

function changeActivityPeriod(direction) {
    currentActivityPeriod += direction;
    generateActivityHeatmap();
}


function getIntensityLevel(count) {
    if (count === 0) return 0;
    if (count === 1) return 1;
    if (count <= 3) return 2;
    if (count <= 5) return 3;
    return 4;
}

function getColorClass(intensity) {
    const colors = [
        'bg-gray-100',      // 0 posts
        'bg-green-200',     // 1 post
        'bg-green-400',     // 2-3 posts
        'bg-green-600',     // 4-5 posts
        'bg-green-800'      // 6+ posts
    ];
    return colors[intensity] || colors[0];
}


function addHeatmapTooltips() {
    const cells = document.querySelectorAll('.heatmap-cell');
    let tooltip = null;
    
    cells.forEach(cell => {
        cell.addEventListener('mouseenter', (e) => {
            const count = e.target.getAttribute('data-count');
            const day = e.target.getAttribute('data-day');
            
            tooltip = document.createElement('div');
            tooltip.className = 'absolute bg-gray-900 text-white text-xs px-3 py-2 rounded shadow-lg pointer-events-none z-50 max-w-xs';
            tooltip.innerHTML = `
                <div class="font-medium">${count} post${count !== '1' ? 's' : ''}</div>
                <div class="text-gray-300">${day}</div>
            `;
            
            document.body.appendChild(tooltip);
            
            const rect = e.target.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();
            
            // Position tooltip to the right, or left if no space
            let left = rect.right + 10;
            if (left + tooltipRect.width > window.innerWidth) {
                left = rect.left - tooltipRect.width - 10;
            }
            
            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${rect.top + window.scrollY - tooltipRect.height - 5}px`;
        });
        
        cell.addEventListener('mouseleave', () => {
            if (tooltip) {
                document.body.removeChild(tooltip);
                tooltip = null;
            }
        });
    });
}


// Add this to the DOMContentLoaded event listener
window.addEventListener('resize', function() {
    if (currentCategory && document.getElementById('activity-container').style.display !== 'none') {
        // Debounce resize events
        clearTimeout(window.resizeTimeout);
        window.resizeTimeout = setTimeout(function() {
            generateActivityHeatmap();
        }, 250);
    }
});