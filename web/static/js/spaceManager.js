// Space management functions
function renderSpaces() {
    const container = document.getElementById('spaces-tree');
    container.innerHTML = '';

    const rootSpaces = spaces.filter(cat => !cat.parent_id);

    if (rootSpaces.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                <i class="fas fa-folder-plus text-4xl mb-4"></i>
                <p>${window.AppConstants.UI_TEXT.noSpacesYet}</p>
            </div>
        `;
        updateSortFooterVisibility();
        return;
    }

    // Sort root spaces
    const sortedRootSpaces = sortSpaces(rootSpaces);

    sortedRootSpaces.forEach(space => {
        const element = createSpaceElement(space);
        container.appendChild(element);
    });

    // Update sort footer visibility
    updateSortFooterVisibility();
}

function createSpaceElement(space, level = 0) {
    const div = document.createElement('div');
    div.className = 'space-item mb-1';

    const hasChildren = spaces.some(cat => cat.parent_id === space.id);
    const isExpanded = expandedSpaces.has(space.id);
    const shouldShowChildren = isExpanded;

    const mainDiv = document.createElement('div');
    mainDiv.className = 'flex items-center group';

    // Expand/collapse button with modern styling
    let expandButton = '';
    if (hasChildren) {
        expandButton = `
            <button class="expand-btn flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-all duration-200 mr-1" style="margin-left: ${level * 14}px;">
                <i class="fas fa-chevron-${isExpanded ? 'down' : 'right'} text-xs"></i>
            </button>
        `;
    } else {
        expandButton = `<div class="w-5 h-5 mr-1" style="margin-left: ${level * 14}px;"></div>`;
    }

    // Main space button with GitHub-style design
    const spaceButton = document.createElement('button');
    const isSelected = currentSpace?.id === space.id;
    spaceButton.className = `space-btn flex-1 text-left px-2 py-1.5 rounded-md transition-all duration-200 min-w-0 group-hover:bg-gray-50 dark:group-hover:bg-gray-700 ${
        isSelected
            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-l-2 border-blue-500 dark:border-blue-400 font-medium'
            : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
    }`;
    spaceButton.dataset.spaceId = space.id; // Add data attribute for easy identification

    spaceButton.innerHTML = `
        <div class="flex items-center min-w-0">
            <i class="fas fa-folder${isSelected ? '-open' : ''} mr-2 flex-shrink-0 text-xs ${isSelected ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}"></i>
            <span class="text-sm truncate" title="${space.name}">${space.name}</span>
        </div>
    `;

    mainDiv.innerHTML = expandButton;
    mainDiv.appendChild(spaceButton);

    div.appendChild(mainDiv);

    // Add event listeners after elements are created
    const expandBtn = mainDiv.querySelector('.expand-btn');
    if (expandBtn) {
        expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSpace(space.id);
        });
    }

    spaceButton.addEventListener('click', (e) => {
        e.stopPropagation();

        // Check if clicking on already selected space (deselection)
        if (currentSpace && currentSpace.id === space.id) {
            // Deselect by navigating to root
            if (typeof router !== 'undefined' && router.navigate) {
                router.navigate('/');
            } else {
                selectSpace(space, true); // fallback to original logic
            }
        } else {
            // Navigate using router to update URL
            if (typeof router !== 'undefined' && router.navigateToSpace) {
                router.navigateToSpace(space);
            } else {
                selectSpace(space, true); // fallback
            }
        }
    });

    // Add subspaces only if expanded
    if (hasChildren && shouldShowChildren) {
        const subspaces = spaces.filter(cat => cat.parent_id === space.id);
        const sortedSubspaces = sortSpaces(subspaces);
        sortedSubspaces.forEach(subcat => {
            const subElement = createSpaceElement(subcat, level + 1);
            div.appendChild(subElement);
        });
    }

    return div;
}

function toggleSpace(spaceId) {
    if (expandedSpaces.has(spaceId)) {
        expandedSpaces.delete(spaceId);
    } else {
        expandedSpaces.add(spaceId);
    }
    saveExpandedSpaces();
    renderSpaces();
}

function selectSpace(space, fromUserClick = false) {
    // If clicking on already selected space, deselect it (only for user clicks)
    if (fromUserClick && currentSpace && currentSpace.id === space.id) {
        deselectSpace();
        return;
    }

    // Immediately stop any ongoing posts loading and clear display
    isLoadingPosts = false;

    // Clear posts container immediately
    const postsContainer = document.getElementById('posts-container');
    if (postsContainer) {
        postsContainer.innerHTML = `
            <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                <i class="fas fa-spinner fa-spin text-4xl mb-4"></i>
                <p>Loading posts...</p>
            </div>
        `;
    }

    // Update space state
    currentSpace = space;
    currentSpace.recursiveMode = loadRecursiveToggleState(space.id);

    saveLastSpace(space.id);

    // Update UI
    document.getElementById('new-post-btn').style.display = 'block';
    document.getElementById('settings-btn').style.display = 'none';
    document.getElementById('theme-toggle-btn').style.display = 'none';
    document.getElementById('space-actions-dropdown').style.display = 'block';

    // Ensure all parent spaces are expanded
    expandSpacePath(space.id);
    renderSpaces();
    scrollToSpaceElement(space.id);

    // Update header immediately with space name and post count from cached state (no await, synchronous)
    updateSpaceStatsDisplay();

    // Load posts immediately (don't await, let it run in parallel)
    loadPosts(space.id, currentSpace.recursiveMode);

    // Reset activity period
    currentActivityPeriod = 0;
    window.scrollTo(0, 0);

    // Fetch file stats in parallel if needed and update display when ready
    if (fileStatsEnabled) {
        fetchSpaceStats(space.id, currentSpace.recursiveMode).then(stats => {
            updateSpaceStatsDisplay(stats);
        }).catch(error => {
            console.error('Failed to fetch file stats:', error);
        });
    }

    // Load activity in parallel
    generateActivityHeatmap();
}


// Helper function to expand all parent spaces of a given space
function expandSpacePath(spaceId) {
    const space = spaces.find(cat => cat.id === spaceId);
    if (!space) return;

    // Recursively expand all parent spaces
    function expandParents(cat) {
        if (cat.parent_id) {
            const parent = spaces.find(c => c.id === cat.parent_id);
            if (parent) {
                expandedSpaces.add(parent.id);
                expandParents(parent);
            }
        }
    }

    expandParents(space);
    saveExpandedSpaces();
}

// Helper function to scroll the selected space into view
function scrollToSpaceElement(spaceId) {
    // Use setTimeout to ensure DOM is fully rendered
    setTimeout(() => {
        // Find the space button using the data attribute
        const targetButton = document.querySelector(`[data-space-id="${spaceId}"]`);

        if (targetButton) {
            // Get the spaces container - check if it has a scrollable parent
            const container = document.getElementById('spaces-tree');
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

function deselectSpace() {
    // Stop any ongoing loading
    isLoadingPosts = false;

    // Clear posts container immediately
    const postsContainer = document.getElementById('posts-container');
    if (postsContainer) {
        postsContainer.innerHTML = `
            <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                <i class="fas fa-spinner fa-spin text-4xl mb-4"></i>
                <p>Loading posts...</p>
            </div>
        `;
    }

    // Create "all spaces" state
    currentSpace = {
        id: window.AppConstants.ALL_SPACES_ID,
        name: window.AppConstants.UI_TEXT.allSpaces,
        recursiveMode: false
    };

    localStorage.removeItem(window.AppConstants.STORAGE_KEYS.lastSpace);
    renderSpaces();

    // Update UI
    document.getElementById('new-post-btn').style.display = 'none';
    document.getElementById('settings-btn').style.display = 'block';
    document.getElementById('theme-toggle-btn').style.display = 'block';
    document.getElementById('space-actions-dropdown').style.display = 'none';

    // Update header immediately with cached post counts
    updateAllSpacesDisplay();

    // Load all posts
    loadPosts(0, false);

    // Reset activity and scroll
    currentActivityPeriod = 0;
    window.scrollTo(0, 0);

    // Fetch file stats in parallel if needed and update display when ready
    if (fileStatsEnabled) {
        fetchSpaceStats(0, false).then(fileStats => {
            updateAllSpacesDisplay(fileStats);
        }).catch(error => {
            console.error('Failed to fetch file stats:', error);
        });
    }

    // Generate activity in parallel
    generateActivityHeatmap();
}

function toggleRecursiveMode(space) {
    if (!currentSpace || currentSpace.id !== space.id) return;

    currentSpace.recursiveMode = !currentSpace.recursiveMode;

    // Save the new state
    saveRecursiveToggleState(space.id, currentSpace.recursiveMode);

    // Scroll to top when toggling
    window.scrollTo(0, 0);

    renderSpaces();

    // Update header immediately with new post count from cached state (no await, synchronous)
    updateSpaceStatsDisplay();

    // Load posts immediately (don't await, let it run in parallel)
    loadPosts(space.id, currentSpace.recursiveMode);

    // Fetch file stats in parallel if needed and update display when ready
    if (fileStatsEnabled) {
        fetchSpaceStats(space.id, currentSpace.recursiveMode).then(stats => {
            updateSpaceStatsDisplay(stats);
        }).catch(error => {
            console.error('Failed to fetch file stats:', error);
        });
    }

    // Load activity in parallel
    generateActivityHeatmap();
}

// Functions to manage recursive toggle state per space
function saveRecursiveToggleState(spaceId, recursiveMode) {
    const recursiveStates = JSON.parse(localStorage.getItem(window.AppConstants.STORAGE_KEYS.recursiveStates) || '{}');
    recursiveStates[spaceId] = recursiveMode;
    localStorage.setItem(window.AppConstants.STORAGE_KEYS.recursiveStates, JSON.stringify(recursiveStates));
}

function loadRecursiveToggleState(spaceId) {
    const recursiveStates = JSON.parse(localStorage.getItem(window.AppConstants.STORAGE_KEYS.recursiveStates) || '{}');
    return recursiveStates[spaceId] || false;
}

function removeRecursiveToggleState(spaceId) {
    const recursiveStates = JSON.parse(localStorage.getItem(window.AppConstants.STORAGE_KEYS.recursiveStates) || '{}');
    delete recursiveStates[spaceId];
    localStorage.setItem(window.AppConstants.STORAGE_KEYS.recursiveStates, JSON.stringify(recursiveStates));
}

function cleanupRecursiveToggleStates() {
    // Clean up states for spaces that no longer exist
    const recursiveStates = JSON.parse(localStorage.getItem(window.AppConstants.STORAGE_KEYS.recursiveStates) || '{}');
    const existingSpaceIds = new Set(spaces.map(cat => cat.id.toString()));

    const cleanedStates = {};
    for (const [spaceId, state] of Object.entries(recursiveStates)) {
        if (existingSpaceIds.has(spaceId)) {
            cleanedStates[spaceId] = state;
        }
    }

    localStorage.setItem(window.AppConstants.STORAGE_KEYS.recursiveStates, JSON.stringify(cleanedStates));
}

// Helper function to build space breadcrumb path
function getSpaceBreadcrumb(spaceId) {
    const space = spaces.find(cat => cat.id === spaceId);
    if (!space) return '';

    const path = [];
    let current = space;

    while (current) {
        path.unshift(current.name);
        if (current.parent_id) {
            current = spaces.find(cat => cat.id === current.parent_id);
        } else {
            current = null;
        }
    }

    return path.join(' > ');
}

// Helper function to build interactive breadcrumb with clickable links
function getInteractiveSpaceBreadcrumb(spaceId) {
    const space = spaces.find(cat => cat.id === spaceId);
    if (!space) return '';

    const pathElements = [];
    let current = space;

    while (current) {
        pathElements.unshift({
            id: current.id,
            name: current.name
        });
        if (current.parent_id) {
            current = spaces.find(cat => cat.id === current.parent_id);
        } else {
            current = null;
        }
    }

    // Check if we're on mobile (768px and below)
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        // On mobile, show "... > Current Space" format
        const currentElement = pathElements[pathElements.length - 1];

        if (pathElements.length > 1) {
            // Has parent spaces - show "... > Current Space"
            const parentElement = pathElements[pathElements.length - 2];
            return `<span class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer transition-colors" onclick="navigateToSpace(${parentElement.id})">...</span> <span class="text-gray-400 dark:text-gray-500">></span> <span class="text-gray-900 dark:text-gray-100">${currentElement.name}</span>`;
        } else {
            // Root space - show "... > Current Space" where ... goes to All Spaces
            return `<span class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer transition-colors" onclick="navigateToAllSpaces()">...</span> <span class="text-gray-400 dark:text-gray-500">></span> <span class="text-gray-900 dark:text-gray-100">${currentElement.name}</span>`;
        }
    }

    // On desktop, show full breadcrumb path
    return pathElements.map((element, index) => {
        if (index === pathElements.length - 1) {
            // Last element (current space) - not clickable
            return `<span class="text-gray-900 dark:text-gray-100">${element.name}</span>`;
        } else {
            // Parent elements - clickable
            return `<span class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer transition-colors" onclick="navigateToSpace(${element.id})">${element.name}</span>`;
        }
    }).join(' <span class="text-gray-400 dark:text-gray-500">></span> ');
}

