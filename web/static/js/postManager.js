// Post management functions
let currentPosts = [];
let currentOffset = 0;
let hasMorePosts = true;
let isLoadingPosts = false;
let virtualScroller = null;
const VIRTUAL_SCROLL_THRESHOLD = window.AppConstants.UI_CONFIG.virtualScrollThreshold;

async function loadPosts(categoryId, recursive = false, reset = true) {
    if (isLoadingPosts) return;

    try {
        isLoadingPosts = true;

        if (reset) {
            currentPosts = [];
            currentOffset = 0;
            hasMorePosts = true;
        }

        const response = await fetchPosts(categoryId, window.AppConstants.UI_CONFIG.defaultPostsPerPage, currentOffset, false, recursive);
        let posts = response.posts || response; // Handle both new and old API response formats

        // Ensure posts is an array
        if (!posts || !Array.isArray(posts)) {
            posts = [];
        }

        if (reset) {
            currentPosts = posts;
        } else {
            currentPosts = [...currentPosts, ...posts];
        }

        if (response && response.has_more !== undefined) {
            hasMorePosts = response.has_more;
        } else {
            // Fallback for old API format
            hasMorePosts = posts.length === window.AppConstants.UI_CONFIG.defaultPostsPerPage;
        }

        currentOffset += posts.length;
        renderPosts(currentPosts, reset);

        // Setup infinite scroll if this is a fresh load
        if (reset) {
            setupInfiniteScroll(categoryId, recursive);
        }

    } catch (error) {
        console.error('Failed to fetch posts:', error);
        if (reset) {
            renderPosts([]);
        }
    } finally {
        isLoadingPosts = false;
    }
}

async function loadMorePosts(categoryId, recursive = false) {
    if (!hasMorePosts || isLoadingPosts) return;

    await loadPosts(categoryId, recursive, false);
}


function setupInfiniteScroll(categoryId, recursive = false) {
    const container = document.getElementById('posts-container');

    // Remove existing scroll listener
    window.removeEventListener('scroll', window.infiniteScrollHandler);

    // Add new scroll listener
    window.infiniteScrollHandler = () => {
        if (!hasMorePosts || isLoadingPosts) return;

        const scrollPosition = window.innerHeight + window.scrollY;
        const threshold = document.documentElement.offsetHeight - window.AppConstants.UI_CONFIG.infiniteScrollThreshold;

        if (scrollPosition >= threshold) {
            loadMorePosts(categoryId, recursive);
        }
    };

    window.addEventListener('scroll', window.infiniteScrollHandler);
}


