// UI functions
async function showCreatePost() {
    if (!currentSpace) {
        showError(window.AppConstants.USER_MESSAGES.error.pleaseSelectSpace);
        return;
    }

    // Show modal and set space info
    document.getElementById('create-post-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Set space breadcrumb in modal
    const spaceBreadcrumb = getSpaceFullBreadcrumb(currentSpace);
    document.getElementById('modal-space-name').textContent = spaceBreadcrumb;

    // Focus on content area
    document.getElementById('modal-post-content').focus();

    // Check settings for features
    try {
        const settings = window.currentSettings;
        const retroactiveSection = document.getElementById('modal-retroactive-section');
        const attachmentsSection = document.getElementById('modal-attachments-section');

        // Handle retroactive posting
        if (settings && settings.retroactivePostingEnabled) {
            retroactiveSection.style.setProperty('display', 'block', 'important');

            // Get time format preference
            const timeFormat = settings.retroactivePostingTimeFormat || '24h';

            // Set default value to current time
            const now = new Date();
            let formatted;

            if (timeFormat === '12h') {
                // Format: MM/DD/YYYY HH:MM AM/PM
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const year = now.getFullYear();
                let hours = now.getHours();
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const ampm = hours >= 12 ? window.AppConstants.TIME_FORMAT.pm : window.AppConstants.TIME_FORMAT.am;
                hours = hours % 12 || 12; // Convert to 12-hour format

                formatted = `${month}/${day}/${year} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
            } else {
                // Format: DD/MM/YYYY HH:MM (24h)
                const day = String(now.getDate()).padStart(2, '0');
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const year = now.getFullYear();
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');

                formatted = `${day}/${month}/${year} ${hours}:${minutes}`;
            }

            const dateTimeInput = document.getElementById('modal-post-datetime');
            dateTimeInput.value = formatted;
            // Store the original default value to detect if user changed it
            dateTimeInput.dataset.originalValue = formatted;
            // Store the time format for later use
            dateTimeInput.dataset.timeFormat = timeFormat;
        } else {
            retroactiveSection.style.setProperty('display', 'none', 'important');
        }

        // Handle file upload
        if (settings && settings.fileUploadEnabled !== false) {
            attachmentsSection.style.display = 'block';
        } else {
            attachmentsSection.style.display = 'none';
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
        // Hide optional sections on error
        document.getElementById('modal-retroactive-section').style.setProperty('display', 'none', 'important');
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

    // Reset character counter
    const counter = document.getElementById('modal-char-counter');
    if (counter && window.currentSettings) {
        counter.textContent = `0 / ${window.currentSettings.maxContentLength}`;
    }
}

function showSpaceModal() {
    document.getElementById('space-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Set current space as default parent (if any and not "All spaces")
    const parentSelect = document.getElementById('space-parent');
    if (currentSpace && currentSpace.id !== window.AppConstants.ALL_SPACES_ID) {
        parentSelect.value = currentSpace.id.toString();
    } else {
        parentSelect.value = ''; // None (Root Space)
    }

    // Set dynamic maxlength for space name
    document.getElementById('space-name').setAttribute('maxlength', window.AppConstants.VALIDATION_LIMITS.maxSpaceNameLength);

    document.getElementById('space-name').focus();
}

function hideSpaceModal() {
    document.getElementById('space-modal').classList.add('hidden');
    document.body.style.overflow = '';
    document.getElementById('space-form').reset();
    document.getElementById('space-description').value = '';
    updateDescriptionCounter('space-description', 'description-counter');
}

function handleSpaceModalClose() {
    if (hasSpaceContent()) {
        if (confirm(window.AppConstants.USER_MESSAGES.confirm.unsavedContent)) {
            hideSpaceModal();
        }
    } else {
        hideSpaceModal();
    }
}

function hasSpaceContent() {
    const name = document.getElementById('space-name').value.trim();
    const description = document.getElementById('space-description').value.trim();
    return name.length > 0 || description.length > 0;
}

function showEditSpaceModal() {
    if (!currentSpace || currentSpace.id === window.AppConstants.ALL_SPACES_ID) {
        showError(window.AppConstants.USER_MESSAGES.error.pleaseSelectSpace);
        return;
    }

    document.getElementById('edit-space-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Populate form fields with current space data
    document.getElementById('edit-space-name').value = currentSpace.name;
    document.getElementById('edit-space-description').value = currentSpace.description || '';
    updateDescriptionCounter('edit-space-description', 'edit-description-counter');

    // Hide parent selector if no valid parents exist
    const parentSelectDiv = document.querySelector('#edit-space-modal .mb-4:has(#edit-space-parent)');

    // Calculate depth span to determine if any parents are possible
    function getDepthSpanBelow(spaceId) {
        const children = spaces.filter(cat => cat.parent_id === spaceId);
        if (children.length === 0) return 0;

        let maxChildSpan = 0;
        for (let child of children) {
            const childSpan = 1 + getDepthSpanBelow(child.id);
            maxChildSpan = Math.max(maxChildSpan, childSpan);
        }
        return maxChildSpan;
    }

    const depthSpanBelow = getDepthSpanBelow(currentSpace.id);

    // Check if any valid parents exist (excluding descendants)
    const excludedIds = new Set([currentSpace.id]);
    function addDescendants(parentId) {
        const children = spaces.filter(cat => cat.parent_id === parentId);
        children.forEach(child => {
            excludedIds.add(child.id);
            addDescendants(child.id);
        });
    }
    addDescendants(currentSpace.id);

    const hasValidParents = spaces.some(cat => {
        if (excludedIds.has(cat.id)) return false;
        const newMaxDepth = cat.depth + 1 + depthSpanBelow;
        return newMaxDepth <= window.AppConstants.MAX_SPACE_DEPTH;
    });


    if (!hasValidParents) {
        if (parentSelectDiv) {
            parentSelectDiv.style.display = 'none';
        }
    } else {
        if (parentSelectDiv) {
            parentSelectDiv.style.display = 'block';
        }

        // Populate parent select and exclude the current space and its descendants
        populateEditSpaceSelect();

        // Set current parent if exists
        if (currentSpace.parent_id) {
            document.getElementById('edit-space-parent').value = currentSpace.parent_id.toString();
        } else {
            document.getElementById('edit-space-parent').value = '';
        }
    }

    // Set dynamic maxlength for space name
    document.getElementById('edit-space-name').setAttribute('maxlength', window.AppConstants.VALIDATION_LIMITS.maxSpaceNameLength);

    document.getElementById('edit-space-name').focus();
}

function hideEditSpaceModal() {
    document.getElementById('edit-space-modal').classList.add('hidden');
    document.body.style.overflow = '';
    document.getElementById('edit-space-form').reset();
    document.getElementById('edit-space-description').value = '';
    updateDescriptionCounter('edit-space-description', 'edit-description-counter');
}

function handleEditSpaceModalClose() {
    if (hasEditSpaceContentChanged()) {
        if (confirm(window.AppConstants.USER_MESSAGES.confirm.unsavedContent)) {
            hideEditSpaceModal();
        }
    } else {
        hideEditSpaceModal();
    }
}

function hasEditSpaceContentChanged() {
    if (!currentSpace) return false;

    const name = document.getElementById('edit-space-name').value.trim();
    const description = document.getElementById('edit-space-description').value.trim();
    const parentId = document.getElementById('edit-space-parent').value || null;

    const currentParentId = currentSpace.parent_id ? currentSpace.parent_id.toString() : null;
    const newParentId = parentId ? parentId.toString() : null;

    const nameChanged = name !== currentSpace.name;
    const descriptionChanged = description !== (currentSpace.description || '');
    const parentChanged = currentParentId !== newParentId;

    return nameChanged || descriptionChanged || parentChanged;
}

function populateSpaceSelect() {
    const select = document.getElementById('space-parent');
    select.innerHTML = '<option value="">None (Root Space)</option>';

    // Filter spaces that can accept children (depth < MAX_SPACE_DEPTH)
    const availableSpaces = spaces.filter(cat => cat.depth < window.AppConstants.MAX_SPACE_DEPTH);

    availableSpaces.forEach(space => {
        const option = document.createElement('option');
        option.value = space.id;

        // Build breadcrumb path with emphasis on last item
        const breadcrumbPath = getSpaceBreadcrumbPath(space.id, true);
        option.textContent = breadcrumbPath;

        select.appendChild(option);
    });
}

function populateEditSpaceSelect() {
    const select = document.getElementById('edit-space-parent');
    select.innerHTML = '<option value="">None (Root Space)</option>';

    // Get all descendant IDs of the current space to exclude them
    const excludedIds = new Set([currentSpace.id]);

    function addDescendants(parentId) {
        const children = spaces.filter(cat => cat.parent_id === parentId);
        children.forEach(child => {
            excludedIds.add(child.id);
            addDescendants(child.id);
        });
    }

    addDescendants(currentSpace.id);

    // Filter available spaces (exclude self and descendants, and prevent depth violations)
    // If a space is selected as parent, the current space would have depth = parent.depth + 1

    // Calculate the depth span of the current space tree (from current space to deepest descendant)
    function getDepthSpanBelow(spaceId) {
        const children = spaces.filter(cat => cat.parent_id === spaceId);
        if (children.length === 0) return 0; // No children, span is 0

        let maxChildSpan = 0;
        for (let child of children) {
            const childSpan = 1 + getDepthSpanBelow(child.id);
            maxChildSpan = Math.max(maxChildSpan, childSpan);
        }
        return maxChildSpan;
    }

    const depthSpanBelow = getDepthSpanBelow(currentSpace.id);

    const availableSpaces = spaces.filter(cat => {
        if (excludedIds.has(cat.id)) return false;

        // Include current parent so user can keep it selected (no change)

        // If we move currentSpace under cat, currentSpace will have depth = cat.depth + 1
        // The deepest descendant will have depth = cat.depth + 1 + depthSpanBelow
        const newMaxDepth = cat.depth + 1 + depthSpanBelow;
        return newMaxDepth <= window.AppConstants.MAX_SPACE_DEPTH;
    });

    availableSpaces.forEach(space => {
        const option = document.createElement('option');
        option.value = space.id;

        // Build breadcrumb path with emphasis on last item
        const breadcrumbPath = getSpaceBreadcrumbPath(space.id, true);
        option.textContent = breadcrumbPath;

        select.appendChild(option);
    });
}

function getSpaceBreadcrumbPath(spaceId, emphasizeLast = false) {
    const space = spaces.find(cat => cat.id === spaceId);
    if (!space) return '';

    const path = [];
    let current = space;

    while (current) {
        path.unshift(current.name);
        if (current.parent_id) {
            current = spaces.find(cat => cat.id === current.parent_id);
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

function getSpaceFullBreadcrumb(space) {
    if (!space || space.id === window.AppConstants.ALL_SPACES_ID) {
        return window.AppConstants.UI_TEXT.allSpaces;
    }

    const path = [];
    let current = space;

    while (current) {
        path.unshift(current.name);
        if (current.parent_id) {
            current = spaces.find(cat => cat.id === current.parent_id);
        } else {
            current = null;
        }
    }

    return path.join(' > ');
}

