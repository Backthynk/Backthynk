
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
        if (confirm(window.AppConstants.USER_MESSAGES.confirm.unsavedContent)) {
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

// Calculate and set dynamic category container height
function updateCategoryContainerHeight() {
    const categoriesContainer = document.getElementById('categories-container');
    const footerContainer = document.getElementById("footer-links");
    const activityContainer = document.getElementById('activity-container');

    if (!categoriesContainer) return;

    // Get viewport height
    const viewportHeight = window.innerHeight;

    // Always assume header is scrolled (worst case = 96px) for consistent sizing
    const headerHeight = 96;

    // Activity container: if visible, assume fixed height of 330px
    let activityHeight = 0;
    if (activityContainer && activityContainer.style.display !== 'none') {
        activityHeight = 330;
    }

    // Get actual footer container height
    let footerHeight = 0;
    if (footerContainer) {
        footerHeight = footerContainer.offsetHeight;
    }

    // Calculate spacing:
    // - top: 1rem (16px) from sticky top-4
    // - between containers: 1rem (16px) from space-y-4 (appears once per container)
    const topSpacing = 16;
    const containerSpacing = (activityHeight > 0 ? 16 : 0) + (footerHeight > 0 ? 16 : 0);

    // Calculate maximum available height for the entire category container
    const maxHeight = viewportHeight
        - headerHeight
        - topSpacing * 2
        - activityHeight
        - footerHeight
        - containerSpacing

    // Set max-height with a minimum of 200px to ensure usability
    const finalHeight = Math.min(Math.max(maxHeight, 200), 800);
    categoriesContainer.style.maxHeight = `${finalHeight}px`;
}

// Centralized app initialization
async function initializeApp() {

    // Load settings and categories in parallel for faster startup
    const settingsPromise = initializeAppSettings();
    const categoriesPromise = (window.location.pathname === "/" || router.isCategoryPath(window.location.pathname))
        ? fetchCategories()
        : Promise.resolve();

    // Wait for settings to complete
    window.currentSettings = await settingsPromise;

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

    // Update markdown CSS based on settings
    //06/10/2025
    /*
    if (window.currentSettings && typeof updateMarkdownCSS === 'function') {
        updateMarkdownCSS(window.currentSettings.markdownEnabled !== undefined ? window.currentSettings.markdownEnabled : false);
    }
    */

    // Wait for categories to complete (if it was started)
    await categoriesPromise;

    initializeStickyHeader();

    // Initialize components that need settings
    initializeModalCharacterCounter();
    initializeAutoResizeTextarea();
    updateFileUploadText();
    initializeSortFooter();

    // Calculate initial category container height
    updateCategoryContainerHeight();
}

// Main initialization and event listeners
document.addEventListener('DOMContentLoaded', function() {

    // Set copyright year dynamically
    const copyrightYearElement = document.getElementById('copyright-year');
    if (copyrightYearElement) {
        copyrightYearElement.textContent = new Date().getFullYear();
    }

    // Initialize app asynchronously
    initializeApp();
    
    // Category modal events
    document.getElementById('add-category-btn').onclick = showCategoryModal;
    document.getElementById('cancel-category').onclick = handleCategoryModalClose;

    // Add real-time validation for category name
    document.getElementById('category-name').addEventListener('input', function(e) {
        const name = e.target.value.trim();
        const submitBtn = document.querySelector('button[form="category-form"]');

        if (!submitBtn) return;

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
                        <div class="text-center text-gray-500 dark:text-gray-400 py-8">
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
    document.getElementById('cancel-edit-category').onclick = handleEditCategoryModalClose;

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
        const submitBtn = document.querySelector('button[form="edit-category-form"]');

        if (!submitBtn) return;

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
            showError(window.AppConstants.USER_MESSAGES.error.contentTooLong.replace('{0}', settings.maxContentLength));
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
                    const timeFormat = dateTimeInput.dataset.timeFormat || '24h';
                    let customDate;

                    if (timeFormat === '12h') {
                        // Parse MM/DD/YYYY HH:MM AM/PM format
                        customDate = parseDateTime12h(dateTimeInput.value);
                    } else {
                        // Parse DD/MM/YYYY HH:MM format
                        customDate = parseDateTime24h(dateTimeInput.value);
                    }

                    if (!customDate || isNaN(customDate.getTime())) {
                        showError('Invalid date format');
                        return;
                    }

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

            // Insert the new post in the correct chronological position
            // Posts are sorted by created timestamp descending (newest first)
            let insertIndex = 0;
            for (let i = 0; i < currentPosts.length; i++) {
                if (fullPost.created >= currentPosts[i].created) {
                    insertIndex = i;
                    break;
                }
                insertIndex = i + 1;
            }

            // Determine if we should insert the post in the UI
            // Only insert if the post belongs chronologically within the currently loaded posts
            // OR if we have space to show more posts (haven't reached the limit)
            const shouldInsertPost = insertIndex < currentPosts.length ||
                                    (insertIndex === currentPosts.length && !hasMorePosts);

            if (shouldInsertPost) {
                currentPosts.splice(insertIndex, 0, fullPost);
            }

            // Re-render posts with the new post included
            renderPosts(currentPosts, true);

            // Increment post count locally for immediate feedback
            incrementCategoryPostCount(currentCategory.id, 1);

            // Update the display with the updated counts
            updateCategoryStatsDisplay();

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
            const dateTimeInput = document.getElementById('modal-post-datetime');
            const timeFormat = dateTimeInput.dataset.timeFormat || '24h';
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

            dateTimeInput.value = formatted;
            dateTimeInput.dataset.originalValue = formatted;
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
        const categoryModal = document.getElementById('category-modal');
        const editCategoryModal = document.getElementById('edit-category-modal');
        const moveModal = document.getElementById('move-modal');
        const confirmationModal = document.getElementById('confirmation-modal');

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
        } else if (!categoryModal.classList.contains('hidden')) {
            switch(e.key) {
                case 'Escape':
                    handleCategoryModalClose();
                    break;
            }
        } else if (!editCategoryModal.classList.contains('hidden')) {
            switch(e.key) {
                case 'Escape':
                    handleEditCategoryModalClose();
                    break;
            }
        } else if (!moveModal.classList.contains('hidden')) {
            switch(e.key) {
                case 'Escape':
                    hideMoveModal();
                    break;
            }
        } else if (!confirmationModal.classList.contains('hidden')) {
            switch(e.key) {
                case 'Escape':
                    // For confirmation modal, escape should trigger cancel
                    document.getElementById('confirmation-cancel').click();
                    break;
            }
        }
    });

    // Close modal when clicking outside
    document.getElementById('category-modal').onclick = function(e) {
        if (e.target === this) {
            handleCategoryModalClose();
        }
    };

    document.getElementById('edit-category-modal').onclick = function(e) {
        if (e.target === this) {
            handleEditCategoryModalClose();
        }
    };

    document.getElementById('image-viewer-modal').onclick = function(e) {
        // Close if clicking the modal backdrop or the image container div, but not the image itself or buttons
        const isBackdrop = e.target === this || e.target.classList.contains('absolute');
        const isImage = e.target.id === 'viewer-image';
        const isButton = e.target.closest('button');

        if (isBackdrop && !isImage && !isButton) {
            closeImageViewer();
        }
    };

    // Close create post modal when clicking outside
    document.getElementById('create-post-modal').onclick = function(e) {
        if (e.target === this) {
            handleModalClose();
        }
    };

    document.getElementById('move-modal').onclick = function(e) {
        if (e.target === this) {
            hideMoveModal();
        }
    };

    document.getElementById('confirmation-modal').onclick = function(e) {
        if (e.target === this) {
            // For confirmation modal, clicking outside should trigger cancel
            document.getElementById('confirmation-cancel').click();
        }
    };

});

