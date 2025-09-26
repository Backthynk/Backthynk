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
    div.className = 'category-item mb-1';

    const hasChildren = categories.some(cat => cat.parent_id === category.id);
    const isExpanded = expandedCategories.has(category.id);
    const shouldShowChildren = isExpanded;

    const mainDiv = document.createElement('div');
    mainDiv.className = 'flex items-center group';

    // Expand/collapse button with modern styling
    let expandButton = '';
    if (hasChildren) {
        expandButton = `
            <button class="expand-btn flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-all duration-200 mr-1" style="margin-left: ${level * 14}px;">
                <i class="fas fa-chevron-${isExpanded ? 'down' : 'right'} text-xs"></i>
            </button>
        `;
    } else {
        expandButton = `<div class="w-5 h-5 mr-1" style="margin-left: ${level * 14}px;"></div>`;
    }

    // Main category button with GitHub-style design
    const categoryButton = document.createElement('button');
    const isSelected = currentCategory?.id === category.id;
    categoryButton.className = `category-btn flex-1 text-left px-2 py-1.5 rounded-md transition-all duration-200 min-w-0 group-hover:bg-gray-50 ${
        isSelected
            ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-500 font-medium'
            : 'text-gray-700 hover:text-gray-900'
    }`;
    categoryButton.dataset.categoryId = category.id; // Add data attribute for easy identification

    categoryButton.innerHTML = `
        <div class="flex items-center min-w-0">
            <i class="fas fa-folder${isSelected ? '-open' : ''} mr-2 flex-shrink-0 text-xs ${isSelected ? 'text-blue-500' : 'text-gray-400'}"></i>
            <span class="text-sm truncate" title="${category.name}">${category.name}</span>
        </div>
    `;

    mainDiv.innerHTML = expandButton;
    mainDiv.appendChild(categoryButton);

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
        selectCategory(category, true); // fromUserClick = true
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

async function selectCategory(category, fromUserClick = false) {
    // If clicking on already selected category, deselect it (only for user clicks)
    if (fromUserClick && currentCategory && currentCategory.id === category.id) {
        await deselectCategory();
        return;
    }

    // FIRST: Immediately clear the posts container to prevent old posts from showing
    // Also force clear any ongoing loading state
    isLoadingPosts = false;
    const postsContainer = document.getElementById('posts-container');
    if (postsContainer) {
        postsContainer.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-spinner fa-spin text-4xl mb-4"></i>
                <p>Loading posts...</p>
            </div>
        `;
    }

    currentCategory = category;
    // Load saved recursive mode state for this category
    currentCategory.recursiveMode = loadRecursiveToggleState(category.id);

    saveLastCategory(category.id);

    // Ensure all parent categories are expanded to make this category visible
    expandCategoryPath(category.id);

    renderCategories();

    // Scroll to the selected category after rendering
    scrollToCategoryElement(category.id);

    loadPosts(category.id, currentCategory.recursiveMode);

    // Reset activity period when switching categories
    currentActivityPeriod = 0;

    // Reset scroll position to top
    window.scrollTo(0, 0);

    const stats = await fetchCategoryStats(category.id, currentCategory.recursiveMode);
    updateCategoryStatsDisplay(stats);
    document.getElementById('new-post-btn').style.display = 'block';
    document.getElementById('settings-btn').style.display = 'block';

    generateActivityHeatmap();
}

// Helper function to expand all parent categories of a given category
function expandCategoryPath(categoryId) {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return;

    // Recursively expand all parent categories
    function expandParents(cat) {
        if (cat.parent_id) {
            const parent = categories.find(c => c.id === cat.parent_id);
            if (parent) {
                expandedCategories.add(parent.id);
                expandParents(parent);
            }
        }
    }

    expandParents(category);
    saveExpandedCategories();
}

// Helper function to scroll the selected category into view
function scrollToCategoryElement(categoryId) {
    // Use setTimeout to ensure DOM is fully rendered
    setTimeout(() => {
        // Find the category button using the data attribute
        const targetButton = document.querySelector(`[data-category-id="${categoryId}"]`);

        if (targetButton) {
            // Get the categories container - check if it has a scrollable parent
            const container = document.getElementById('categories-tree');
            const scrollableParent = container?.closest('.overflow-auto, .overflow-y-auto, .overflow-scroll, .overflow-y-scroll') || container?.parentElement;

            if (scrollableParent) {
                // Get container bounds
                const containerRect = scrollableParent.getBoundingClientRect();
                const buttonRect = targetButton.getBoundingClientRect();

                // Check if the button is not fully visible within the scrollable container
                const isAboveView = buttonRect.top < containerRect.top;
                const isBelowView = buttonRect.bottom > containerRect.bottom;

                if (isAboveView || isBelowView) {
                    // Scroll the button into view with smooth behavior
                    targetButton.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                        inline: 'nearest'
                    });
                }
            } else {
                // If no specific scrollable container, just scroll into view
                targetButton.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'nearest'
                });
            }
        }
    }, 100); // Small delay to ensure DOM is updated and animations complete
}

async function deselectCategory() {
    // Create a special "category" object with ALL_CATEGORIES_ID to represent "all categories"
    currentCategory = {
        id: window.AppConstants.ALL_CATEGORIES_ID,
        name: "All categories",
        recursiveMode: false
    };

    localStorage.removeItem('lastSelectedCategory');
    renderCategories();

    // Immediately clear the posts container and loading state
    isLoadingPosts = false;
    const postsContainer = document.getElementById('posts-container');
    if (postsContainer) {
        postsContainer.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-spinner fa-spin text-4xl mb-4"></i>
                <p>Loading posts...</p>
            </div>
        `;
    }

    // Load posts for category ID 0 (all posts)
    loadPosts(0, false);

    // Reset activity period when switching to all categories
    currentActivityPeriod = 0;

    // Reset scroll position to top
    window.scrollTo(0, 0);

    // Update UI to show "All categories"
    await updateAllCategoriesDisplay();
    document.getElementById('new-post-btn').style.display = 'none';
    document.getElementById('settings-btn').style.display = 'block';

    generateActivityHeatmap();
}