function renderPosts(posts, reset = true) {
    const container = document.getElementById('posts-container');

    // Ensure posts is an array
    if (!posts || !Array.isArray(posts)) {
        posts = [];
    }

    if (reset) {
        // Clean up existing virtual scroller
        if (virtualScroller) {
            virtualScroller.destroy();
            virtualScroller = null;
        }

        if (posts.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <i class="fas fa-inbox text-4xl mb-4"></i>
                    <p>${window.AppConstants.UI_TEXT.noPostsYet}</p>
                </div>
            `;
            return;
        }

        // Decide whether to use virtual scrolling
        if (posts.length > VIRTUAL_SCROLL_THRESHOLD) {
            if (!virtualScroller) {
                virtualScroller = new PostVirtualScroller(container);
            }
            virtualScroller.setItems(posts);
            return;
        } else {
            // Use regular DOM rendering
            container.innerHTML = '';
        }
    }

    // Regular DOM rendering for smaller lists or appending
    if (virtualScroller && posts.length > VIRTUAL_SCROLL_THRESHOLD) {
        if (reset) {
            virtualScroller.setItems(posts);
        } else {
            const newPosts = posts.slice(currentPosts.length - (posts.length - currentPosts.length));
            virtualScroller.addItems(newPosts);
        }
    } else {
        // Regular DOM rendering
        if (!reset) {
            // If not reset, only add new posts (ones that aren't already in the DOM)
            const existingPostIds = new Set(Array.from(container.querySelectorAll('[data-post-id]')).map(el => parseInt(el.dataset.postId)));

            posts.forEach(post => {
                if (!existingPostIds.has(post.id)) {
                    const element = createPostElement(post);
                    container.appendChild(element);
                }
            });
        } else {
            posts.forEach(post => {
                const element = createPostElement(post);
                container.appendChild(element);
            });
        }

        // Add loading indicator if there are more posts and not using virtual scroll
        if (hasMorePosts && !isLoadingPosts && !virtualScroller) {
            addLoadingIndicator(container);
        }
    }
}

function addLoadingIndicator(container) {
    const existingIndicator = container.querySelector('.loading-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }

    if (hasMorePosts) {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-indicator text-center py-4';
        loadingDiv.innerHTML = `
            <div class="text-gray-500">
                <i class="fas fa-spinner fa-spin mr-2"></i>
                Loading more posts...
            </div>
        `;
        container.appendChild(loadingDiv);
    }
}

function createPostElement(post) {
    const div = document.createElement('div');
    div.className = 'bg-white rounded-lg shadow-sm border p-6 mb-6 hover:shadow-md transition-shadow group max-w-full';
    div.setAttribute('data-post-id', post.id);

    const images = post.attachments ? post.attachments.filter(att => att.file_type.startsWith('image/')) : [];
    const otherFiles = post.attachments ? post.attachments.filter(att => !att.file_type.startsWith('image/')) : [];
    const totalAttachments = images.length + otherFiles.length;
    const linkPreviews = post.link_previews || [];

    // Check if we should show category breadcrumb
    // Show breadcrumb in two cases:
    // 1. When in recursive mode and post is from a different category
    // 2. When no category is selected (All categories view)
    const showCategoryBreadcrumb =
        (!currentCategory || currentCategory.id === window.AppConstants.ALL_CATEGORIES_ID) || // All categories view
        (currentCategory && currentCategory.recursiveMode && post.category_id !== currentCategory.id); // Recursive mode
    const categoryBreadcrumb = showCategoryBreadcrumb ? getCategoryBreadcrumb(post.category_id) : '';

    // Make category breadcrumb clickable if we're showing it
    const clickableCategoryBreadcrumb = showCategoryBreadcrumb ?
        `<span class="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded cursor-pointer hover:bg-blue-100 transition-colors" onclick="navigateToCategoryFromPost(${post.category_id})">${categoryBreadcrumb}</span>` :
        '';

    // Simple header
    const headerHtml = `
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-2">
                ${clickableCategoryBreadcrumb}
                <span class="text-sm text-gray-500">${formatRelativeDate(post.created)}</span>
                ${totalAttachments > 0 ? `
                    <span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                        ${totalAttachments} file${totalAttachments > 1 ? 's' : ''}
                    </span>
                ` : ''}
                ${linkPreviews.length > 0 ? `
                    <span class="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                        ${linkPreviews.length} link${linkPreviews.length > 1 ? 's' : ''}
                    </span>
                ` : ''}
            </div>
            <div class="relative opacity-0 group-hover:opacity-100 transition-all">
                <button onclick="togglePostActionMenu(${post.id})" class="text-gray-400 hover:text-gray-600 p-1 rounded transition-all">
                    <i class="fas fa-ellipsis-h text-sm"></i>
                </button>
                <div id="post-action-menu-${post.id}" class="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-50 hidden">
                    <div class="py-1">
                        <button onclick="showMoveModal(${post.id})" class="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors">
                            <i class="fas fa-exchange-alt text-xs mr-2"></i>
                            Move
                        </button>
                        <button onclick="confirmDeletePost(${post.id})" class="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                            <i class="fas fa-trash-alt text-xs mr-2"></i>
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Content with formatted URLs
    const contentHtml = `
        <div class="mb-4 post-content">
            <div class="text-gray-900 leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">${formatTextWithUrls(post.content)}</div>
        </div>
    `;

    // Link previews
    let linkPreviewsHtml = '';
    if (linkPreviews.length > 0) {
        linkPreviewsHtml = `
            <div class="mb-4 space-y-3">
                ${linkPreviews.map(preview => createPostLinkPreviewElement(preview)).join('')}
            </div>
        `;
    }

    // Simple attachments
    let attachmentsHtml = '';
    if (totalAttachments > 0) {
        attachmentsHtml = '<div class="border-t pt-4 space-y-3">';

        // Images - simple grid
        if (images.length > 0) {
            const imageData = images.map(img => ({url: '/uploads/' + img.file_path, filename: img.filename}));

            if (images.length === 1) {
                attachmentsHtml += `
                    <div class="max-w-lg">
                        <img src="/uploads/${images[0].file_path}"
                             alt="${images[0].filename}"
                             class="w-full rounded-lg border cursor-pointer hover:opacity-90"
                             onclick="openImageGallery(0)"
                             data-images='${JSON.stringify(imageData)}'>
                    </div>
                `;
            } else {
                attachmentsHtml += `
                    <div class="grid grid-cols-2 gap-2 max-w-lg">
                        ${images.slice(0, 4).map((img, idx) => `
                            <img src="/uploads/${img.file_path}"
                                 alt="${img.filename}"
                                 class="w-full h-32 object-cover rounded border cursor-pointer hover:opacity-90"
                                 onclick="openImageGallery(${idx})"
                                 data-images='${JSON.stringify(imageData)}'>
                        `).join('')}
                    </div>
                `;

                if (images.length > 4) {
                    attachmentsHtml += `<p class="text-sm text-gray-500">+${images.length - 4} more images</p>`;
                }
            }
        }

        // Other files - simple list
        if (otherFiles.length > 0) {
            attachmentsHtml += `
                <div class="space-y-2">
                    ${otherFiles.map(file => `
                        <div class="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                             onclick="window.open('/uploads/${file.file_path}', '_blank')">
                            <i class="fas fa-file text-gray-500 mr-3"></i>
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium text-gray-900 truncate">${file.filename}</p>
                                <p class="text-xs text-gray-500">${formatFileSize(file.file_size)}</p>
                            </div>
                            <i class="fas fa-external-link-alt text-gray-400 text-xs"></i>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        attachmentsHtml += '</div>';
    }

    div.innerHTML = headerHtml + contentHtml + linkPreviewsHtml + attachmentsHtml;
    return div;
}

function togglePostActionMenu(postId) {
    // Close any other open menus first
    document.querySelectorAll('[id^="post-action-menu-"]').forEach(menu => {
        if (menu.id !== `post-action-menu-${postId}`) {
            menu.classList.add('hidden');
        }
    });

    const menu = document.getElementById(`post-action-menu-${postId}`);
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

// Close menus when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('[id^="post-action-menu-"]') && !e.target.closest('button[onclick*="togglePostActionMenu"]')) {
        document.querySelectorAll('[id^="post-action-menu-"]').forEach(menu => {
            menu.classList.add('hidden');
        });
    }
});

let currentMovePostId = null;

function showMoveModal(postId) {
    currentMovePostId = postId;

    // Find the post to get current category info
    const post = currentPosts.find(p => p.id === postId);
    if (!post) return;

    // Get current category name
    const currentCategory = categories.find(cat => cat.id === post.category_id);
    const currentCategoryBreadcrumb = currentCategory ? getCategoryBreadcrumb(post.category_id) : 'Unknown Category';

    // Update current category display
    document.getElementById('current-category-display').textContent = currentCategoryBreadcrumb;

    // Populate category dropdown
    populateMoveCategoryDropdown(post.category_id);

    // Show modal
    document.getElementById('move-modal').classList.remove('hidden');

    // Close any open post action menus
    document.querySelectorAll('[id^="post-action-menu-"]').forEach(menu => {
        menu.classList.add('hidden');
    });
}

function populateMoveCategoryDropdown(currentCategoryId) {
    const select = document.getElementById('move-category');
    select.innerHTML = '<option value="">Select a category...</option>';

    // Add all categories except the current one
    categories.forEach(category => {
        if (category.id !== currentCategoryId) {
            const breadcrumb = getCategoryBreadcrumb(category.id);
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = breadcrumb;
            select.appendChild(option);
        }
    });
}

function hideMoveModal() {
    document.getElementById('move-modal').classList.add('hidden');
    document.getElementById('move-category').value = '';
    currentMovePostId = null;
}

// Event listeners for move modal
document.getElementById('cancel-move').addEventListener('click', hideMoveModal);

document.getElementById('move-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    if (!currentMovePostId) return;

    const newCategoryId = parseInt(document.getElementById('move-category').value);
    if (!newCategoryId) {
        showError('Please select a category to move the post to.');
        return;
    }

    try {
        // Get the old category ID before moving
        const post = currentPosts.find(p => p.id === currentMovePostId);
        const oldCategoryId = post ? post.category_id : null;

        await movePost(currentMovePostId, newCategoryId);

        // Update post counts locally
        if (oldCategoryId) {
            incrementCategoryPostCount(oldCategoryId, -1); // Remove from old category
        }
        incrementCategoryPostCount(newCategoryId, 1); // Add to new category

        // Find the new category name for success message
        const newCategory = categories.find(cat => cat.id === newCategoryId);
        const newCategoryName = newCategory ? newCategory.name : 'selected category';

        showSuccess(`Post successfully moved to ${newCategoryName}`);

        // Remove the post from current view if it no longer belongs here
        let shouldRemoveFromView = false;

        if (currentCategory && currentCategory.id !== window.AppConstants.ALL_CATEGORIES_ID) {
            if (currentCategory.recursiveMode) {
                // In recursive mode, check if the new category is still part of this category tree
                const newCategoryObj = categories.find(cat => cat.id === newCategoryId);
                if (newCategoryObj) {
                    // Check if new category is this category or a descendant
                    const isDescendant = isDescendantCategory(newCategoryId, currentCategory.id);
                    shouldRemoveFromView = !(newCategoryId === currentCategory.id || isDescendant);
                } else {
                    shouldRemoveFromView = true;
                }
            } else {
                // In non-recursive mode, only show posts directly in this category
                shouldRemoveFromView = newCategoryId !== currentCategory.id;
            }
        }

        if (shouldRemoveFromView) {
            // Remove the post from current posts array
            currentPosts = currentPosts.filter(p => p.id !== currentMovePostId);

            // Update virtual scroller if it exists
            if (virtualScroller) {
                virtualScroller.removeItem(currentMovePostId);
            }
        } else {
            // Update the post's category_id in the array (for All categories view or recursive mode)
            const postIndex = currentPosts.findIndex(p => p.id === currentMovePostId);
            if (postIndex !== -1) {
                currentPosts[postIndex].category_id = newCategoryId;
            }
        }

        // Refresh the display
        renderPosts(currentPosts, true);

        // Update the display with the updated counts
        if (currentCategory) {
            updateCategoryStatsDisplay();
        }

        // Regenerate activity heatmap to reflect the moved post (with small delay for backend processing)
        setTimeout(generateActivityHeatmap, 100);

        hideMoveModal();

    } catch (error) {
        showError(`Failed to move post: ${error.message}`);
    }
});

