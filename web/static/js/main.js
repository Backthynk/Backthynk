// Main initialization and event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Load saved state
    loadExpandedCategories();

    // Load initial data
    fetchCategories();

    initializeStickyHeader();
    
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
            // Include link previews in the post creation
            const postData = {
                category_id: currentCategory.id,
                content: content,
                link_previews: getCurrentLinkPreviews()
            };

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
            loadPosts(currentCategory.id);
            // Refresh category stats
            const stats = await fetchCategoryStats(currentCategory.id);
            const statsText = `${stats.post_count} posts • ${stats.file_count} files • ${formatFileSize(stats.total_size)}`;
            document.getElementById('timeline-title').innerHTML = `
                <div>
                    <h2 class="text-2xl font-bold text-gray-900">${currentCategory.name}</h2>
                    <p class="text-sm text-gray-500">${statsText}</p>
                </div>
            `;

            // Refresh global stats
            await fetchGlobalStats();
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