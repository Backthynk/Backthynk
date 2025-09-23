// UI functions
function showCreatePost() {
    if (!currentCategory) {
        showError('Please select a category first');
        return;
    }

    document.getElementById('create-post-section').style.display = 'block';
    document.getElementById('post-content').focus();
}

function hideCreatePost() {
    document.getElementById('create-post-section').style.display = 'none';
    document.getElementById('create-post-form').reset();
    selectedFiles.clear();
    updateFilePreview();
    window.pastedFiles = [];
    updatePastedFilesDisplay();
}

function showCategoryModal() {
    document.getElementById('category-modal').classList.remove('hidden');
    document.getElementById('category-name').focus();
}

function hideCategoryModal() {
    document.getElementById('category-modal').classList.add('hidden');
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
    const statsHtml = `
        <div>Total: ${globalStats.totalPosts} posts</div>
        <div>${globalStats.totalFiles} files • ${formatFileSize(globalStats.totalSize)}</div>
    `;

    // Update header stats
    const headerStats = document.getElementById('global-stats-header');
    if (headerStats) {
        headerStats.innerHTML = statsHtml;
    }
}