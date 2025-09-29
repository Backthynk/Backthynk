// UI functions
async function showCreatePost() {
    if (!currentCategory) {
        showError(window.AppConstants.USER_MESSAGES.error.pleaseSelectCategory);
        return;
    }

    document.getElementById('create-post-section').style.display = 'block';
    document.getElementById('new-post-btn').style.display = 'none';
    document.getElementById('settings-btn').style.display = 'none';
    document.getElementById('new-post-btn-sticky').style.display = 'none';
    document.getElementById('post-content').focus();

    // Check if retroactive posting is enabled
    try {
        const settings = window.currentSettings;
        const retroactiveDateContainer = document.getElementById('retroactive-date-container');

        if (settings && settings.retroactivePostingEnabled) {
            retroactiveDateContainer.style.display = 'block';
            // Set default value to current time
            const now = new Date();
            const formatted = now.getFullYear() + '-' +
                              String(now.getMonth() + 1).padStart(2, '0') + '-' +
                              String(now.getDate()).padStart(2, '0') + 'T' +
                              String(now.getHours()).padStart(2, '0') + ':' +
                              String(now.getMinutes()).padStart(2, '0');
            const dateTimeInput = document.getElementById('post-datetime');
            dateTimeInput.value = formatted;
            // Store the original default value to detect if user changed it
            dateTimeInput.dataset.originalValue = formatted;
        } else {
            retroactiveDateContainer.style.display = 'none';
        }
    } catch (error) {
        console.error('Failed to load settings for retroactive posting:', error);
        // Hide the date container on error
        document.getElementById('retroactive-date-container').style.display = 'none';
    }

    // Initialize link preview after showing the form
    setTimeout(() => {
        initializeLinkPreview();
    }, window.AppConstants.UI_CONFIG.settingsTransitionDelay);
}

function hideCreatePost() {
    document.getElementById('create-post-section').style.display = 'none';
    document.getElementById('create-post-form').reset();

    // Clear the datetime picker
    const dateTimeInput = document.getElementById('post-datetime');
    if (dateTimeInput) {
        dateTimeInput.value = '';
    }

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

