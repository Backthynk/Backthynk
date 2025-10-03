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
                ${window.AppConstants.USER_MESSAGES.info.loadingMorePosts}
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

    // Redesigned header
    const headerHtml = `
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-2">
                ${clickableCategoryBreadcrumb}
                <span class="relative group/time text-sm text-gray-600 font-mono cursor-default">
                    ${formatRelativeDate(post.created)}
                    <div class="absolute left-0 top-full mt-1 px-2 py-1 bg-gray-900 text-white text-xs rounded-md shadow-lg opacity-0 group-hover/time:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                        ${formatFullDateTime(post.created)}
                    </div>
                </span>
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

    // Check if content is link-only (only contains a single URL and whitespace)
    const urlRegex = /https?:\/\/\S+/g;
    const urlMatches = post.content.match(urlRegex);
    const isLinkOnly = urlMatches && urlMatches.length === 1 && post.content.trim() === urlMatches[0];
    const shouldHideContent = isLinkOnly && linkPreviews.length > 0;

    // Content with markdown formatting or link conversion
    const contentDiv = document.createElement('div');
    contentDiv.className = 'mb-4 post-content';

    // Hide content if it's link-only and we have a link preview
    if (shouldHideContent) {
        contentDiv.style.display = 'none';
    }

    // Check if markdown is enabled via body class
    const isMarkdownEnabled = !document.body.classList.contains('markdown-disabled');

    // If markdown is disabled, convert URLs to clickable links
    let processedContent = post.content;
    if (!isMarkdownEnabled) {
        processedContent = formatTextWithUrls(post.content);
    }

    contentDiv.innerHTML = `<div class="markdown-body">${processedContent}</div>`;
    const contentHtml = contentDiv.innerHTML;

    // Priority logic: Show attachments if available, otherwise show link previews
    // If there are attachments, do NOT show link previews
    const linkPreviewsHtml = totalAttachments > 0 ? '' : createPostLinkPreviewsContainer(linkPreviews, post.id);

    // Enhanced attachments display
    let attachmentsHtml = '';
    if (totalAttachments > 0) {
        attachmentsHtml = '<div class="border-t pt-3 mt-4">';

        // Combine all attachments for a unified display
        const allAttachments = [...images, ...otherFiles];
        const imageData = images.map(img => ({url: '/uploads/' + img.file_path, filename: img.filename}));

        attachmentsHtml += `
            <div>
                <div class="flex items-center justify-between mb-2">
                    <h4 class="text-sm font-medium text-gray-700">Attachments</h4>
                    <div class="flex items-center space-x-2">
                        <button type="button" class="post-attachment-prev p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30" disabled onclick="scrollAttachments(this, -1)">
                            <i class="fas fa-chevron-left text-xs"></i>
                        </button>
                        <span class="post-attachment-counter text-xs text-gray-500">${totalAttachments} / ${totalAttachments}</span>
                        <button type="button" class="post-attachment-next p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30" disabled onclick="scrollAttachments(this, 1)">
                            <i class="fas fa-chevron-right text-xs"></i>
                        </button>
                    </div>
                </div>
                <div class="relative overflow-hidden">
                    <div class="flex items-center space-x-3 overflow-x-auto pb-2 scroll-smooth" data-attachment-container>
                        ${allAttachments.map((attachment, idx) => {
                            const isImage = attachment.file_type.startsWith('image/');
                            const fileExtension = attachment.filename.split('.').pop().toLowerCase();
                            const fileSizeText = attachment.file_size ? formatFileSize(attachment.file_size) : '';
                            const tooltipText = `${attachment.filename}${fileSizeText ? ' • ' + fileSizeText : ''}`;

                            if (isImage) {
                                const imageIndex = images.findIndex(img => img.filename === attachment.filename);
                                return `
                                    <div class="relative flex-shrink-0 w-20 h-20 group cursor-pointer" onclick="openImageGallery(${imageIndex})" data-images='${JSON.stringify(imageData)}' title="${tooltipText}">
                                        <img src="/uploads/${attachment.file_path}"
                                             alt="${attachment.filename}"
                                             class="w-full h-full object-cover rounded-lg border hover:opacity-90 transition-opacity">
                                        <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1 rounded-b-lg opacity-0 hover:opacity-100 transition-opacity">
                                            <p class="text-white text-xs truncate leading-tight">${attachment.filename}</p>
                                            ${fileSizeText ? `<p class="text-white/80 text-xs">${fileSizeText}</p>` : ''}
                                        </div>
                                    </div>
                                `;
                            } else {
                                return `
                                    <div class="relative flex-shrink-0 w-20 h-20 group cursor-pointer" onclick="window.open('/uploads/${attachment.file_path}', '_blank')" title="${tooltipText}">
                                        <div class="w-full h-full bg-gray-100 border rounded-lg flex flex-col items-center justify-center hover:bg-gray-200 transition-colors">
                                            <i class="fas ${getFileIcon(fileExtension)} text-2xl text-gray-600 mb-1"></i>
                                            <span class="text-xs text-gray-500 font-medium">${fileExtension.toUpperCase()}</span>
                                        </div>
                                        <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1 rounded-b-lg opacity-0 hover:opacity-100 transition-opacity">
                                            <p class="text-white text-xs truncate leading-tight">${attachment.filename}</p>
                                            ${fileSizeText ? `<p class="text-white/80 text-xs">${fileSizeText}</p>` : ''}
                                        </div>
                                    </div>
                                `;
                            }
                        }).join('')}
                    </div>
                </div>
            </div>
        `;

        attachmentsHtml += '</div>';
    }

    div.innerHTML = headerHtml + contentHtml + linkPreviewsHtml + attachmentsHtml;

    // Setup navigation buttons for attachments
    if (totalAttachments > 0) {
        setTimeout(() => setupAttachmentNavigation(div), 0);
    }

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

// Make function globally accessible for onclick handlers
window.togglePostActionMenu = togglePostActionMenu;

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

// Make function globally accessible for onclick handlers
window.showMoveModal = showMoveModal;

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
        showError(window.AppConstants.USER_MESSAGES.error.selectCategoryToMove);
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

        showSuccess(`${window.AppConstants.USER_MESSAGES.success.postMoved} ${newCategoryName}`);

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
            await updateCategoryStatsDisplay();
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
            // Use the post's actual category_id, not currentCategory.id (which could be 0 for "All Categories")
            if (post && post.category_id) {
                incrementCategoryPostCount(post.category_id, -1);
            }

            // Update the display
            await updateCategoryStatsDisplay();

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
            console.error(error)
            showError(formatMessage(window.AppConstants.USER_MESSAGES.error.failedToDeletePost, error.message));
        }
    }
}

// Make function globally accessible for onclick handlers
window.confirmDeletePost = confirmDeletePost;

async function updateCategoryStatsDisplay(stats) {
    if (!currentCategory) return;

    // Handle "All Categories" view separately
    if (currentCategory.id === window.AppConstants.ALL_CATEGORIES_ID) {
        await updateAllCategoriesDisplay();
        return;
    }

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

    // If file stats are enabled but no stats provided, fetch them
    if (fileStatsEnabled && !stats) {
        try {
            stats = await fetchCategoryStats(currentCategory.id, currentCategory.recursiveMode);
        } catch (error) {
            console.error('Failed to fetch category stats for display:', error);
            stats = { file_count: 0, total_size: 0 };
        }
    }

    // Only show files and size if file stats are enabled and there are files
    if (fileStatsEnabled && stats && stats.file_count > 0) {
        statsText += ` • ${stats.file_count} file${stats.file_count !== 1 ? 's' : ''} • ${formatFileSize(stats.total_size)}`;
    }

    // Get the interactive breadcrumb path for the current category
    const categoryBreadcrumb = getInteractiveCategoryBreadcrumb(currentCategory.id);

    // Format the creation date
    const creationDate = currentCategory.created ?
        new Date(currentCategory.created).toLocaleDateString(window.AppConstants.LOCALE_SETTINGS.default, {
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
                <div class="absolute left-0 top-full mt-1 px-3 py-2 bg-gray-900 text-white text-sm rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 max-w-md">
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

// Make function globally accessible for onclick handlers
window.navigateToCategoryFromPost = navigateToCategoryFromPost;

// Function to update display for "All categories" view
async function updateAllCategoriesDisplay() {
    // Calculate total post count by summing top-level categories' recursive post counts
    // This avoids double counting when there are parent-child relationships
    const totalPostCount = categories.reduce((total, category) => {
        // Only count top-level categories (no parent_id) using their recursive count
        // which includes all their descendants
        if (!category.parent_id) {
            return total + (category.recursive_post_count || category.post_count || 0);
        }
        return total;
    }, 0);

    // Get file stats from the API (still needed for file count and size)
    const fileStats = await fetchCategoryStats(0, false);

    // Find the first category created (oldest)
    const oldestCategory = categories.reduce((oldest, current) => {
        return (!oldest || current.created < oldest.created) ? current : oldest;
    }, null);

    const creationDate = oldestCategory ?
        new Date(oldestCategory.created).toLocaleDateString(window.AppConstants.LOCALE_SETTINGS.default, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) :
        'Date unavailable';

    let statsText = `${totalPostCount} post${totalPostCount !== 1 ? 's' : ''}`;

    // Only show files and size if file stats are enabled and there are files
    if (fileStatsEnabled && fileStats.file_count > 0) {
        statsText += ` • ${fileStats.file_count} file${fileStats.file_count !== 1 ? 's' : ''} • ${formatFileSize(fileStats.total_size)}`;
    }

    document.getElementById('timeline-title').innerHTML = `
        <div class="group">
            <h2 class="text-xl font-bold text-gray-900">${window.AppConstants.UI_TEXT.allCategories}</h2>
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

    // Update all parent categories' recursive counts by walking up the tree
    let currentCat = category;
    const affectedCategoryIds = [categoryId]; // Track all affected category IDs

    while (currentCat && currentCat.parent_id) {
        const parent = categories.find(cat => cat.id === currentCat.parent_id);
        if (parent) {
            parent.recursive_post_count = (parent.recursive_post_count || 0) + delta;
            affectedCategoryIds.push(parent.id);
            currentCat = parent;
        } else {
            break;
        }
    }

    // Update currentCategory if it's affected (either the category itself or an ancestor)
    if (currentCategory && affectedCategoryIds.includes(currentCategory.id)) {
        if (currentCategory.id === categoryId) {
            // Direct match - update both counts
            currentCategory.post_count = (currentCategory.post_count || 0) + delta;
            currentCategory.recursive_post_count = (currentCategory.recursive_post_count || 0) + delta;
        } else {
            // Parent category - only update recursive count
            currentCategory.recursive_post_count = (currentCategory.recursive_post_count || 0) + delta;
        }
    }

    // Re-render categories to show updated counts
    renderCategories();
}

// Attachment navigation functions
function setupAttachmentNavigation(postElement) {
    const container = postElement.querySelector('[data-attachment-container]');
    const leftBtn = postElement.querySelector('.post-attachment-prev');
    const rightBtn = postElement.querySelector('.post-attachment-next');

    if (!container || !leftBtn || !rightBtn) return;

    function updateButtonVisibility() {
        const canScrollLeft = container.scrollLeft > 0;
        const canScrollRight = container.scrollLeft < (container.scrollWidth - container.clientWidth);

        leftBtn.disabled = !canScrollLeft;
        rightBtn.disabled = !canScrollRight;
    }

    container.addEventListener('scroll', updateButtonVisibility);
    updateButtonVisibility();
}

function scrollAttachments(button, direction) {
    // Find the container by traversing up to find the attachment section
    const attachmentSection = button.closest('div').parentNode.querySelector('[data-attachment-container]');
    if (!attachmentSection) return;

    const scrollAmount = 200; // pixels to scroll
    attachmentSection.scrollBy({
        left: direction * scrollAmount,
        behavior: 'smooth'
    });
}

// Make function globally accessible for onclick handlers
window.scrollAttachments = scrollAttachments;