// Function to navigate to a space when breadcrumb is clicked
function navigateToSpace(spaceId) {
    const space = spaces.find(cat => cat.id === spaceId);
    if (space) {
        // Use router to properly handle URL updates for spaces with spaces
        if (typeof router !== 'undefined' && router.navigateToSpace) {
            router.navigateToSpace(space);
        } else {
            selectSpace(space); // Fallback if router not available
        }
    }
}

// Function to navigate to all spaces (used on mobile breadcrumb)
function navigateToAllSpaces() {
    // Use router to navigate to root/all spaces
    if (typeof router !== 'undefined' && router.navigate) {
        router.navigate('/');
    } else {
        deselectSpace(); // Fallback if router not available
    }
}

// Make functions globally accessible for onclick handlers
window.navigateToSpace = navigateToSpace;
window.navigateToAllSpaces = navigateToAllSpaces;

// Function to get all descendant spaces recursively
async function getAllDescendantSpaces(parentId) {
    const descendants = [];

    // Get direct children
    const directChildren = spaces.filter(cat => cat.parent_id === parentId);

    for (const child of directChildren) {
        descendants.push(child);
        // Recursively get children of this child
        const childDescendants = await getAllDescendantSpaces(child.id);
        descendants.push(...childDescendants);
    }

    return descendants;
}

