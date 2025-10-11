// Post management functions
let currentPosts = [];
let currentOffset = 0;
let hasMorePosts = true;
let isLoadingPosts = false;
let virtualScroller = null;
const VIRTUAL_SCROLL_THRESHOLD = window.AppConstants.UI_CONFIG.virtualScrollThreshold;

async function loadPosts(spaceId, recursive = false, reset = true) {
    if (isLoadingPosts) return;

    try {
        isLoadingPosts = true;

        if (reset) {
            currentPosts = [];
            currentOffset = 0;
            hasMorePosts = true;
        }

        const response = await fetchPosts(spaceId, window.AppConstants.UI_CONFIG.defaultPostsPerPage, currentOffset, false, recursive);
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
            setupInfiniteScroll(spaceId, recursive);
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

async function loadMorePosts(spaceId, recursive = false) {
    if (!hasMorePosts || isLoadingPosts) return;

    await loadPosts(spaceId, recursive, false);
}


function setupInfiniteScroll(spaceId, recursive = false) {
    const container = document.getElementById('posts-container');

    // Remove existing scroll listener
    window.removeEventListener('scroll', window.infiniteScrollHandler);

    // Add new scroll listener
    window.infiniteScrollHandler = () => {
        if (!hasMorePosts || isLoadingPosts) return;

        const scrollPosition = window.innerHeight + window.scrollY;
        const threshold = document.documentElement.offsetHeight - window.AppConstants.UI_CONFIG.infiniteScrollThreshold;

        if (scrollPosition >= threshold) {
            loadMorePosts(spaceId, recursive);
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
                <div class="text-center text-gray-500 dark:text-gray-400 py-8">
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
            <div class="text-gray-500 dark:text-gray-400">
                <i class="fas fa-spinner fa-spin mr-2"></i>
                ${window.AppConstants.USER_MESSAGES.info.loadingMorePosts}
            </div>
        `;
        container.appendChild(loadingDiv);
    }
}

function createPostElement(post) {
    const div = document.createElement('div');
    const hasAttachments = post.attachments && post.attachments.length > 0;
    const hasLinkPreviews = post.link_previews && post.link_previews.length > 0;
    const isTextOnly = !hasAttachments && !hasLinkPreviews;

    // Use less padding for text-only posts
    const paddingClass = 'p-4'
    div.className = `bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${paddingClass} hover:shadow-md transition-shadow group max-w-full`;
    div.setAttribute('data-post-id', post.id);

    const images = post.attachments ? post.attachments.filter(att => att.file_type.startsWith('image/')) : [];
    const otherFiles = post.attachments ? post.attachments.filter(att => !att.file_type.startsWith('image/')) : [];
    const totalAttachments = images.length + otherFiles.length;
    const linkPreviews = post.link_previews || [];

    // Check if we should show space breadcrumb
    // Show breadcrumb in two cases:
    // 1. When in recursive mode and post is from a different space
    // 2. When no space is selected (All spaces view)
    const showSpaceBreadcrumb =
        (!currentSpace || currentSpace.id === window.AppConstants.ALL_SPACES_ID) || // All spaces view
        (currentSpace && currentSpace.recursiveMode && post.space_id !== currentSpace.id); // Recursive mode
    const spaceBreadcrumb = showSpaceBreadcrumb ? getSpaceBreadcrumb(post.space_id) : '';

    // Make space breadcrumb clickable if we're showing it
    const clickableSpaceBreadcrumb = showSpaceBreadcrumb ?
        `<span class="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors" onclick="navigateToSpaceFromPost(${post.space_id})">${spaceBreadcrumb}</span>` :
        '';

    // Redesigned header
    const headerMargin = isTextOnly ? 'mb-3' : 'mb-4';
    const headerHtml = `
        <div class="flex items-center justify-between ${headerMargin}">
            <div class="flex items-center space-x-2">
                ${clickableSpaceBreadcrumb}
                <span class="relative group/time text-sm text-gray-600 dark:text-gray-400 font-sans cursor-default">
                    ${formatRelativeDate(post.created)}
                    <div class="absolute left-0 top-full mt-1 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md shadow-lg opacity-0 group-hover/time:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                        ${formatFullDateTime(post.created)}
                    </div>
                </span>
            </div>
            <div class="relative opacity-0 group-hover:opacity-100 transition-all">
                <button onclick="togglePostActionMenu(${post.id})" class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded transition-all">
                    <i class="fas fa-ellipsis-h text-sm"></i>
                </button>
                <div id="post-action-menu-${post.id}" class="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 hidden">
                    <div class="py-1">
                        <button onclick="showMoveModal(${post.id})" class="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                            <i class="fas fa-exchange-alt text-xs mr-2"></i>
                            Move
                        </button>
                        <button onclick="confirmDeletePost(${post.id})" class="flex items-center w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
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
    // Use less margin for text-only posts
    const contentMargin = isTextOnly ? 'mb-0' : 'mb-4';
    contentDiv.className = `${contentMargin} post-content font-content text-gray-900 dark:text-gray-100`;

    // Hide content if it's link-only and we have a link preview
    if (shouldHideContent) {
        contentDiv.style.display = 'none';
    }

    // Check if markdown CSS is loaded (indicates markdown is enabled)
    const markdownCSS = document.getElementById('markdown-css');
    const isMarkdownEnabled = markdownCSS !== null;

    // If markdown is disabled, convert URLs to clickable links and don't use markdown-body class
    let processedContent = post.content;
    if (!isMarkdownEnabled) {
        processedContent = formatTextWithUrls(post.content);
        contentDiv.innerHTML = processedContent;
    } else {
        contentDiv.classList.add('markdown-body');
        contentDiv.innerHTML = processedContent;
    }

    // Priority logic: Show attachments if available, otherwise show link previews
    // If there are attachments, do NOT show link previews
    const linkPreviewsHtml = totalAttachments > 0 ? '' : createPostLinkPreviewsContainer(linkPreviews, post.id);

    // Enhanced attachments display
    let attachmentsHtml = '';
    if (totalAttachments > 0) {
        attachmentsHtml = '<div class="border-t border-gray-200 dark:border-gray-700 pt-3 mt-4">';

        // Combine all attachments for a unified display
        const allAttachments = [...images, ...otherFiles];
        const imageData = images.map(img => ({url: '/uploads/' + img.file_path, filename: img.filename}));

        attachmentsHtml += `
            <div>
                <div class="flex items-center justify-between mb-2">
                    <h4 class="text-sm font-medium text-gray-500 dark:text-gray-500">Attachments</h4>
                    <div class="flex items-center space-x-2">
                        <button type="button" class="post-attachment-prev p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30" disabled onclick="scrollAttachments(this, -1)">
                            <i class="fas fa-chevron-left text-xs"></i>
                        </button>
                        <span class="post-attachment-counter text-xs text-gray-500 dark:text-gray-400">1 / ${totalAttachments}</span>
                        <button type="button" class="post-attachment-next p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30" onclick="scrollAttachments(this, 1)">
                            <i class="fas fa-chevron-right text-xs"></i>
                        </button>
                    </div>
                </div>
                <div class="relative overflow-hidden">
                    <div class="flex items-center space-x-3 transition-transform duration-300 ease-in-out" data-attachment-container>
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
                                        <div class="w-full h-full bg-gray-100 dark:bg-gray-800 border dark:border-gray-700 rounded-lg flex flex-col items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                                            <i class="fas ${getFileIcon(fileExtension)} text-2xl text-gray-600 dark:text-gray-400 mb-1"></i>
                                            <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">${fileExtension.toUpperCase()}</span>
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

    // Build the post structure by inserting header HTML, then appending the content element
    div.innerHTML = headerHtml + linkPreviewsHtml + attachmentsHtml;

    // Insert contentDiv as the second child (after header, before linkPreviews/attachments)
    const headerElement = div.firstElementChild;
    if (headerElement) {
        headerElement.after(contentDiv);
    } else {
        div.insertBefore(contentDiv, div.firstChild);
    }

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

    // Find the post to get current space info
    const post = currentPosts.find(p => p.id === postId);
    if (!post) return;

    // Get current space name
    const currentSpace = spaces.find(cat => cat.id === post.space_id);
    const currentSpaceBreadcrumb = currentSpace ? getSpaceBreadcrumb(post.space_id) : 'Unknown Space';

    // Update current space display
    document.getElementById('current-space-display').textContent = currentSpaceBreadcrumb;

    // Populate space dropdown
    populateMoveSpaceDropdown(post.space_id);

    // Show modal
    document.getElementById('move-modal').classList.remove('hidden');

    // Close any open post action menus
    document.querySelectorAll('[id^="post-action-menu-"]').forEach(menu => {
        menu.classList.add('hidden');
    });
}

// Make function globally accessible for onclick handlers
window.showMoveModal = showMoveModal;

function populateMoveSpaceDropdown(currentSpaceId) {
    const select = document.getElementById('move-space');
    select.innerHTML = '<option value="">Select a space...</option>';

    // Add all spaces except the current one
    spaces.forEach(space => {
        if (space.id !== currentSpaceId) {
            const breadcrumb = getSpaceBreadcrumb(space.id);
            const option = document.createElement('option');
            option.value = space.id;
            option.textContent = breadcrumb;
            select.appendChild(option);
        }
    });
}

function hideMoveModal() {
    document.getElementById('move-modal').classList.add('hidden');
    document.getElementById('move-space').value = '';
    currentMovePostId = null;
}

// Event listeners for move modal
document.getElementById('cancel-move').addEventListener('click', hideMoveModal);

document.getElementById('move-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    if (!currentMovePostId) return;

    const newSpaceId = parseInt(document.getElementById('move-space').value);
    if (!newSpaceId) {
        showError(window.AppConstants.USER_MESSAGES.error.selectSpaceToMove);
        return;
    }

    try {
        // Get the old space ID before moving
        const post = currentPosts.find(p => p.id === currentMovePostId);
        const oldSpaceId = post ? post.space_id : null;

        await movePost(currentMovePostId, newSpaceId);

        // Update post counts locally
        if (oldSpaceId) {
            incrementSpacePostCount(oldSpaceId, -1); // Remove from old space
        }
        incrementSpacePostCount(newSpaceId, 1); // Add to new space

        // Find the new space name for success message
        const newSpace = spaces.find(cat => cat.id === newSpaceId);
        const newSpaceName = newSpace ? newSpace.name : 'selected space';

        showSuccess(`${window.AppConstants.USER_MESSAGES.success.postMoved} ${newSpaceName}`);

        // Remove the post from current view if it no longer belongs here
        let shouldRemoveFromView = false;

        if (currentSpace && currentSpace.id !== window.AppConstants.ALL_SPACES_ID) {
            if (currentSpace.recursiveMode) {
                // In recursive mode, check if the new space is still part of this space tree
                const newSpaceObj = spaces.find(cat => cat.id === newSpaceId);
                if (newSpaceObj) {
                    // Check if new space is this space or a descendant
                    const isDescendant = isDescendantSpace(newSpaceId, currentSpace.id);
                    shouldRemoveFromView = !(newSpaceId === currentSpace.id || isDescendant);
                } else {
                    shouldRemoveFromView = true;
                }
            } else {
                // In non-recursive mode, only show posts directly in this space
                shouldRemoveFromView = newSpaceId !== currentSpace.id;
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
            // Update the post's space_id in the array (for All spaces view or recursive mode)
            const postIndex = currentPosts.findIndex(p => p.id === currentMovePostId);
            if (postIndex !== -1) {
                currentPosts[postIndex].space_id = newSpaceId;
            }
        }

        // Refresh the display
        renderPosts(currentPosts, true);

        // Update the display with the updated counts
        if (currentSpace) {
            updateSpaceStatsDisplay();
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
        detailsHtml += '<div class="mb-4"><h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Files to be deleted:</h4>';
        detailsHtml += '<div class="bg-gray-50 dark:bg-gray-800 rounded p-3 max-h-32 overflow-y-auto"><ul class="text-sm text-gray-600 dark:text-gray-400 space-y-1">';

        attachments.forEach(file => {
            detailsHtml += `<li class="flex justify-between items-center">
                <span>• ${file.filename}</span>
                <span class="text-xs text-gray-400 dark:text-gray-500">${formatFileSize(file.file_size)}</span>
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
            // Use the post's actual space_id, not currentSpace.id (which could be 0 for "All Spaces")
            if (post && post.space_id) {
                incrementSpacePostCount(post.space_id, -1);
            }

            // Update the display
            updateSpaceStatsDisplay();

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

function updateSpaceStatsDisplay(stats) {
    if (!currentSpace) return;

    // Handle "All Spaces" view separately
    if (currentSpace.id === window.AppConstants.ALL_SPACES_ID) {
        updateAllSpacesDisplay();
        return;
    }

    // Ensure currentSpace has all properties by finding it in spaces array
    const fullSpace = spaces.find(cat => cat.id === currentSpace.id);
    if (fullSpace) {
        // Preserve recursiveMode if it was set
        const recursiveMode = currentSpace.recursiveMode;
        currentSpace = { ...fullSpace };
        currentSpace.recursiveMode = recursiveMode;
    }

    // Use post count from space object, not from stats
    const postCount = currentSpace.recursiveMode ?
        (currentSpace.recursive_post_count || 0) :
        (currentSpace.post_count || 0);

    let statsText = `${postCount} post${postCount !== 1 ? 's' : ''}`;

    // Only show files and size if file stats are enabled and stats are provided
    if (fileStatsEnabled && stats && stats.file_count > 0) {
        statsText += ` • ${stats.file_count} file${stats.file_count !== 1 ? 's' : ''} • ${formatFileSize(stats.total_size)}`;
    }

    // Get the interactive breadcrumb path for the current space
    const spaceBreadcrumb = getInteractiveSpaceBreadcrumb(currentSpace.id);

    // Format the creation date
    const creationDate = currentSpace.created ?
        new Date(currentSpace.created).toLocaleDateString(window.AppConstants.LOCALE_SETTINGS.default, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) :
        'Date unavailable';

    // Create tooltip content - show description if it exists
    const tooltipContent = currentSpace.description && currentSpace.description.trim()
        ? currentSpace.description
        : `Created ${creationDate}`;

    // Update mobile header (timeline-title)
    const mobileTitle = document.getElementById('timeline-title');
    if (mobileTitle) {
        mobileTitle.innerHTML = `
            <div class="group relative">
                <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">${spaceBreadcrumb}</h2>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 relative">
                    <span class="transition-opacity group-hover:opacity-0">${statsText}</span>
                    <span class="absolute top-0 left-0 opacity-0 group-hover:opacity-100 transition-opacity">${creationDate}</span>
                </p>
                ${currentSpace.description && currentSpace.description.trim() ? `
                    <div class="absolute left-0 top-full mt-1 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 max-w-md">
                        ${currentSpace.description.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Update desktop companion panel
    updateDesktopCompanionPanel(stats, spaceBreadcrumb, statsText, creationDate);

    // Update button visibility and states
    updateHeaderButtons();
}

// Helper function to count all descendant spaces recursively
function countDescendantSpaces(parentId) {
    let count = 0;
    const directChildren = spaces.filter(cat => cat.parent_id === parentId);

    for (const child of directChildren) {
        count++; // Count this child
        count += countDescendantSpaces(child.id); // Count its descendants
    }

    return count;
}

// Function to update desktop companion panel
function updateDesktopCompanionPanel(stats, spaceBreadcrumb, statsText, creationDate) {
    const desktopSpaceHeader = document.getElementById('desktop-space-header');
    const desktopTitleContent = document.getElementById('desktop-title-content');
    const desktopSpaceDescription = document.getElementById('desktop-space-description');
    const desktopSpaceActionsIcon = document.getElementById('desktop-space-actions-icon');
    const desktopActionsCard = document.getElementById('desktop-actions-card');
    const recursiveToggleBtnDesktop = document.getElementById('recursive-toggle-btn-desktop');

    // Handle "All Spaces" view
    if (!currentSpace || currentSpace.id === window.AppConstants.ALL_SPACES_ID) {
        // Show header with "All Spaces"
        if (desktopSpaceHeader) desktopSpaceHeader.style.display = 'block';

        if (desktopTitleContent) {
            desktopTitleContent.innerHTML = `
                <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">${spaceBreadcrumb || window.AppConstants.UI_TEXT.allSpaces}</h2>
                <div class="group/stats relative">
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                        <span class="transition-opacity group-hover/stats:opacity-0">${statsText || ''}</span>
                        <span class="absolute top-0 left-0 opacity-0 group-hover/stats:opacity-100 transition-opacity">${creationDate || ''}</span>
                    </p>
                </div>
            `;
        }

        // Hide space-specific elements
        if (desktopSpaceDescription) {
            desktopSpaceDescription.className = 'hidden';
            desktopSpaceDescription.innerHTML = '';
        }
        if (desktopSpaceActionsIcon) desktopSpaceActionsIcon.style.display = 'none';
        if (desktopActionsCard) desktopActionsCard.style.display = 'none';
        if (recursiveToggleBtnDesktop) recursiveToggleBtnDesktop.style.display = 'none';
        return;
    }

    // Show space header
    if (desktopSpaceHeader) desktopSpaceHeader.style.display = 'block';

    // Add recursive badge if in recursive mode
    let breadcrumbWithBadge = spaceBreadcrumb;
    if (currentSpace.recursiveMode) {
        const descendantCount = countDescendantSpaces(currentSpace.id);
        if (descendantCount > 0) {
            const displayCount = descendantCount > 99 ? '99+' : descendantCount;
            const subspacesText = descendantCount === 1 ? 'subspace' : 'subspaces';
            const tooltip = `Exploring ${currentSpace.name} and ${descendantCount} of its ${subspacesText}`;
            breadcrumbWithBadge += ` <span class="text-gray-400 dark:text-gray-500">/</span><span class="recursive-badge" data-tooltip="${tooltip}">${displayCount}</span>`;
        }
    }

    // Populate space title with breadcrumb and stats (with hover effect)
    if (desktopTitleContent) {
        desktopTitleContent.innerHTML = `
            <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">${breadcrumbWithBadge}</h2>
            <div class="group/stats relative">
                <p class="text-xs text-gray-500 dark:text-gray-400">
                    <span class="transition-opacity group-hover/stats:opacity-0">${statsText}</span>
                    <span class="absolute top-0 left-0 opacity-0 group-hover/stats:opacity-100 transition-opacity">${creationDate}</span>
                </p>
            </div>
        `;
    }

    // Show description below separator if it exists
    if (desktopSpaceDescription && currentSpace.description && currentSpace.description.trim()) {
        desktopSpaceDescription.className = 'pt-3 mt-3 border-t border-gray-200 dark:border-gray-700';
        desktopSpaceDescription.innerHTML = `
            <p class="text-xs text-gray-600 dark:text-gray-400 italic">
                "${currentSpace.description.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}"
            </p>
        `;
    } else if (desktopSpaceDescription) {
        desktopSpaceDescription.className = 'hidden';
        desktopSpaceDescription.innerHTML = '';
    }

    // Show space actions menu icon
    if (desktopSpaceActionsIcon) desktopSpaceActionsIcon.style.display = 'block';

    // Show actions card
    if (desktopActionsCard) desktopActionsCard.style.display = 'block';

    // Handle recursive toggle button
    const hasSubspaces = spaces.some(cat => cat.parent_id === currentSpace.id);
    if (recursiveToggleBtnDesktop) {
        if (hasSubspaces) {
            recursiveToggleBtnDesktop.style.display = 'flex';

            // Update button styling based on recursive mode
            if (currentSpace.recursiveMode) {
                recursiveToggleBtnDesktop.className = 'flex items-center justify-center w-9 h-9 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors';
                recursiveToggleBtnDesktop.title = 'Viewing with subspaces (click to toggle)';
            } else {
                recursiveToggleBtnDesktop.className = 'flex items-center justify-center w-9 h-9 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors';
                recursiveToggleBtnDesktop.title = 'Viewing this space only (click to toggle)';
            }
        } else {
            recursiveToggleBtnDesktop.style.display = 'none';
        }
    }
}

// Function to update header button visibility and states
function updateHeaderButtons() {
    if (!currentSpace) {
        document.getElementById('recursive-toggle-btn').style.display = 'none';
        document.getElementById('space-actions-dropdown').style.display = 'none';
        document.getElementById('settings-btn-mobile').style.display = 'block';
        document.getElementById('theme-toggle-btn-mobile').style.display = 'block';

        document.getElementById('new-post-btn-mobile').style.display = 'none';
        return;
    }

    // Check if current space has subspaces to show recursive toggle
    const hasSubspaces = spaces.some(cat => cat.parent_id === currentSpace.id);
    const recursiveToggleBtn = document.getElementById('recursive-toggle-btn');

    if (hasSubspaces) {
        recursiveToggleBtn.style.display = 'block';
        // Update button styling based on state
        if (currentSpace.recursiveMode) {
            recursiveToggleBtn.className = 'flex items-center justify-center h-8 px-3 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors';
        } else {
            recursiveToggleBtn.className = 'flex items-center justify-center h-8 px-3 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400 focus:border-gray-500 transition-colors';
        }
    } else {
        recursiveToggleBtn.style.display = 'none';
    }

    // Show dropdown and hide settings when a space is selected (mobile only)
    document.getElementById('space-actions-dropdown').style.display = 'block';
    document.getElementById('settings-btn-mobile').style.display = 'none';
    document.getElementById('theme-toggle-btn-mobile').style.display = 'none';

    // Show new post button on mobile
    const newPostBtnMobile = document.getElementById('new-post-btn-mobile');
    if (newPostBtnMobile) {
        newPostBtnMobile.style.display = 'block';
    }
}

// Function to navigate to a space when clicked from a post
function navigateToSpaceFromPost(spaceId) {
    const space = spaces.find(cat => cat.id === spaceId);
    if (space) {
        selectSpace(space); // Programmatic selection from post navigation
    }
}

// Make function globally accessible for onclick handlers
window.navigateToSpaceFromPost = navigateToSpaceFromPost;

// Function to update display for "All spaces" view
function updateAllSpacesDisplay(fileStats) {
    // Calculate total post count by summing top-level spaces' recursive post counts
    // This avoids double counting when there are parent-child relationships
    const totalPostCount = spaces.reduce((total, space) => {
        // Only count top-level spaces (no parent_id) using their recursive count
        // which includes all their descendants
        if (!space.parent_id) {
            return total + (space.recursive_post_count || space.post_count || 0);
        }
        return total;
    }, 0);

    // Find the first space created (oldest)
    const oldestSpace = spaces.reduce((oldest, current) => {
        return (!oldest || current.created < oldest.created) ? current : oldest;
    }, null);

    const creationDate = oldestSpace ?
        new Date(oldestSpace.created).toLocaleDateString(window.AppConstants.LOCALE_SETTINGS.default, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) :
        'Date unavailable';

    let statsText = `${totalPostCount} post${totalPostCount !== 1 ? 's' : ''}`;

    // Only show files and size if file stats are enabled and provided
    if (fileStatsEnabled && fileStats && fileStats.file_count > 0) {
        statsText += ` • ${fileStats.file_count} file${fileStats.file_count !== 1 ? 's' : ''} • ${formatFileSize(fileStats.total_size)}`;
    }

    // Update mobile header
    const mobileTitle = document.getElementById('timeline-title');
    if (mobileTitle) {
        mobileTitle.innerHTML = `
            <div class="group">
                <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">${window.AppConstants.UI_TEXT.allSpaces}</h2>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 relative">
                    <span class="transition-opacity group-hover:opacity-0">${statsText}</span>
                    <span class="absolute top-0 left-0 opacity-0 group-hover:opacity-100 transition-opacity">${creationDate}</span>
                </p>
            </div>
        `;
    }

    // Update desktop companion panel - hide space-specific elements
    updateDesktopCompanionPanel(null, window.AppConstants.UI_TEXT.allSpaces, statsText, creationDate);

    // Update button visibility - hide space-specific buttons
    document.getElementById('recursive-toggle-btn').style.display = 'none';
    document.getElementById('space-actions-dropdown').style.display = 'none';
    document.getElementById('settings-btn-mobile').style.display = 'block';
    document.getElementById('theme-toggle-btn-mobile').style.display = 'block';

    const newPostBtnMobile = document.getElementById('new-post-btn-mobile');
    if (newPostBtnMobile) {
        newPostBtnMobile.style.display = 'none';
    }
}

// Helper function to check if spaceId is a descendant of parentId
function isDescendantSpace(spaceId, parentId) {
    const space = spaces.find(cat => cat.id === spaceId);
    if (!space || !space.parent_id) {
        return false;
    }

    if (space.parent_id === parentId) {
        return true;
    }

    return isDescendantSpace(space.parent_id, parentId);
}

// Helper function to increment/decrement space post counts locally
function incrementSpacePostCount(spaceId, delta) {
    // Update the specific space
    const space = spaces.find(cat => cat.id === spaceId);
    if (space) {
        space.post_count = (space.post_count || 0) + delta;
        space.recursive_post_count = (space.recursive_post_count || 0) + delta;
    }

    // Update all parent spaces' recursive counts by walking up the tree
    let currentCat = space;
    const affectedSpaceIds = [spaceId]; // Track all affected space IDs

    while (currentCat && currentCat.parent_id) {
        const parent = spaces.find(cat => cat.id === currentCat.parent_id);
        if (parent) {
            parent.recursive_post_count = (parent.recursive_post_count || 0) + delta;
            affectedSpaceIds.push(parent.id);
            currentCat = parent;
        } else {
            break;
        }
    }

    // Update currentSpace if it's affected (either the space itself or an ancestor)
    if (currentSpace && affectedSpaceIds.includes(currentSpace.id)) {
        if (currentSpace.id === spaceId) {
            // Direct match - update both counts
            currentSpace.post_count = (currentSpace.post_count || 0) + delta;
            currentSpace.recursive_post_count = (currentSpace.recursive_post_count || 0) + delta;
        } else {
            // Parent space - only update recursive count
            currentSpace.recursive_post_count = (currentSpace.recursive_post_count || 0) + delta;
        }
    }

    // Re-render spaces to show updated counts
    renderSpaces();
}

// Attachment navigation functions
function setupAttachmentNavigation(postElement) {
    const container = postElement.querySelector('[data-attachment-container]');
    const leftBtn = postElement.querySelector('.post-attachment-prev');
    const rightBtn = postElement.querySelector('.post-attachment-next');
    const counter = postElement.querySelector('.post-attachment-counter');

    if (!container || !leftBtn || !rightBtn || !counter) return;

    // Initialize current index
    container.dataset.currentIndex = '0';

    // Calculate initial state
    const children = Array.from(container.children);
    const containerParent = container.parentElement;
    const containerWidth = containerParent.offsetWidth;

    // Find how many items are initially visible
    let rightmostVisibleIndex = 0;
    let accumulatedWidth = 0;

    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const childWidth = child.offsetWidth;
        const gap = 12; // space-x-3 = 0.75rem = 12px

        if (i === 0 || accumulatedWidth + childWidth <= containerWidth) {
            rightmostVisibleIndex = i;
            accumulatedWidth += childWidth + (i < children.length - 1 ? gap : 0);
        } else {
            // Check if partially visible
            if (accumulatedWidth < containerWidth) {
                rightmostVisibleIndex = i;
            }
            break;
        }
    }

    // Update initial state
    leftBtn.disabled = true;
    rightBtn.disabled = rightmostVisibleIndex >= children.length - 1;
    counter.textContent = `${rightmostVisibleIndex + 1} / ${children.length}`;
}

function scrollAttachments(button, direction) {
    // Find the post element and then the container within it
    const postElement = button.closest('[data-post-id]');
    if (!postElement) {
        console.error('Could not find post element');
        return;
    }

    const attachmentSection = postElement.querySelector('[data-attachment-container]');
    if (!attachmentSection) {
        console.error('Could not find attachment container');
        return;
    }

    const children = Array.from(attachmentSection.children);
    if (children.length === 0) return;

    const containerParent = attachmentSection.parentElement;
    const containerWidth = containerParent.offsetWidth;

    // Get current index
    let currentIndex = parseInt(attachmentSection.dataset.currentIndex || '0', 10);

    // Calculate target index
    let targetIndex = currentIndex + direction;
    targetIndex = Math.max(0, targetIndex);

    // Don't allow going beyond the last item
    if (targetIndex >= children.length) return;

    // Calculate the translateX for the target (scroll one item at a time)
    const targetChild = children[targetIndex];
    if (!targetChild) return;

    let translateX = -targetChild.offsetLeft;

    // Check what would be visible with this normal translation
    const lastChild = children[children.length - 1];
    const lastChildRight = lastChild.offsetLeft + lastChild.offsetWidth;
    let visibleRightEdge = -translateX + containerWidth;

    // Calculate the rightmost item that would be visible
    let wouldShowRightmostIndex = targetIndex;
    for (let i = targetIndex; i < children.length; i++) {
        const child = children[i];
        const childRight = child.offsetLeft + child.offsetWidth;
        if (childRight <= visibleRightEdge + 1) {
            wouldShowRightmostIndex = i;
        }
    }

    // ONLY adjust if we would be showing the last item but it's cut off
    if (wouldShowRightmostIndex === children.length - 1 && lastChildRight > visibleRightEdge) {
        // Last item is partially visible, adjust ONLY the necessary amount to show it fully
        translateX = -(lastChildRight - containerWidth);
    }

    // Check if we're already at this position (prevent duplicate clicks)
    const currentTransformMatch = attachmentSection.style.transform.match(/translateX\((-?\d+(?:\.\d+)?)px\)/);
    const currentX = currentTransformMatch ? parseFloat(currentTransformMatch[1]) : 0;

    if (Math.abs(currentX - translateX) < 1) {
        return;
    }

    // Update the index and transform
    attachmentSection.dataset.currentIndex = targetIndex.toString();
    attachmentSection.style.transform = `translateX(${translateX}px)`;

    // Calculate which attachments are actually visible after transform
    let actualRightmostIndex = 0;
    const actualVisibleLeft = -translateX;
    const actualVisibleRight = actualVisibleLeft + containerWidth;

    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const childLeft = child.offsetLeft;
        const childRight = childLeft + child.offsetWidth;

        if (childRight > actualVisibleLeft && childLeft < actualVisibleRight) {
            actualRightmostIndex = i;
        }
    }

    // Update button states and counter
    const leftBtn = postElement.querySelector('.post-attachment-prev');
    const rightBtn = postElement.querySelector('.post-attachment-next');
    const counter = postElement.querySelector('.post-attachment-counter');

    if (leftBtn) leftBtn.disabled = targetIndex === 0;
    if (rightBtn) {
        const lastChildFullyVisible = lastChildRight <= actualVisibleRight + 1;
        rightBtn.disabled = lastChildFullyVisible;
    }
    if (counter) counter.textContent = `${actualRightmostIndex + 1} / ${children.length}`;
}

// Make function globally accessible for onclick handlers
window.scrollAttachments = scrollAttachments;