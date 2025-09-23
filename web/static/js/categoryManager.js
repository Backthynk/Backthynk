// Category management functions
function renderCategories() {
    const container = document.getElementById('categories-tree');
    container.innerHTML = '';

    const rootCategories = categories.filter(cat => !cat.parent_id);

    rootCategories.forEach(category => {
        const element = createCategoryElement(category);
        container.appendChild(element);
    });
}

function createCategoryElement(category, level = 0) {
    const div = document.createElement('div');
    div.className = 'category-item';

    const hasChildren = categories.some(cat => cat.parent_id === category.id);
    const isExpanded = expandedCategories.has(category.id);
    const shouldShowChildren = isExpanded; // Remove the level === 0 condition

    const mainDiv = document.createElement('div');
    mainDiv.className = 'flex items-center group hover:bg-gray-50 rounded-lg transition-colors';

    // Expand/collapse button (separate from main button)
    let expandButton = '';
    if (hasChildren) {
        expandButton = `
            <button class="expand-btn flex-shrink-0 w-6 h-6 flex items-center justify-center hover:bg-gray-200 rounded transition-colors mr-1" style="margin-left: ${level * 16}px;">
                <i class="fas fa-chevron-${isExpanded ? 'down' : 'right'} text-xs text-gray-400"></i>
            </button>
        `;
    } else {
        expandButton = `<div class="w-6 h-6 mr-1" style="margin-left: ${level * 16 + (hasChildren ? 0 : 6)}px;"></div>`;
    }

    // Main category button
    const categoryButton = document.createElement('button');
    categoryButton.className = `category-btn flex-1 text-left px-2 py-2 rounded-md transition-colors min-w-0 ${
        currentCategory?.id === category.id ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
    }`;

    categoryButton.innerHTML = `
        <div class="flex items-center justify-between min-w-0">
            <div class="flex items-center min-w-0">
                <i class="fas fa-folder${currentCategory?.id === category.id ? '-open' : ''} mr-2 flex-shrink-0"></i>
                <span class="font-medium truncate" title="${category.name}">${category.name}</span>
            </div>
            <div class="text-xs text-gray-400 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                ${formatRelativeDate(category.created)}
            </div>
        </div>
    `;

    // Delete button
    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-btn flex-shrink-0 w-8 h-8 flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100 ml-1';
    deleteButton.innerHTML = '<i class="fas fa-trash-alt text-xs"></i>';

    mainDiv.innerHTML = expandButton;
    mainDiv.appendChild(categoryButton);
    mainDiv.appendChild(deleteButton);

    div.appendChild(mainDiv);

    // Add event listeners after elements are created
    const expandBtn = mainDiv.querySelector('.expand-btn');
    if (expandBtn) {
        expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCategory(category.id);
        });
    }

    categoryButton.addEventListener('click', (e) => {
        e.stopPropagation();
        selectCategory(category);
    });

    deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCategory(category);
    });

    // Add subcategories only if expanded
    if (hasChildren && shouldShowChildren) {
        const subcategories = categories.filter(cat => cat.parent_id === category.id);
        subcategories.forEach(subcat => {
            const subElement = createCategoryElement(subcat, level + 1);
            div.appendChild(subElement);
        });
    }

    return div;
}

function toggleCategory(categoryId) {
    if (expandedCategories.has(categoryId)) {
        expandedCategories.delete(categoryId);
    } else {
        expandedCategories.add(categoryId);
    }
    saveExpandedCategories();
    renderCategories();
}

async function selectCategory(category) {
    currentCategory = category;
    saveLastCategory(category.id);
    renderCategories();
    loadPosts(category.id);

    // Reset activity period when switching categories
    currentActivityPeriod = 0;

    const stats = await fetchCategoryStats(category.id);
    updateCategoryStatsDisplay(stats);
    document.getElementById('new-post-btn').style.display = 'block';

    generateActivityHeatmap();
}

async function deleteCategory(category) {
    const subcategories = categories.filter(cat => cat.parent_id === category.id);
    const stats = await fetchCategoryStats(category.id);
    const totalPosts = stats.post_count;

    let message = `Are you sure you want to delete "${category.name}"?`;

    if (subcategories.length > 0) {
        message += `\n\nThis will also delete ${subcategories.length} subcategory(ies)`;
    }

    if (totalPosts > 0) {
        message += ` and ${totalPosts} post(s) with all their files.`;
    }

    message += '\n\nThis action cannot be undone.';

    if (confirm(message)) {
        try {
            await deleteCategoryApi(category.id);
            await fetchCategories();
            if (currentCategory && currentCategory.id === category.id) {
                currentCategory = null;
                localStorage.removeItem('lastSelectedCategory');
                document.getElementById('timeline-title').textContent = 'Select a category';
                document.getElementById('new-post-btn').style.display = 'none';
                document.getElementById('posts-container').innerHTML = '';
            }
        } catch (error) {
            showError('Failed to delete category: ' + error.message);
        }
    }
}