// Function to get all posts recursively from a space
async function getAllPostsRecursively(spaceId) {
    let allPosts = [];
    let offset = 0;
    const limit = window.AppConstants.UI_CONFIG.spaceBatchLimit;
    let hasMore = true;

    while (hasMore) {
        try {
            const response = await fetchPosts(spaceId, limit, offset, true, true); // recursive = true
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

async function deleteSpace(space) {
    // Get total posts from space's recursive count
    const totalPosts = space.recursive_post_count || 0;

    // Get all descendant spaces for accurate count
    const allDescendants = await getAllDescendantSpaces(space.id);
    const totalSubspaces = allDescendants.length;

    let message = `${window.AppConstants.USER_MESSAGES.confirm.deleteSpace} "${space.name}"?`;

    if (totalSubspaces > 0) {
        message += `\n\nThis will also delete **${totalSubspaces}** subspace(ies)`;
    }

    if (totalPosts > 0) {
        message += ` and **${totalPosts}** post(s)`;
        message += '.';
    }

    message += window.AppConstants.USER_MESSAGES.confirm.undoWarning;

    // Build details HTML for subspaces list only
    let detailsHtml = '';

    // Subspaces list
    if (allDescendants.length > 0) {
        detailsHtml += '<div class="mb-4"><h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Subspaces to be deleted:</h4>';
        detailsHtml += '<div class="bg-gray-50 dark:bg-gray-800 rounded p-3 max-h-32 overflow-y-auto"><ul class="text-sm text-gray-600 dark:text-gray-400 space-y-1">';

        allDescendants.forEach(subcat => {
            const breadcrumb = getSpaceBreadcrumb(subcat.id);
            detailsHtml += `<li>• ${breadcrumb}</li>`;
        });

        detailsHtml += '</ul></div></div>';
    }

    const confirmed = await showConfirmation('Delete Space', message, detailsHtml);
    if (confirmed) {
        try {
            await deleteSpaceApi(space.id);

            // Remove recursive toggle state for this space
            removeRecursiveToggleState(space.id);

            await fetchSpaces();

            // Show success message
            showSuccess(`Space "${space.name}" ${window.AppConstants.USER_MESSAGES.success.spaceDeleted}`);

            // Cleanup any orphaned toggle states
            cleanupRecursiveToggleStates();

            if (currentSpace && currentSpace.id === space.id) {
                currentSpace = null;
                localStorage.removeItem(window.AppConstants.STORAGE_KEYS.lastSpace);
                document.getElementById('timeline-title').textContent = '';
                document.getElementById('new-post-btn').style.display = 'none';
                document.getElementById('settings-btn').style.display = 'block';
                document.getElementById('theme-toggle-btn').style.display = 'block';
                document.getElementById('recursive-toggle-btn').style.display = 'none';
                document.getElementById('space-actions-dropdown').style.display = 'none';
                document.getElementById('posts-container').innerHTML = '';
            }
        } catch (error) {
            showError(formatMessage(window.AppConstants.USER_MESSAGES.error.failedToDeleteSpace, error.message));
        }
    }
}

// Space sorting functionality
function getSortPreference() {
    const stored = localStorage.getItem(window.AppConstants.STORAGE_KEYS.spaceSortPref);
    return stored ? JSON.parse(stored) : { field: 'name', ascending: true };
}

function setSortPreference(field, ascending) {
    const preference = { field, ascending };
    localStorage.setItem(window.AppConstants.STORAGE_KEYS.spaceSortPref, JSON.stringify(preference));
}

function sortSpaces(spacesArray) {
    const sortPref = getSortPreference();
    const sorted = [...spacesArray];

    sorted.sort((a, b) => {
        let aValue, bValue;

        switch (sortPref.field) {
            case 'name':
                aValue = a.name.toLowerCase();
                bValue = b.name.toLowerCase();
                break;
            case 'posts':
                // Use recursive post count as requested
                aValue = a.recursive_post_count || 0;
                bValue = b.recursive_post_count || 0;
                break;
            case 'created':
                aValue = a.created || 0;
                bValue = b.created || 0;
                break;
            default:
                return 0;
        }

        let comparison = 0;
        if (aValue < bValue) {
            comparison = -1;
        } else if (aValue > bValue) {
            comparison = 1;
        }

        return sortPref.ascending ? comparison : -comparison;
    });

    return sorted;
}

function updateSortFooterVisibility() {
    const footer = document.getElementById('space-sort-footer');
    if (!footer) return;

    // Count spaces at the same level (root level and each parent level)
    const rootSpaces = spaces.filter(cat => !cat.parent_id);

    // Show footer if there are 2 or more root spaces, or if any parent has 2+ children
    let shouldShow = rootSpaces.length >= 2;

    if (!shouldShow) {
        // Check if any expanded parent has 2+ children
        for (const space of spaces) {
            if (expandedSpaces.has(space.id)) {
                const children = spaces.filter(cat => cat.parent_id === space.id);
                if (children.length >= 2) {
                    shouldShow = true;
                    break;
                }
            }
        }
    }

    footer.style.display = shouldShow ? 'block' : 'none';
}

function initializeSortFooter() {
    const footer = document.getElementById('space-sort-footer');
    if (!footer) return;

    const sortOptions = footer.querySelectorAll('.sort-option');
    const currentPref = getSortPreference();

    // Set initial active state
    updateSortButtonStates();

    // Add click listeners
    sortOptions.forEach(button => {
        button.addEventListener('click', () => {
            const field = button.dataset.sort;
            const currentPref = getSortPreference();

            let ascending = true;
            if (currentPref.field === field) {
                // If clicking the same field, toggle direction
                ascending = !currentPref.ascending;
            }

            setSortPreference(field, ascending);
            updateSortButtonStates();
            renderSpaces();
        });
    });
}

function updateSortButtonStates() {
    const footer = document.getElementById('space-sort-footer');
    if (!footer) return;

    const sortOptions = footer.querySelectorAll('.sort-option');
    const currentPref = getSortPreference();

    sortOptions.forEach(button => {
        const field = button.dataset.sort;
        const isActive = currentPref.field === field;
        const icon = button.querySelector('.sort-icon');

        // Update button appearance
        if (isActive) {
            button.classList.remove('text-gray-600');
            button.classList.add('text-blue-600', 'font-medium');
        } else {
            button.classList.remove('text-blue-600', 'font-medium');
            button.classList.add('text-gray-600');
        }

        // Update icon direction
        if (icon && isActive) {
            const ascIcon = icon.dataset.asc;
            const descIcon = icon.dataset.desc;
            icon.className = `fas ${currentPref.ascending ? ascIcon : descIcon} ml-1 sort-icon`;
        }
    });
}