// Character counter functionality
async function initializeCharacterCounter() {
    const textarea = document.getElementById('post-content');
    const counter = document.getElementById('char-counter');

    if (!textarea || !counter) return;

    const settings = await loadAppSettings(); // Use cached settings on initialization

    function updateCounter() {
        const currentSettings = window.currentSettings || settings;
        const currentLength = textarea.value.length;
        counter.textContent = `${currentLength} / ${currentSettings.maxContentLength}`;

        // Change color based on usage
        if (currentLength > currentSettings.maxContentLength * 0.9) {
            counter.classList.remove('text-gray-500', 'text-yellow-600');
            counter.classList.add('text-red-600');
        } else if (currentLength > currentSettings.maxContentLength * 0.7) {
            counter.classList.remove('text-gray-500', 'text-red-600');
            counter.classList.add('text-yellow-600');
        } else {
            counter.classList.remove('text-yellow-600', 'text-red-600');
            counter.classList.add('text-gray-500');
        }
    }

    // Initialize counter
    updateCounter();

    // Update counter on input
    textarea.addEventListener('input', updateCounter);

    // Store settings for later use
    window.currentSettings = settings;
}

// Refresh character counter with new settings
async function refreshCharacterCounter() {
    const textarea = document.getElementById('post-content');
    const counter = document.getElementById('char-counter');

    if (!textarea || !counter) return;

    const settings = await loadAppSettings(true);
    window.currentSettings = settings;

    const currentLength = textarea.value.length;
    counter.textContent = `${currentLength} / ${settings.maxContentLength}`;

    // Update color
    if (currentLength > settings.maxContentLength * 0.9) {
        counter.classList.remove('text-gray-500', 'text-yellow-600');
        counter.classList.add('text-red-600');
    } else if (currentLength > settings.maxContentLength * 0.7) {
        counter.classList.remove('text-gray-500', 'text-red-600');
        counter.classList.add('text-yellow-600');
    } else {
        counter.classList.remove('text-yellow-600', 'text-red-600');
        counter.classList.add('text-gray-500');
    }
}

// File upload text updater
async function updateFileUploadText() {
    const fileUploadText = document.getElementById('file-upload-text');
    if (!fileUploadText) return;

    const settings = window.currentSettings || await loadAppSettings();
    fileUploadText.textContent = `Or drag and drop files here (max ${settings.maxFilesPerPost} files)`;
}

