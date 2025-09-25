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
}

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