// Mobile keyboard optimization for modals
if (typeof window !== 'undefined' && window.visualViewport) {
    // Modern browsers with Visual Viewport API
    function handleViewportChange() {
        const viewport = window.visualViewport;
        const modals = document.querySelectorAll('.modal-mobile-full');

        modals.forEach(modal => {
            if (!modal.closest('.hidden')) {
                // Modal is visible, adjust for keyboard
                const keyboardHeight = window.innerHeight - viewport.height;
                if (keyboardHeight > 0) {
                    // Keyboard is open
                    modal.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
                    modal.classList.add('keyboard-open');
                } else {
                    // Keyboard is closed
                    modal.style.removeProperty('--keyboard-height');
                    modal.classList.remove('keyboard-open');
                }
            }
        });
    }

    window.visualViewport.addEventListener('resize', handleViewportChange);
}

// Fallback for older browsers - detect keyboard by viewport height change
let initialViewportHeight = window.innerHeight;
function handleLegacyKeyboard() {
    const currentHeight = window.innerHeight;
    const heightDiff = initialViewportHeight - currentHeight;
    const modals = document.querySelectorAll('.modal-mobile-full');

    modals.forEach(modal => {
        if (!modal.closest('.hidden')) {
            if (heightDiff > 150) { // Keyboard likely open
                modal.classList.add('keyboard-open');
                // Scroll focused input into view
                const focused = modal.querySelector('input:focus, textarea:focus');
                if (focused) {
                    setTimeout(() => {
                        focused.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 300);
                }
            } else {
                modal.classList.remove('keyboard-open');
            }
        }
    });
}

// Add focus handlers for better input experience on mobile
document.addEventListener('focusin', function(e) {
    if (e.target.matches('.modal-mobile-full input, .modal-mobile-full textarea')) {
        // Small delay to allow keyboard to appear
        setTimeout(() => {
            e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    }
});

// Add this to handle window resize events for activity heatmap and header responsiveness
window.addEventListener('resize', function() {
    // Debounce resize events with longer delay to prevent excessive API calls
    clearTimeout(window.resizeTimeout);
    window.resizeTimeout = setTimeout(function() {
        // Update activity heatmap if needed
        if (currentCategory && document.getElementById('activity-container').style.display !== 'none') {
            // Only regenerate if we have cached data to avoid unnecessary API calls
            if (currentActivityCache) {
                generateHeatmapFromCache(currentActivityCache);
            }
        }

        // Update header breadcrumb for mobile/desktop responsiveness
        if (currentCategory && currentCategory.id !== window.AppConstants.ALL_CATEGORIES_ID) {
            // Re-render the header with responsive breadcrumb
            updateCategoryStatsDisplay();
        }

        // Recalculate category container height on resize
        updateCategoryContainerHeight();

        // Handle legacy keyboard detection for older browsers
        if (!window.visualViewport) {
            handleLegacyKeyboard();
        }
    }, 300);
});