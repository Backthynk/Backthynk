
// Modal character counter functionality
async function initializeModalCharacterCounter() {
    const textarea = document.getElementById('modal-post-content');
    const counter = document.getElementById('modal-char-counter');

    if (!textarea || !counter) return;

    function updateCounter() {
        const currentSettings = window.currentSettings;
        if (!currentSettings) return;

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

        // Update submit button state
        const submitBtn = document.getElementById('modal-submit-post');
        if (currentLength === 0 || currentLength > currentSettings.maxContentLength) {
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    // Initialize counter
    updateCounter();

    // Update counter on input
    textarea.addEventListener('input', updateCounter);
}

// Auto-resize textarea functionality
function initializeAutoResizeTextarea() {
    const textarea = document.getElementById('modal-post-content');
    if (!textarea) return;

    const minHeight = 100; // Initial height
    const maxHeight = 200; // Max height (2x initial)

    function adjustHeight() {
        // Reset height to auto to get the correct scrollHeight
        textarea.style.height = 'auto';

        // Calculate new height
        const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);

        // Set the new height
        textarea.style.height = newHeight + 'px';
    }

    // Adjust on input
    textarea.addEventListener('input', adjustHeight);

    // Initial adjustment
    adjustHeight();
}

// Handle modal close with content warning
function handleModalClose() {
    if (hasModalContent()) {
        if (confirm('You have unsaved content. Are you sure you want to close?')) {
            hideCreatePost();
        }
    } else {
        hideCreatePost();
    }
}

// Check if modal has content
function hasModalContent() {
    const content = document.getElementById('modal-post-content').value.trim();
    const hasFiles = modalSelectedFiles.size > 0 || (window.modalPastedFiles && window.modalPastedFiles.length > 0);
    const hasLinks = modalCurrentLinkPreviews.length > 0;

    return content.length > 0 || hasFiles || hasLinks;
}


// File upload text updater
async function updateFileUploadText() {
    const modalFileUploadText = document.getElementById('modal-file-upload-text');
    if (!modalFileUploadText) return;

    const settings = window.currentSettings;
    if (!settings) return;

    modalFileUploadText.textContent = `Or drag and drop files here (max ${settings.maxFilesPerPost} files)`;
}

// Centralized app initialization
async function initializeApp() {

    // Load and cache settings first - single API call
    window.currentSettings = await initializeAppSettings();

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

    // Check activity system status (now uses cached settings)
    checkActivityEnabled();

    // Check file statistics system status (now uses cached settings)
    checkFileStatsEnabled();

    if (window.location.pathname === "/" || router.isCategoryPath(window.location.pathname)){
        // Load initial data
        fetchCategories();
    }

    initializeStickyHeader();

    // Initialize components that need settings
    initializeModalCharacterCounter();
    initializeAutoResizeTextarea();
    updateFileUploadText();
    initializeSortFooter();
}

// Main initialization and event listeners
document.addEventListener('DOMContentLoaded', function() {

    // Initialize app asynchronously
    initializeApp();
    
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
                // Immediately clear posts to prevent showing previous category's posts
                const postsContainer = document.getElementById('posts-container');
                if (postsContainer) {
                    postsContainer.innerHTML = `
                        <div class="text-center text-gray-500 py-8">
                            <i class="fas fa-spinner fa-spin text-4xl mb-4"></i>
                            <p>Loading posts...</p>
                        </div>
                    `;
                }

                populateCategorySelect(); // Update dropdowns
                selectCategory(newCategory); // Programmatic selection after category creation
                showSuccess('');
            }
        } catch (error) {
            showError(error.message);
        }
    };

    // Post creation events
    document.getElementById('new-post-btn').onclick = showCreatePost;

    // Modal post creation events
    document.getElementById('close-post-modal').onclick = handleModalClose;
    document.getElementById('modal-cancel-post').onclick = handleModalClose;

    // Link preview navigation
    document.getElementById('modal-link-prev').onclick = () => navigateModalLinkPreview('prev');
    document.getElementById('modal-link-next').onclick = () => navigateModalLinkPreview('next');

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

    // Category actions dropdown functionality
    const categoryActionsBtn = document.getElementById('category-actions-btn');
    const categoryActionsMenu = document.getElementById('category-actions-menu');

    categoryActionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        categoryActionsMenu.classList.toggle('hidden');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!categoryActionsBtn.contains(e.target) && !categoryActionsMenu.contains(e.target)) {
            categoryActionsMenu.classList.add('hidden');
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
                showSuccess(``);
            }
        } catch (error) {
            showError(error.message);
        }
    };



    // Modal form submission handler
    document.getElementById('modal-create-post-form').onsubmit = async function(e) {
        e.preventDefault();

        if (!currentCategory) {
            showError(window.AppConstants.USER_MESSAGES.error.noCategorySelected);
            return;
        }

        const content = document.getElementById('modal-post-content').value;

        if (!content.trim()) {
            showError(window.AppConstants.USER_MESSAGES.error.contentRequired);
            return;
        }

        // Check content length against settings
        const settings = window.currentSettings;
        if (settings && content.length > settings.maxContentLength) {
            showError(`Content exceeds maximum length of ${settings.maxContentLength} characters`);
            return;
        }

        try {
            // Include link previews in the post creation
            const postData = {
                category_id: currentCategory.id,
                content: content,
                link_previews: getCurrentModalLinkPreviews ? getCurrentModalLinkPreviews() : []
            };

            // Check if retroactive posting is enabled and add custom timestamp
            const dateTimeInput = document.getElementById('modal-post-datetime');
            if (dateTimeInput && dateTimeInput.value) {
                // Only send custom timestamp if user actually changed the date from default
                const userChangedDate = dateTimeInput.dataset.originalValue !== dateTimeInput.value;

                if (userChangedDate) {
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
            }

            const post = await apiRequest('/posts', {
                method: 'POST',
                body: JSON.stringify(postData)
            });

            // Upload selected files (using modal file handling)
            if (modalSelectedFiles && modalSelectedFiles.size > 0) {
                for (let [fileId, file] of modalSelectedFiles) {
                    await uploadFile(post.id, file);
                }
            }

            // Upload pasted files
            if (window.modalPastedFiles && window.modalPastedFiles.length > 0) {
                for (let file of window.modalPastedFiles) {
                    await uploadFile(post.id, file);
                }
                window.modalPastedFiles = [];
            }

            hideCreatePost();

            // Get the full post data with attachments and link previews
            const fullPost = await apiRequest(`/posts/${post.id}`);

            // Add the new post to the beginning of current posts
            currentPosts.unshift(fullPost);

            // Re-render posts with the new post included
            renderPosts(currentPosts, true);

            // Increment post count locally for immediate feedback
            incrementCategoryPostCount(currentCategory.id, 1);

            // Update the display with the updated counts
            await updateCategoryStatsDisplay();

            // Show success message
            showSuccess('');

            // Regenerate activity heatmap to reflect new post (with small delay for backend processing)
            setTimeout(generateActivityHeatmap, 100);
        } catch (error) {
            showError(error.message);
        }
    };


    // Modal paste event for images
    document.getElementById('modal-post-content').addEventListener('paste', function(e) {
        const items = e.clipboardData.items;

        for (let item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();

                const file = item.getAsFile();
                if (file) {
                    if (!window.modalPastedFiles) {
                        window.modalPastedFiles = [];
                    }

                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const extension = file.type.split('/')[1] || 'png';
                    const newFile = new File([file], `pasted-image-${timestamp}.${extension}`, { type: file.type });

                    window.modalPastedFiles.push(newFile);

                    // Don't add text to the content area - just add to file preview
                    updateModalPastedFilesDisplay();
                }
            }
        }
    });

    // Modal file input handling
    const modalFileInput = document.getElementById('modal-post-files');
    modalFileInput.addEventListener('change', async function(e) {
        for (let file of e.target.files) {
            await addModalFileToSelection(file);
        }
        // Reset input to allow selecting same file again
        e.target.value = '';
    });

    // Modal drag and drop
    const modalDropZone = modalFileInput.parentElement;
    modalDropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        modalDropZone.classList.add('bg-blue-50', 'border-blue-300');
    });

    modalDropZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        modalDropZone.classList.remove('bg-blue-50', 'border-blue-300');
    });

    modalDropZone.addEventListener('drop', async function(e) {
        e.preventDefault();
        modalDropZone.classList.remove('bg-blue-50', 'border-blue-300');

        for (let file of e.dataTransfer.files) {
            await addModalFileToSelection(file);
        }
    });


    // Modal retroactive posting functionality
    const modalSetCurrentTimeBtn = document.getElementById('modal-set-current-time');
    if (modalSetCurrentTimeBtn) {
        modalSetCurrentTimeBtn.addEventListener('click', function() {
            const now = new Date();
            // Format to datetime-local format (YYYY-MM-DDTHH:mm)
            const formatted = now.getFullYear() + '-' +
                              String(now.getMonth() + 1).padStart(2, '0') + '-' +
                              String(now.getDate()).padStart(2, '0') + 'T' +
                              String(now.getHours()).padStart(2, '0') + ':' +
                              String(now.getMinutes()).padStart(2, '0');
            document.getElementById('modal-post-datetime').value = formatted;
        });
    }

    // Image viewer events
    document.getElementById('viewer-close').onclick = closeImageViewer;
    document.getElementById('viewer-prev').onclick = () => navigateImage('prev');
    document.getElementById('viewer-next').onclick = () => navigateImage('next');

    // Keyboard navigation for image viewer and modals
    document.addEventListener('keydown', function(e) {
        const imageModal = document.getElementById('image-viewer-modal');
        const createPostModal = document.getElementById('create-post-modal');

        if (!imageModal.classList.contains('hidden')) {
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
        } else if (!createPostModal.classList.contains('hidden')) {
            switch(e.key) {
                case 'Escape':
                    handleModalClose();
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

    // Close create post modal when clicking outside
    document.getElementById('create-post-modal').onclick = function(e) {
        if (e.target === this) {
            handleModalClose();
        }
    };

});

// Add this to handle window resize events for activity heatmap
window.addEventListener('resize', function() {
    if (currentCategory && document.getElementById('activity-container').style.display !== 'none') {
        // Debounce resize events with longer delay to prevent excessive API calls
        clearTimeout(window.resizeTimeout);
        window.resizeTimeout = setTimeout(function() {
            // Only regenerate if we have cached data to avoid unnecessary API calls
            if (currentActivityCache) {
                generateHeatmapFromCache(currentActivityCache);
            }
        }, 500);
    }
});