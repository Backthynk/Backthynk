// UI functions
async function showCreatePost() {
    if (!currentCategory) {
        showError(window.AppConstants.USER_MESSAGES.error.pleaseSelectCategory);
        return;
    }

    // Show modal and set category info
    document.getElementById('create-post-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Set category breadcrumb in modal
    const categoryBreadcrumb = getCategoryFullBreadcrumb(currentCategory);
    document.getElementById('modal-category-name').textContent = categoryBreadcrumb;

    // Focus on content area
    document.getElementById('modal-post-content').focus();

    // Check if retroactive posting is enabled and show section
    try {
        const settings = window.currentSettings;
        const retroactiveSection = document.getElementById('modal-retroactive-section');

        if (settings && settings.retroactivePostingEnabled) {
            retroactiveSection.style.display = 'block';
            // Set default value to current time
            const now = new Date();
            const formatted = now.getFullYear() + '-' +
                              String(now.getMonth() + 1).padStart(2, '0') + '-' +
                              String(now.getDate()).padStart(2, '0') + 'T' +
                              String(now.getHours()).padStart(2, '0') + ':' +
                              String(now.getMinutes()).padStart(2, '0');
            const dateTimeInput = document.getElementById('modal-post-datetime');
            dateTimeInput.value = formatted;
            // Store the original default value to detect if user changed it
            dateTimeInput.dataset.originalValue = formatted;
        } else {
            retroactiveSection.style.display = 'none';
        }
    } catch (error) {
        console.error('Failed to load settings for retroactive posting:', error);
        // Hide the section container on error
        document.getElementById('modal-retroactive-section').style.display = 'none';
    }

    // Initialize link preview after showing the modal
    setTimeout(() => {
        initializeModalLinkPreview();
    }, window.AppConstants.UI_CONFIG.settingsTransitionDelay);
}

function hideCreatePost() {
    document.getElementById('create-post-modal').classList.add('hidden');
    document.body.style.overflow = '';
    document.getElementById('modal-create-post-form').reset();

    // Clear the datetime picker
    const dateTimeInput = document.getElementById('modal-post-datetime');
    if (dateTimeInput) {
        dateTimeInput.value = '';
    }

    // Clear modal-specific files and previews
    modalSelectedFiles.clear();
    window.modalPastedFiles = [];
    updateModalFilePreview();

    // Reset link previews when hiding modal
    resetModalLinkPreviews();
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

    // Set dynamic maxlength for category name
    document.getElementById('category-name').setAttribute('maxlength', window.AppConstants.VALIDATION_LIMITS.maxCategoryNameLength);

    document.getElementById('category-name').focus();
}

function hideCategoryModal() {
    document.getElementById('category-modal').classList.add('hidden');
    document.body.style.overflow = '';
    document.getElementById('category-form').reset();
    document.getElementById('category-description').value = '';
    updateDescriptionCounter('category-description', 'description-counter');
}

function handleCategoryModalClose() {
    if (hasCategoryContent()) {
        if (confirm('You have unsaved content. Are you sure you want to close?')) {
            hideCategoryModal();
        }
    } else {
        hideCategoryModal();
    }
}

function hasCategoryContent() {
    const name = document.getElementById('category-name').value.trim();
    const description = document.getElementById('category-description').value.trim();
    return name.length > 0 || description.length > 0;
}

function showEditCategoryModal() {
    if (!currentCategory || currentCategory.id === window.AppConstants.ALL_CATEGORIES_ID) {
        showError(window.AppConstants.USER_MESSAGES.error.pleaseSelectCategory);
        return;
    }

    document.getElementById('edit-category-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Populate form fields with current category data
    document.getElementById('edit-category-name').value = currentCategory.name;
    document.getElementById('edit-category-description').value = currentCategory.description || '';
    updateDescriptionCounter('edit-category-description', 'edit-description-counter');

    // Hide parent selector if no valid parents exist
    const parentSelectDiv = document.querySelector('#edit-category-modal .mb-4:has(#edit-category-parent)');

    // Calculate depth span to determine if any parents are possible
    function getDepthSpanBelow(categoryId) {
        const children = categories.filter(cat => cat.parent_id === categoryId);
        if (children.length === 0) return 0;

        let maxChildSpan = 0;
        for (let child of children) {
            const childSpan = 1 + getDepthSpanBelow(child.id);
            maxChildSpan = Math.max(maxChildSpan, childSpan);
        }
        return maxChildSpan;
    }

    const depthSpanBelow = getDepthSpanBelow(currentCategory.id);

    // Check if any valid parents exist (excluding descendants)
    const excludedIds = new Set([currentCategory.id]);
    function addDescendants(parentId) {
        const children = categories.filter(cat => cat.parent_id === parentId);
        children.forEach(child => {
            excludedIds.add(child.id);
            addDescendants(child.id);
        });
    }
    addDescendants(currentCategory.id);

    const hasValidParents = categories.some(cat => {
        if (excludedIds.has(cat.id)) return false;
        const newMaxDepth = cat.depth + 1 + depthSpanBelow;
        return newMaxDepth <= window.AppConstants.MAX_CATEGORY_DEPTH;
    });


    if (!hasValidParents) {
        if (parentSelectDiv) {
            parentSelectDiv.style.display = 'none';
        }
    } else {
        if (parentSelectDiv) {
            parentSelectDiv.style.display = 'block';
        }

        // Populate parent select and exclude the current category and its descendants
        populateEditCategorySelect();

        // Set current parent if exists
        if (currentCategory.parent_id) {
            document.getElementById('edit-category-parent').value = currentCategory.parent_id.toString();
        } else {
            document.getElementById('edit-category-parent').value = '';
        }
    }

    // Set dynamic maxlength for category name
    document.getElementById('edit-category-name').setAttribute('maxlength', window.AppConstants.VALIDATION_LIMITS.maxCategoryNameLength);

    document.getElementById('edit-category-name').focus();
}

function hideEditCategoryModal() {
    document.getElementById('edit-category-modal').classList.add('hidden');
    document.body.style.overflow = '';
    document.getElementById('edit-category-form').reset();
    document.getElementById('edit-category-description').value = '';
    updateDescriptionCounter('edit-category-description', 'edit-description-counter');
}

function handleEditCategoryModalClose() {
    if (hasEditCategoryContentChanged()) {
        if (confirm('You have unsaved content. Are you sure you want to close?')) {
            hideEditCategoryModal();
        }
    } else {
        hideEditCategoryModal();
    }
}

function hasEditCategoryContentChanged() {
    if (!currentCategory) return false;

    const name = document.getElementById('edit-category-name').value.trim();
    const description = document.getElementById('edit-category-description').value.trim();
    const parentId = document.getElementById('edit-category-parent').value || null;

    const currentParentId = currentCategory.parent_id ? currentCategory.parent_id.toString() : null;
    const newParentId = parentId ? parentId.toString() : null;

    const nameChanged = name !== currentCategory.name;
    const descriptionChanged = description !== (currentCategory.description || '');
    const parentChanged = currentParentId !== newParentId;

    return nameChanged || descriptionChanged || parentChanged;
}

function populateCategorySelect() {
    const select = document.getElementById('category-parent');
    select.innerHTML = '<option value="">None (Root Category)</option>';

    // Filter categories that can accept children (depth < MAX_CATEGORY_DEPTH)
    const availableCategories = categories.filter(cat => cat.depth < window.AppConstants.MAX_CATEGORY_DEPTH);

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

    // Filter available categories (exclude self and descendants, and prevent depth violations)
    // If a category is selected as parent, the current category would have depth = parent.depth + 1

    // Calculate the depth span of the current category tree (from current category to deepest descendant)
    function getDepthSpanBelow(categoryId) {
        const children = categories.filter(cat => cat.parent_id === categoryId);
        if (children.length === 0) return 0; // No children, span is 0

        let maxChildSpan = 0;
        for (let child of children) {
            const childSpan = 1 + getDepthSpanBelow(child.id);
            maxChildSpan = Math.max(maxChildSpan, childSpan);
        }
        return maxChildSpan;
    }

    const depthSpanBelow = getDepthSpanBelow(currentCategory.id);

    const availableCategories = categories.filter(cat => {
        if (excludedIds.has(cat.id)) return false;

        // Include current parent so user can keep it selected (no change)

        // If we move currentCategory under cat, currentCategory will have depth = cat.depth + 1
        // The deepest descendant will have depth = cat.depth + 1 + depthSpanBelow
        const newMaxDepth = cat.depth + 1 + depthSpanBelow;
        return newMaxDepth <= window.AppConstants.MAX_CATEGORY_DEPTH;
    });

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

function getCategoryFullBreadcrumb(category) {
    if (!category || category.id === window.AppConstants.ALL_CATEGORIES_ID) {
        return 'All Categories';
    }

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

    return path.join(' > ');
}

