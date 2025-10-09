
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

// Calculate and set dynamic space container height
function updateSpaceContainerHeight() {
    const spacesContainer = document.getElementById('spaces-container');
    const footerContainer = document.getElementById("footer-links");
    const activityContainer = document.getElementById('activity-container');

    if (!spacesContainer) return;

    // Get viewport height
    const viewportHeight = window.innerHeight;

    // Always assume header is scrolled (worst case = 96px) for consistent sizing
    const headerHeight = 96;

    // Activity container: if visible, assume fixed height of 330px
    let activityHeight = 0;
    if (activityContainer && activityContainer.style.display !== 'none') {
        activityHeight = 400;
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

    // Calculate maximum available height for the entire space container
    const maxHeight = viewportHeight
        - headerHeight
        - topSpacing * 2
        - activityHeight
        - footerHeight
        - containerSpacing

    // Set max-height with a minimum of 200px to ensure usability
    const finalHeight = Math.min(Math.max(maxHeight, 200), 800);
    spacesContainer.style.maxHeight = `${finalHeight}px`;
}

// Centralized app initialization
async function initializeApp() {

    // Load settings and spaces in parallel for faster startup
    const settingsPromise = initializeAppSettings();
    const spacesPromise = (window.location.pathname === "/" || router.isSpacePath(window.location.pathname))
        ? fetchSpaces()
        : Promise.resolve();

    // Wait for settings to complete
    window.currentSettings = await settingsPromise;

    // Set description max length attributes and counters from constants
    const maxDescLength = window.AppConstants.VALIDATION_LIMITS.maxSpaceDescriptionLength;

    // Update textarea maxlength attributes
    document.getElementById('space-description').setAttribute('maxlength', maxDescLength);
    document.getElementById('edit-space-description').setAttribute('maxlength', maxDescLength);

    // Update counter display
    document.getElementById('description-max-length').textContent = maxDescLength;
    document.getElementById('edit-description-max-length').textContent = maxDescLength;

    // Load saved state
    loadExpandedSpaces();

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

    // Wait for spaces to complete (if it was started)
    await spacesPromise;

    initializeStickyHeader();

    // Initialize components that need settings
    initializeModalCharacterCounter();
    initializeAutoResizeTextarea();
    updateFileUploadText();
    initializeSortFooter();

    // Calculate initial space container height
    updateSpaceContainerHeight();
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
    
    // Space modal events
    document.getElementById('add-space-btn').onclick = showSpaceModal;
    document.getElementById('cancel-space').onclick = handleSpaceModalClose;

    // Add real-time validation for space name
    document.getElementById('space-name').addEventListener('input', function(e) {
        const name = e.target.value.trim();
        const submitBtn = document.querySelector('button[form="space-form"]');

        if (!submitBtn) return;

        // Check if name is valid - use the same validation as submission
        const isValid = name.length > 0 &&
                       name.length <= window.AppConstants.VALIDATION_LIMITS.maxSpaceNameLength &&
                       validateSpaceDisplayName(name);

        if (!isValid) {
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    });

    document.getElementById('space-form').onsubmit = async function(e) {
        e.preventDefault();

        const name = document.getElementById('space-name').value.trim();

        if (name.length === 0) {
            showError(window.AppConstants.USER_MESSAGES.error.spaceNameEmpty);
            return;
        }

        if (name.length > window.AppConstants.VALIDATION_LIMITS.maxSpaceNameLength) {
            showError(formatMessage(window.AppConstants.USER_MESSAGES.error.spaceNameTooLong, window.AppConstants.VALIDATION_LIMITS.maxSpaceNameLength));
            return;
        }

        // Validate character restrictions (updated pattern)
        if (!validateSpaceDisplayName(name)) {
            showError(window.AppConstants.USER_MESSAGES.error.spaceNameInvalidChars);
            return;
        }

        const parentId = document.getElementById('space-parent').value || null;
        const description = document.getElementById('space-description').value.trim();

        try {
            const newSpace = await createSpace(name, parentId, description);
            hideSpaceModal();

            // Auto-select the newly created space
            if (newSpace) {
                // Immediately clear posts to prevent showing previous space's posts
                const postsContainer = document.getElementById('posts-container');
                if (postsContainer) {
                    postsContainer.innerHTML = `
                        <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                            <i class="fas fa-spinner fa-spin text-4xl mb-4"></i>
                            <p>Loading posts...</p>
                        </div>
                    `;
                }

                populateSpaceSelect(); // Update dropdowns
                // Navigate using router to update URL
                if (typeof router !== 'undefined' && router.navigateToSpace) {
                    router.navigateToSpace(newSpace);
                } else {
                    selectSpace(newSpace); // Fallback if router not available
                }
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
        if (currentSpace) {
            toggleRecursiveMode(currentSpace);
        }
    });

    document.getElementById('delete-space-btn').addEventListener('click', () => {
        if (currentSpace) {
            deleteSpace(currentSpace);
        }
    });

    document.getElementById('edit-space-btn').addEventListener('click', () => {
        if (currentSpace) {
            showEditSpaceModal();
        }
    });

    // Space actions dropdown functionality
    const spaceActionsBtn = document.getElementById('space-actions-btn');
    const spaceActionsMenu = document.getElementById('space-actions-menu');

    spaceActionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        spaceActionsMenu.classList.toggle('hidden');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!spaceActionsBtn.contains(e.target) && !spaceActionsMenu.contains(e.target)) {
            spaceActionsMenu.classList.add('hidden');
        }
    });

    // Edit space modal events
    document.getElementById('cancel-edit-space').onclick = handleEditSpaceModalClose;

    // Add description character counters
    document.getElementById('space-description').addEventListener('input', function() {
        updateDescriptionCounter('space-description', 'description-counter');
    });

    document.getElementById('edit-space-description').addEventListener('input', function() {
        updateDescriptionCounter('edit-space-description', 'edit-description-counter');
    });

    // Edit space form validation and submission
    document.getElementById('edit-space-name').addEventListener('input', function(e) {
        const name = e.target.value.trim();
        const submitBtn = document.querySelector('button[form="edit-space-form"]');

        if (!submitBtn) return;

        // Check if name is valid - use the same validation as submission
        const isValid = name.length > 0 &&
                       name.length <= window.AppConstants.VALIDATION_LIMITS.maxSpaceNameLength &&
                       validateSpaceDisplayName(name);

        if (!isValid) {
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    });

    document.getElementById('edit-space-form').onsubmit = async function(e) {
        e.preventDefault();

        const name = document.getElementById('edit-space-name').value.trim();

        if (name.length === 0) {
            showError(window.AppConstants.USER_MESSAGES.error.spaceNameEmpty);
            return;
        }

        if (name.length > window.AppConstants.VALIDATION_LIMITS.maxSpaceNameLength) {
            showError(formatMessage(window.AppConstants.USER_MESSAGES.error.spaceNameTooLong, window.AppConstants.VALIDATION_LIMITS.maxSpaceNameLength));
            return;
        }

        // Validate character restrictions (updated pattern)
        if (!validateSpaceDisplayName(name)) {
            showError(window.AppConstants.USER_MESSAGES.error.spaceNameInvalidChars);
            return;
        }

        const parentId = document.getElementById('edit-space-parent').value || null;
        const description = document.getElementById('edit-space-description').value.trim();

        if (description.length > window.AppConstants.VALIDATION_LIMITS.maxSpaceDescriptionLength) {
            showError(formatMessage(window.AppConstants.USER_MESSAGES.error.spaceDescTooLong, window.AppConstants.VALIDATION_LIMITS.maxSpaceDescriptionLength));
            return;
        }

        // Check if anything has actually changed
        const currentParentId = currentSpace.parent_id ? currentSpace.parent_id.toString() : null;
        const newParentId = parentId ? parentId.toString() : null;

        const nameChanged = name !== currentSpace.name;
        const descriptionChanged = description !== (currentSpace.description || '');
        const parentChanged = currentParentId !== newParentId;

        if (!nameChanged && !descriptionChanged && !parentChanged) {
            // Nothing changed, just close modal
            hideEditSpaceModal();
            return;
        }

        try {
            const updatedSpace = await updateSpace(currentSpace.id, name, description, parentId);
            hideEditSpaceModal();

            // Update current space and refresh display
            if (updatedSpace) {
                populateSpaceSelect(); // Update dropdowns
                selectSpace(updatedSpace); // Programmatic selection after space update
                showSuccess(``);
            }
        } catch (error) {
            showError(error.message);
        }
    };



    // Modal form submission handler
    document.getElementById('modal-create-post-form').onsubmit = async function(e) {
        e.preventDefault();

        if (!currentSpace) {
            showError(window.AppConstants.USER_MESSAGES.error.noSpaceSelected);
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
                space_id: currentSpace.id,
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
            incrementSpacePostCount(currentSpace.id, 1);

            // Update the display with the updated counts
            updateSpaceStatsDisplay();

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
        const spaceModal = document.getElementById('space-modal');
        const editSpaceModal = document.getElementById('edit-space-modal');
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
        } else if (!spaceModal.classList.contains('hidden')) {
            switch(e.key) {
                case 'Escape':
                    handleSpaceModalClose();
                    break;
            }
        } else if (!editSpaceModal.classList.contains('hidden')) {
            switch(e.key) {
                case 'Escape':
                    handleEditSpaceModalClose();
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
    document.getElementById('space-modal').onclick = function(e) {
        if (e.target === this) {
            handleSpaceModalClose();
        }
    };

    document.getElementById('edit-space-modal').onclick = function(e) {
        if (e.target === this) {
            handleEditSpaceModalClose();
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
        if (currentSpace && document.getElementById('activity-container').style.display !== 'none') {
            // Only regenerate if we have cached data to avoid unnecessary API calls
            if (currentActivityCache) {
                generateHeatmapFromCache(currentActivityCache);
            }
        }

        // Update header breadcrumb for mobile/desktop responsiveness
        if (currentSpace && currentSpace.id !== window.AppConstants.ALL_SPACES_ID) {
            // Re-render the header with responsive breadcrumb
            updateSpaceStatsDisplay();
        }

        // Recalculate space container height on resize
        updateSpaceContainerHeight();

        // Handle legacy keyboard detection for older browsers
        if (!window.visualViewport) {
            handleLegacyKeyboard();
        }
    }, 300);
});