async function confirmDeletePost(postId) {

    // Find the post in current posts to get attachment details
    const post = currentPosts.find(p => p.id === postId);
    const attachments = (post && post.attachments) ? post.attachments : [];

    let message = 'Are you sure you want to delete this post?';

    if (attachments.length > 0) {
        message += `\n\nThis will also delete **${attachments.length}** attached file(s).`;
    }

    message += '\n\nThis action cannot be undone.';

    // Build details HTML for file list
    let detailsHtml = '';

    if (attachments.length > 0) {
        detailsHtml += '<div class="mb-4"><h4 class="text-sm font-semibold text-gray-700 mb-2">Files to be deleted:</h4>';
        detailsHtml += '<div class="bg-gray-50 rounded p-3 max-h-32 overflow-y-auto"><ul class="text-sm text-gray-600 space-y-1">';

        attachments.forEach(file => {
            detailsHtml += `<li class="flex justify-between items-center">
                <span>• ${file.filename}</span>
                <span class="text-xs text-gray-400">${formatFileSize(file.file_size)}</span>
            </li>`;
        });

        detailsHtml += '</ul></div></div>';
    }

    const confirmed = await showConfirmation('Delete Post', message, detailsHtml);
    if (confirmed) {
        try {
            await deletePost(postId);

            showSuccess('');

            // Decrement post count locally for immediate feedback
            incrementCategoryPostCount(currentCategory.id, -1);

            // Update the display
            updateCategoryStatsDisplay();

            // Regenerate activity heatmap to reflect deleted post (with small delay for backend processing)
            setTimeout(generateActivityHeatmap, 100);

            // Remove the post from current posts array and re-render
            currentPosts = currentPosts.filter(post => post.id !== postId);

            if (virtualScroller) {
                virtualScroller.removeItem(postId);
            } else {
                renderPosts(currentPosts, true);
            }

        } catch (error) {
            console.log(error)
            showError(formatMessage(window.AppConstants.USER_MESSAGES.error.failedToDeletePost, error.message));
        }
    }
}

