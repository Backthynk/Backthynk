// UI functions
function showCreatePost() {
    if (!currentCategory) {
        showError('Please select a category first');
        return;
    }

    document.getElementById('create-post-section').style.display = 'block';
    document.getElementById('new-post-btn').style.display = 'none';
    document.getElementById('settings-btn').style.display = 'none';
    document.getElementById('new-post-btn-sticky').style.display = 'none';
    document.getElementById('post-content').focus();
    
    // Initialize link preview after showing the form
    setTimeout(() => {
        initializeLinkPreview();
    }, window.AppConstants.UI_CONFIG.settingsTransitionDelay);
}

function hideCreatePost() {
    document.getElementById('create-post-section').style.display = 'none';
    document.getElementById('create-post-form').reset();
    selectedFiles.clear();
    updateFilePreview();
    window.pastedFiles = [];
    updatePastedFilesDisplay();
    document.getElementById('new-post-btn').style.display = 'block';
    document.getElementById('settings-btn').style.display = 'block';
    document.getElementById('new-post-btn-sticky').style.display = 'block';
    
    // Reset link previews when hiding form
    resetLinkPreviews();
}

function showCategoryModal() {
    document.getElementById('category-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Set current category as default parent (if any and not "All categories")
    const parentSelect = document.getElementById('category-parent');
    if (currentCategory && currentCategory.id !== window.AppConstants.ALL_CATEGORIES_ID) {
        parentSelect.value = currentCategory.id.toString();
    } else {
        parentSelect.value = ''; // None (Root Category)
    }

    document.getElementById('category-name').focus();
}

function hideCategoryModal() {
    document.getElementById('category-modal').classList.add('hidden');
    document.body.style.overflow = '';
    document.getElementById('category-form').reset();
    document.getElementById('category-description').value = '';
    updateDescriptionCounter('category-description', 'description-counter');
}

function showEditCategoryModal() {
    if (!currentCategory || currentCategory.id === window.AppConstants.ALL_CATEGORIES_ID) {
        showError('Please select a category first');
        return;
    }

    document.getElementById('edit-category-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Populate form fields with current category data
    document.getElementById('edit-category-name').value = currentCategory.name;
    document.getElementById('edit-category-description').value = currentCategory.description || '';
    updateDescriptionCounter('edit-category-description', 'edit-description-counter');

    // Populate parent select and exclude the current category and its descendants
    populateEditCategorySelect();

    // Set current parent if exists
    if (currentCategory.parent_id) {
        document.getElementById('edit-category-parent').value = currentCategory.parent_id.toString();
    } else {
        document.getElementById('edit-category-parent').value = '';
    }

    document.getElementById('edit-category-name').focus();
}

function hideEditCategoryModal() {
    document.getElementById('edit-category-modal').classList.add('hidden');
    document.body.style.overflow = '';
    document.getElementById('edit-category-form').reset();
    document.getElementById('edit-category-description').value = '';
    updateDescriptionCounter('edit-category-description', 'edit-description-counter');
}

function populateCategorySelect() {
    const select = document.getElementById('category-parent');
    select.innerHTML = '<option value="">None (Root Category)</option>';

    const availableCategories = categories.filter(cat => cat.depth < 2);

    availableCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;

        // Build breadcrumb path with emphasis on last item
        const breadcrumbPath = getCategoryBreadcrumbPath(category.id, true);
        option.textContent = breadcrumbPath;

        select.appendChild(option);
    });
}

function populateEditCategorySelect() {
    const select = document.getElementById('edit-category-parent');
    select.innerHTML = '<option value="">None (Root Category)</option>';

    // Get all descendant IDs of the current category to exclude them
    const excludedIds = new Set([currentCategory.id]);

    function addDescendants(parentId) {
        const children = categories.filter(cat => cat.parent_id === parentId);
        children.forEach(child => {
            excludedIds.add(child.id);
            addDescendants(child.id);
        });
    }

    addDescendants(currentCategory.id);

    // Filter available categories (exclude self and descendants, and respect depth limit)
    const availableCategories = categories.filter(cat =>
        !excludedIds.has(cat.id) && cat.depth < 2
    );

    availableCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;

        // Build breadcrumb path with emphasis on last item
        const breadcrumbPath = getCategoryBreadcrumbPath(category.id, true);
        option.textContent = breadcrumbPath;

        select.appendChild(option);
    });
}

function getCategoryBreadcrumbPath(categoryId, emphasizeLast = false) {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return '';

    const path = [];
    let current = category;

    while (current) {
        path.unshift(current.name);
        if (current.parent_id) {
            current = categories.find(cat => cat.id === current.parent_id);
        } else {
            current = null;
        }
    }

    if (emphasizeLast && path.length > 1) {
        // Add visual emphasis to the last part (use different arrow and spacing)
        const parentPath = path.slice(0, -1).join(' > ');
        const lastItem = path[path.length - 1];
        return `${parentPath} ➤ ${lastItem}`;
    }

    return path.join(' > ');
}

function updateDescriptionCounter(textareaId, counterId) {
    const textarea = document.getElementById(textareaId);
    const counter = document.getElementById(counterId);
    if (textarea && counter) {
        counter.textContent = textarea.value.length;
    }
}

function updateGlobalStatsDisplay() {
    let statsHtml = `<div>Total: ${globalStats.totalPosts} posts</div>`;

    // Only show file stats if enabled
    if (fileStatsEnabled) {
        statsHtml += `<div>${globalStats.totalFiles} files • ${formatFileSize(globalStats.totalSize)}</div>`;
    }

    // Update header stats
    const headerStats = document.getElementById('global-stats-header');
    if (headerStats) {
        headerStats.innerHTML = statsHtml;
    }
}