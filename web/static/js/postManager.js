// Post management functions
let currentPosts = [];
let currentOffset = 0;
let hasMorePosts = true;
let isLoadingPosts = false;
let virtualScroller = null;
const VIRTUAL_SCROLL_THRESHOLD = 50; // Use virtual scrolling when more than 50 posts

async function loadPosts(categoryId, reset = true) {
    if (isLoadingPosts) return;

    try {
        isLoadingPosts = true;

        if (reset) {
            currentPosts = [];
            currentOffset = 0;
            hasMorePosts = true;
        }

        const response = await fetchPosts(categoryId, 20, currentOffset, true);
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
            hasMorePosts = posts.length === 20;
        }

        currentOffset += posts.length;
        renderPosts(currentPosts, reset);

        // Setup infinite scroll if this is a fresh load
        if (reset) {
            setupInfiniteScroll(categoryId);
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

async function loadMorePosts(categoryId) {
    if (!hasMorePosts || isLoadingPosts) return;

    await loadPosts(categoryId, false);
}

function setupInfiniteScroll(categoryId) {
    const container = document.getElementById('posts-container');

    // Remove existing scroll listener
    window.removeEventListener('scroll', window.infiniteScrollHandler);

    // Add new scroll listener
    window.infiniteScrollHandler = () => {
        if (!hasMorePosts || isLoadingPosts) return;

        const scrollPosition = window.innerHeight + window.scrollY;
        const threshold = document.documentElement.offsetHeight - 1000; // Load more when 1000px from bottom

        if (scrollPosition >= threshold) {
            loadMorePosts(categoryId);
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
                    <p>No posts yet. Create your first post!</p>
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

    // Simple header
    const headerHtml = `
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-2">
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
            <button onclick="confirmDeletePost(${post.id})" class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1 rounded transition-all">
                <i class="fas fa-trash-alt text-sm"></i>
            </button>
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

async function confirmDeletePost(postId) {
    if (confirm('Are you sure you want to delete this post?\n\nThis will also delete all attached files.\n\nThis action cannot be undone.')) {
        try {
            await deletePost(postId);

            // Update stats and refresh display
            const stats = await fetchCategoryStats(currentCategory.id);
            updateCategoryStatsDisplay(stats);
            await fetchGlobalStats();

            // Remove the post from current posts array and re-render
            currentPosts = currentPosts.filter(post => post.id !== postId);

            if (virtualScroller) {
                virtualScroller.removeItem(postId);
            } else {
                renderPosts(currentPosts, true);
            }

        } catch (error) {
            showError('Failed to delete post: ' + error.message);
        }
    }
}

function updateCategoryStatsDisplay(stats) {
    let statsText = `${stats.post_count} post${stats.post_count !== 1 ? 's' : ''}`;

    // Only show files and size if there are files
    if (stats.file_count > 0) {
        statsText += ` • ${stats.file_count} file${stats.file_count !== 1 ? 's' : ''} • ${formatFileSize(stats.total_size)}`;
    }

    document.getElementById('timeline-title').innerHTML = `
        <h2 class="text-xl font-bold text-gray-900">${currentCategory.name}</h2>
        <p class="text-xs text-gray-500 mt-0.5">${statsText}</p>
    `;
}