function updateCategoryStatsDisplay(stats) {
    if (!currentCategory) return;

    // Ensure currentCategory has all properties by finding it in categories array
    const fullCategory = categories.find(cat => cat.id === currentCategory.id);
    if (fullCategory) {
        // Preserve recursiveMode if it was set
        const recursiveMode = currentCategory.recursiveMode;
        currentCategory = { ...fullCategory };
        currentCategory.recursiveMode = recursiveMode;
    }

    // Use post count from category object, not from stats
    const postCount = currentCategory.recursiveMode ?
        (currentCategory.recursive_post_count || 0) :
        (currentCategory.post_count || 0);

    let statsText = `${postCount} post${postCount !== 1 ? 's' : ''}`;

    // Only show files and size if file stats are enabled and there are files
    if (fileStatsEnabled && stats && stats.file_count > 0) {
        statsText += ` • ${stats.file_count} file${stats.file_count !== 1 ? 's' : ''} • ${formatFileSize(stats.total_size)}`;
    }

    // Get the interactive breadcrumb path for the current category
    const categoryBreadcrumb = getInteractiveCategoryBreadcrumb(currentCategory.id);

    // Format the creation date
    const creationDate = currentCategory.created ?
        new Date(currentCategory.created).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) :
        'Date unavailable';

    // Create tooltip content - show description if it exists
    const tooltipContent = currentCategory.description && currentCategory.description.trim()
        ? currentCategory.description
        : `Created ${creationDate}`;

    document.getElementById('timeline-title').innerHTML = `
        <div class="group relative">
            <h2 class="text-xl font-bold text-gray-900">${categoryBreadcrumb}</h2>
            <p class="text-xs text-gray-500 mt-0.5 relative">
                <span class="transition-opacity group-hover:opacity-0">${statsText}</span>
                <span class="absolute top-0 left-0 opacity-0 group-hover:opacity-100 transition-opacity">${creationDate}</span>
            </p>
            ${currentCategory.description && currentCategory.description.trim() ? `
                <div class="absolute left-0 top-full mt-1 px-2 py-1 bg-gray-900 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 max-w-xs">
                    ${currentCategory.description.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                </div>
            ` : ''}
        </div>
    `;

    // Update button visibility and states
    updateHeaderButtons();
}