// Main initialization and event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Set description max length attributes and counters from constants
    const maxDescLength = window.AppConstants.VALIDATION_LIMITS.maxCategoryDescriptionLength;

    // Update textarea maxlength attributes
    document.getElementById('category-description').setAttribute('maxlength', maxDescLength);
    document.getElementById('edit-category-description').setAttribute('maxlength', maxDescLength);

    // Update counter display
    document.getElementById('description-max-length').textContent = maxDescLength;
    document.getElementById('edit-description-max-length').textContent = maxDescLength;
    // Load saved state
    loadExpandedCategories();

    // Check activity system status
    checkActivityEnabled();

    // Check file statistics system status
    checkFileStatsEnabled();

    // Load initial data
    fetchCategories();

    initializeStickyHeader();
    
    // Category modal events
    document.getElementById('add-category-btn').onclick = showCategoryModal;
    document.getElementById('cancel-category').onclick = hideCategoryModal;

    // Add real-time validation for category name
    document.getElementById('category-name').addEventListener('input', function(e) {
        const name = e.target.value.trim();
        const submitBtn = document.querySelector('#category-form button[type="submit"]');

        // Check if name is valid (letters, numbers, and single spaces only)
        const validNameRegex = /^[a-zA-Z0-9]+(?:\s[a-zA-Z0-9]+)*$/;
        const isValid = name.length > 0 && validNameRegex.test(name);

        if (!isValid) {
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    });

    document.getElementById('category-form').onsubmit = async function(e) {
        e.preventDefault();

        const name = document.getElementById('category-name').value.trim();

        if (name.length === 0) {
            showError(window.AppConstants.USER_MESSAGES.error.categoryNameEmpty);
            return;
        }

        if (name.length > window.AppConstants.VALIDATION_LIMITS.maxCategoryNameLength) {
            showError(formatMessage(window.AppConstants.USER_MESSAGES.error.categoryNameTooLong, window.AppConstants.VALIDATION_LIMITS.maxCategoryNameLength));
            return;
        }

        // Validate character restrictions
        const validNameRegex = /^[a-zA-Z0-9]+(?:\s[a-zA-Z0-9]+)*$/;
        if (!validNameRegex.test(name)) {
            showError(window.AppConstants.USER_MESSAGES.error.categoryNameInvalidChars);
            return;
        }

        const parentId = document.getElementById('category-parent').value || null;
        const description = document.getElementById('category-description').value.trim();

        try {
            const newCategory = await createCategory(name, parentId, description);
            hideCategoryModal();

            // Auto-select the newly created category
            if (newCategory) {
                populateCategorySelect(); // Update dropdowns
                selectCategory(newCategory); // Programmatic selection after category creation
                showSuccess(`Category "${newCategory.name}" ${window.AppConstants.USER_MESSAGES.success.categoryCreated}`);
            }
        } catch (error) {
            showError(error.message);
        }
    };

    // Post creation events
    document.getElementById('new-post-btn').onclick = showCreatePost;
    document.getElementById('cancel-post').onclick = hideCreatePost;

    // Header button events
    document.getElementById('recursive-toggle-btn').addEventListener('click', () => {
        if (currentCategory) {
            toggleRecursiveMode(currentCategory);
        }
    });

    document.getElementById('delete-category-btn').addEventListener('click', () => {
        if (currentCategory) {
            deleteCategory(currentCategory);
        }
    });

    document.getElementById('edit-category-btn').addEventListener('click', () => {
        if (currentCategory) {
            showEditCategoryModal();
        }
    });

    // Edit category modal events
    document.getElementById('cancel-edit-category').onclick = hideEditCategoryModal;

    // Add description character counters
    document.getElementById('category-description').addEventListener('input', function() {
        updateDescriptionCounter('category-description', 'description-counter');
    });

    document.getElementById('edit-category-description').addEventListener('input', function() {
        updateDescriptionCounter('edit-category-description', 'edit-description-counter');
    });

    // Edit category form validation and submission
    document.getElementById('edit-category-name').addEventListener('input', function(e) {
        const name = e.target.value.trim();
        const submitBtn = document.querySelector('#edit-category-form button[type="submit"]');

        // Check if name is valid (letters, numbers, and single spaces only)
        const validNameRegex = /^[a-zA-Z0-9]+(?:\s[a-zA-Z0-9]+)*$/;
        if (name.length === 0 || name.length > window.AppConstants.VALIDATION_LIMITS.maxCategoryNameLength || !validNameRegex.test(name)) {
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    });

    document.getElementById('edit-category-form').onsubmit = async function(e) {
        e.preventDefault();

        const name = document.getElementById('edit-category-name').value.trim();

        if (name.length === 0) {
            showError(window.AppConstants.USER_MESSAGES.error.categoryNameEmpty);
            return;
        }

        if (name.length > window.AppConstants.VALIDATION_LIMITS.maxCategoryNameLength) {
            showError(formatMessage(window.AppConstants.USER_MESSAGES.error.categoryNameTooLong, window.AppConstants.VALIDATION_LIMITS.maxCategoryNameLength));
            return;
        }

        // Validate character restrictions
        const validNameRegex = /^[a-zA-Z0-9]+(?:\s[a-zA-Z0-9]+)*$/;
        if (!validNameRegex.test(name)) {
            showError(window.AppConstants.USER_MESSAGES.error.categoryNameInvalidChars);
            return;
        }

        const parentId = document.getElementById('edit-category-parent').value || null;
        const description = document.getElementById('edit-category-description').value.trim();

        if (description.length > window.AppConstants.VALIDATION_LIMITS.maxCategoryDescriptionLength) {
            showError(formatMessage(window.AppConstants.USER_MESSAGES.error.categoryDescTooLong, window.AppConstants.VALIDATION_LIMITS.maxCategoryDescriptionLength));
            return;
        }

        // Check if anything has actually changed
        const currentParentId = currentCategory.parent_id ? currentCategory.parent_id.toString() : null;
        const newParentId = parentId ? parentId.toString() : null;

        const nameChanged = name !== currentCategory.name;
        const descriptionChanged = description !== (currentCategory.description || '');
        const parentChanged = currentParentId !== newParentId;

        if (!nameChanged && !descriptionChanged && !parentChanged) {
            // Nothing changed, just close modal
            hideEditCategoryModal();
            return;
        }

        try {
            const updatedCategory = await updateCategory(currentCategory.id, name, description, parentId);
            hideEditCategoryModal();

            // Update current category and refresh display
            if (updatedCategory) {
                populateCategorySelect(); // Update dropdowns
                selectCategory(updatedCategory); // Programmatic selection after category update
                showSuccess(`Category "${updatedCategory.name}" ${window.AppConstants.USER_MESSAGES.success.categoryUpdated}`);
            }
        } catch (error) {
            showError(error.message);
        }
    };

    // File input handling
    const fileInput = document.getElementById('post-files');
    fileInput.addEventListener('change', async function(e) {
        for (let file of e.target.files) {
            await addFileToSelection(file);
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

    dropZone.addEventListener('drop', async function(e) {
        e.preventDefault();
        dropZone.classList.remove('bg-blue-50', 'border-blue-300');

        for (let file of e.dataTransfer.files) {
            await addFileToSelection(file);
        }
    });

    document.getElementById('create-post-form').onsubmit = async function(e) {
        e.preventDefault();

        if (!currentCategory) {
            showError(window.AppConstants.USER_MESSAGES.error.noCategorySelected);
            return;
        }

        const content = document.getElementById('post-content').value;

        if (!content.trim()) {
            showError(window.AppConstants.USER_MESSAGES.error.contentRequired);
            return;
        }

        // Check content length against settings (use current settings if available)
        const settings = window.currentSettings || await loadAppSettings();
        if (content.length > settings.maxContentLength) {
            showError(`Content exceeds maximum length of ${settings.maxContentLength} characters`);
            return;
        }

        try {
            // Include link previews in the post creation
            const postData = {
                category_id: currentCategory.id,
                content: content,
                link_previews: getCurrentLinkPreviews()
            };

            // Check if retroactive posting is enabled and add custom timestamp
            const dateTimeInput = document.getElementById('post-datetime');
            if (dateTimeInput && dateTimeInput.value) {
                const customDate = new Date(dateTimeInput.value);
                const minDate = new Date(window.AppConstants.MIN_RETROACTIVE_POST_TIMESTAMP);
                const now = new Date();

                // Validate the date
                if (customDate < minDate) {
                    showError(`Date cannot be earlier than ${minDate.toLocaleDateString()}`);
                    return;
                }

                if (customDate > now) {
                    showError('Date cannot be in the future');
                    return;
                }

                postData.custom_timestamp = customDate.getTime();
            }

            const post = await apiRequest('/posts', {
                method: 'POST',
                body: JSON.stringify(postData)
            });

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
            loadPosts(currentCategory.id, currentCategory.recursiveMode);

            // Refresh category stats using the proper function
            const stats = await fetchCategoryStats(currentCategory.id, currentCategory.recursiveMode);
            updateCategoryStatsDisplay(stats);

            // Show success message
            showSuccess('');

            // Regenerate activity heatmap to reflect new post
            generateActivityHeatmap();
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

    // Retroactive posting functionality
    const setCurrentTimeBtn = document.getElementById('set-current-time');
    if (setCurrentTimeBtn) {
        setCurrentTimeBtn.addEventListener('click', function() {
            const now = new Date();
            // Format to datetime-local format (YYYY-MM-DDTHH:mm)
            const formatted = now.getFullYear() + '-' +
                              String(now.getMonth() + 1).padStart(2, '0') + '-' +
                              String(now.getDate()).padStart(2, '0') + 'T' +
                              String(now.getHours()).padStart(2, '0') + ':' +
                              String(now.getMinutes()).padStart(2, '0');
            document.getElementById('post-datetime').value = formatted;
        });
    }

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

    // Initialize character counter
    initializeCharacterCounter();

    // Initialize file upload text
    updateFileUploadText();

    // Initialize link preview system when creating post
    const showCreatePostOriginal = window.showCreatePost;
    window.showCreatePost = function() {
        showCreatePostOriginal();
        // Initialize link preview after showing the form
        setTimeout(() => {
            initializeLinkPreview();
        }, 100);
    };

    const hideCreatePostOriginal = window.hideCreatePost;
    window.hideCreatePost = function() {
        hideCreatePostOriginal();
        // Reset link previews when hiding form
        resetLinkPreviews();
    };
});

// Add this to handle window resize events for activity heatmap
window.addEventListener('resize', function() {
    if (currentCategory && document.getElementById('activity-container').style.display !== 'none') {
        // Debounce resize events
        clearTimeout(window.resizeTimeout);
        window.resizeTimeout = setTimeout(function() {
            generateActivityHeatmap();
        }, 250);
    }
});