async function toggleRecursiveMode(category) {
    if (!currentCategory || currentCategory.id !== category.id) return;

    currentCategory.recursiveMode = !currentCategory.recursiveMode;

    // Save the new state
    saveRecursiveToggleState(category.id, currentCategory.recursiveMode);

    // Scroll to top when toggling
    window.scrollTo(0, 0);

    renderCategories();
    loadPosts(category.id, currentCategory.recursiveMode);

    const stats = await fetchCategoryStats(category.id, currentCategory.recursiveMode);
    updateCategoryStatsDisplay(stats);

    generateActivityHeatmap();
}

// Functions to manage recursive toggle state per category
function saveRecursiveToggleState(categoryId, recursiveMode) {
    const recursiveStates = JSON.parse(localStorage.getItem('recursiveToggleStates') || '{}');
    recursiveStates[categoryId] = recursiveMode;
    localStorage.setItem('recursiveToggleStates', JSON.stringify(recursiveStates));
}

function loadRecursiveToggleState(categoryId) {
    const recursiveStates = JSON.parse(localStorage.getItem('recursiveToggleStates') || '{}');
    return recursiveStates[categoryId] || false;
}

function removeRecursiveToggleState(categoryId) {
    const recursiveStates = JSON.parse(localStorage.getItem('recursiveToggleStates') || '{}');
    delete recursiveStates[categoryId];
    localStorage.setItem('recursiveToggleStates', JSON.stringify(recursiveStates));
}

function cleanupRecursiveToggleStates() {
    // Clean up states for categories that no longer exist
    const recursiveStates = JSON.parse(localStorage.getItem('recursiveToggleStates') || '{}');
    const existingCategoryIds = new Set(categories.map(cat => cat.id.toString()));

    const cleanedStates = {};
    for (const [categoryId, state] of Object.entries(recursiveStates)) {
        if (existingCategoryIds.has(categoryId)) {
            cleanedStates[categoryId] = state;
        }
    }

    localStorage.setItem('recursiveToggleStates', JSON.stringify(cleanedStates));
}

// Helper function to build category breadcrumb path
function getCategoryBreadcrumb(categoryId) {
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

    return path.join(' > ');
}

// Helper function to build interactive breadcrumb with clickable links
function getInteractiveCategoryBreadcrumb(categoryId) {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return '';

    const pathElements = [];
    let current = category;

    while (current) {
        pathElements.unshift({
            id: current.id,
            name: current.name
        });
        if (current.parent_id) {
            current = categories.find(cat => cat.id === current.parent_id);
        } else {
            current = null;
        }
    }

    return pathElements.map((element, index) => {
        if (index === pathElements.length - 1) {
            // Last element (current category) - not clickable
            return `<span class="text-gray-900">${element.name}</span>`;
        } else {
            // Parent elements - clickable
            return `<span class="text-blue-600 hover:text-blue-800 cursor-pointer transition-colors" onclick="navigateToCategory(${element.id})">${element.name}</span>`;
        }
    }).join(' <span class="text-gray-400">></span> ');
}

// Function to navigate to a category when breadcrumb is clicked
function navigateToCategory(categoryId) {
    const category = categories.find(cat => cat.id === categoryId);
    if (category) {
        selectCategory(category); // Programmatic navigation from breadcrumb or other UI
    }
}

// Function to get all descendant categories recursively
async function getAllDescendantCategories(parentId) {
    const descendants = [];

    // Get direct children
    const directChildren = categories.filter(cat => cat.parent_id === parentId);

    for (const child of directChildren) {
        descendants.push(child);
        // Recursively get children of this child
        const childDescendants = await getAllDescendantCategories(child.id);
        descendants.push(...childDescendants);
    }

    return descendants;
}