// Function to update header button visibility and states
function updateHeaderButtons() {
    if (!currentCategory) {
        document.getElementById('recursive-toggle-btn').style.display = 'none';
        document.getElementById('category-actions-dropdown').style.display = 'none';
        document.getElementById('settings-btn').style.display = 'block';
        return;
    }

    // Check if current category has subcategories to show recursive toggle
    const hasSubcategories = categories.some(cat => cat.parent_id === currentCategory.id);
    const recursiveToggleBtn = document.getElementById('recursive-toggle-btn');

    if (hasSubcategories) {
        recursiveToggleBtn.style.display = 'block';
        // Update button styling based on state
        if (currentCategory.recursiveMode) {
            recursiveToggleBtn.className = 'flex items-center justify-center h-8 px-3 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors';
        } else {
            recursiveToggleBtn.className = 'flex items-center justify-center h-8 px-3 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-colors';
        }
    } else {
        recursiveToggleBtn.style.display = 'none';
    }

    // Show dropdown and hide settings when a category is selected
    document.getElementById('category-actions-dropdown').style.display = 'block';
    document.getElementById('settings-btn').style.display = 'none';
}

// Function to navigate to a category when clicked from a post
function navigateToCategoryFromPost(categoryId) {
    const category = categories.find(cat => cat.id === categoryId);
    if (category) {
        selectCategory(category); // Programmatic selection from post navigation
    }
}

