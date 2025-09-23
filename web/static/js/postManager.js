// Post management functions
async function loadPosts(categoryId) {
    try {
        const posts = await fetchPosts(categoryId);
        renderPosts(posts);
    } catch (error) {
        console.error('Failed to fetch posts:', error);
        renderPosts([]);
    }
}

function renderPosts(posts) {
    const container = document.getElementById('posts-container');
    container.innerHTML = '';

    if (posts.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-inbox text-4xl mb-4"></i>
                <p>No posts yet. Create your first post!</p>
            </div>
        `;
        return;
    }

    posts.forEach(post => {
        const element = createPostElement(post);
        container.appendChild(element);
    });
}

function createPostElement(post) {
    const div = document.createElement('div');
    div.className = 'bg-white rounded-lg shadow-sm border p-6 mb-6 hover:shadow-md transition-shadow group max-w-full';

    const images = post.attachments ? post.attachments.filter(att => att.file_type.startsWith('image/')) : [];
    const otherFiles = post.attachments ? post.attachments.filter(att => !att.file_type.startsWith('image/')) : [];
    const totalAttachments = images.length + otherFiles.length;

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
            </div>
            <button onclick="confirmDeletePost(${post.id})" class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1 rounded transition-all">
                <i class="fas fa-trash-alt text-sm"></i>
            </button>
        </div>
    `;

    // Content
    const contentHtml = `
        <div class="mb-4">
            <p class="text-gray-900 leading-relaxed whitespace-pre-wrap">${escapeHtml(post.content)}</p>
        </div>
    `;

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

    div.innerHTML = headerHtml + contentHtml + attachmentsHtml;
    return div;
}

async function confirmDeletePost(postId) {
    if (confirm('Are you sure you want to delete this post?\n\nThis will also delete all attached files.\n\nThis action cannot be undone.')) {
        try {
            await deletePost(postId);
            loadPosts(currentCategory.id);
        } catch (error) {
            showError('Failed to delete post: ' + error.message);
        }
    }
}