// Function to get all posts recursively from a category
async function getAllPostsRecursively(categoryId) {
    let allPosts = [];
    let offset = 0;
    const limit = window.AppConstants.UI_CONFIG.categoryBatchLimit;
    let hasMore = true;

    while (hasMore) {
        try {
            const response = await fetchPosts(categoryId, limit, offset, true, true); // recursive = true
            if (!response) {
                hasMore = false;
                continue;
            }

            const posts = response.posts || response;
            if (!posts || !Array.isArray(posts) || posts.length === 0) {
                hasMore = false;
            } else {
                allPosts = [...allPosts, ...posts];
                offset += posts.length;

                // Check if we have more posts
                if (response.has_more !== undefined) {
                    hasMore = response.has_more;
                } else {
                    hasMore = posts.length === limit;
                }
            }
        } catch (error) {
            console.error('Error fetching posts for deletion preview:', error);
            break;
        }
    }

    return allPosts;
}

async function deleteCategory(category) {
    // Get recursive stats to show the true count including subcategories
    const recursiveStats = await fetchCategoryStats(category.id, true);
    const totalPosts = recursiveStats.post_count;
    const totalFiles = recursiveStats.file_count;

    // Get all descendant categories for accurate count
    const allDescendants = await getAllDescendantCategories(category.id);
    const totalSubcategories = allDescendants.length;

    // Get all posts with attachments to build file list
    const allPosts = await getAllPostsRecursively(category.id);

    let message = `Are you sure you want to delete "${category.name}"?`;

    if (totalSubcategories > 0) {
        message += `\n\nThis will also delete **${totalSubcategories}** subcategory(ies)`;
    }

    if (totalPosts > 0) {
        message += ` and **${totalPosts}** post(s)`;
        if (fileStatsEnabled && totalFiles > 0) {
            message += ` with **${totalFiles}** file(s)`;
        }
        message += '.';
    }

    message += '\n\nThis action cannot be undone.';

    // Build details HTML for lists
    let detailsHtml = '';

    // Subcategories list
    if (allDescendants.length > 0) {
        detailsHtml += '<div class="mb-4"><h4 class="text-sm font-semibold text-gray-700 mb-2">Subcategories to be deleted:</h4>';
        detailsHtml += '<div class="bg-gray-50 rounded p-3 max-h-32 overflow-y-auto"><ul class="text-sm text-gray-600 space-y-1">';

        allDescendants.forEach(subcat => {
            const breadcrumb = getCategoryBreadcrumb(subcat.id);
            detailsHtml += `<li>• ${breadcrumb}</li>`;
        });

        detailsHtml += '</ul></div></div>';
    }

    // Files list
    const allFiles = [];
    allPosts.forEach(post => {
        if (post.attachments && post.attachments.length > 0) {
            post.attachments.forEach(attachment => {
                allFiles.push({
                    filename: attachment.filename,
                    size: attachment.file_size,
                    postId: post.id
                });
            });
        }
    });

    if (fileStatsEnabled && allFiles.length > 0) {
        detailsHtml += '<div class="mb-4"><h4 class="text-sm font-semibold text-gray-700 mb-2">Files to be deleted:</h4>';
        detailsHtml += '<div class="bg-gray-50 rounded p-3 max-h-40 overflow-y-auto"><ul class="text-sm text-gray-600 space-y-1">';

        allFiles.forEach(file => {
            detailsHtml += `<li class="flex justify-between items-center">
                <span>• ${file.filename}</span>
                <span class="text-xs text-gray-400">${formatFileSize(file.size)}</span>
            </li>`;
        });

        detailsHtml += '</ul></div></div>';
    }

    const confirmed = await showConfirmation('Delete Category', message, detailsHtml);
    if (confirmed) {
        try {
            await deleteCategoryApi(category.id);

            // Remove recursive toggle state for this category
            removeRecursiveToggleState(category.id);

            await fetchCategories();

            // Show success message
            showSuccess(`Category "${category.name}" ${window.AppConstants.USER_MESSAGES.success.categoryDeleted}`);

            // Cleanup any orphaned toggle states
            cleanupRecursiveToggleStates();

            if (currentCategory && currentCategory.id === category.id) {
                currentCategory = null;
                localStorage.removeItem('lastSelectedCategory');
                document.getElementById('timeline-title').textContent = 'Select a category';
                document.getElementById('new-post-btn').style.display = 'none';
                document.getElementById('settings-btn').style.display = 'none';
                document.getElementById('recursive-toggle-btn').style.display = 'none';
                document.getElementById('delete-category-btn').style.display = 'none';
                document.getElementById('edit-category-btn').style.display = 'none';
                document.getElementById('posts-container').innerHTML = '';
            }
        } catch (error) {
            showError(formatMessage(window.AppConstants.USER_MESSAGES.error.failedToDeleteCategory, error.message));
        }
    }
}