// Function to update display for "All categories" view
async function updateAllCategoriesDisplay() {
    // Get global stats using category ID 0
    const stats = await fetchCategoryStats(0, false);

    // Find the first category created (oldest)
    const oldestCategory = categories.reduce((oldest, current) => {
        return (!oldest || current.created < oldest.created) ? current : oldest;
    }, null);

    const creationDate = oldestCategory ?
        new Date(oldestCategory.created).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) :
        'Date unavailable';

    let statsText = `${stats.post_count} post${stats.post_count !== 1 ? 's' : ''}`;

    // Only show files and size if file stats are enabled and there are files
    if (fileStatsEnabled && stats.file_count > 0) {
        statsText += ` • ${stats.file_count} file${stats.file_count !== 1 ? 's' : ''} • ${formatFileSize(stats.total_size)}`;
    }

    document.getElementById('timeline-title').innerHTML = `
        <div class="group">
            <h2 class="text-xl font-bold text-gray-900">All categories</h2>
            <p class="text-xs text-gray-500 mt-0.5 relative">
                <span class="transition-opacity group-hover:opacity-0">${statsText}</span>
                <span class="absolute top-0 left-0 opacity-0 group-hover:opacity-100 transition-opacity">${creationDate}</span>
            </p>
        </div>
    `;

    // Update button visibility - hide category-specific buttons
    document.getElementById('recursive-toggle-btn').style.display = 'none';
    document.getElementById('category-actions-dropdown').style.display = 'none';
    document.getElementById('settings-btn').style.display = 'block';
}

// Helper function to check if categoryId is a descendant of parentId
function isDescendantCategory(categoryId, parentId) {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category || !category.parent_id) {
        return false;
    }

    if (category.parent_id === parentId) {
        return true;
    }

    return isDescendantCategory(category.parent_id, parentId);
}

// Helper function to increment/decrement category post counts locally
function incrementCategoryPostCount(categoryId, delta) {
    // Update the specific category
    const category = categories.find(cat => cat.id === categoryId);
    if (category) {
        category.post_count = (category.post_count || 0) + delta;
        category.recursive_post_count = (category.recursive_post_count || 0) + delta;
    }

    // Update all parent categories' recursive counts
    categories.forEach(cat => {
        if (isDescendantCategory(categoryId, cat.id)) {
            cat.recursive_post_count = (cat.recursive_post_count || 0) + delta;
        }
    });

    // Update currentCategory if it matches
    if (currentCategory && currentCategory.id === categoryId) {
        currentCategory.post_count = (currentCategory.post_count || 0) + delta;
        currentCategory.recursive_post_count = (currentCategory.recursive_post_count || 0) + delta;
    }

    // Re-render categories to show updated counts
    renderCategories();
}