// Modern, efficient activity tracking using cached backend data
// Replaces the old system that fetched all posts on every request

let currentActivityCache = null;
let isGeneratingActivity = false;
// currentActivityPeriod is defined in state.js

// Initialize activity tracking with cached data
async function generateActivityHeatmap() {
    // Prevent duplicate calls
    if (isGeneratingActivity) {
        return;
    }

    // Check if activity system is enabled
    if (!activityEnabled || !currentCategory) {
        document.getElementById('activity-container').style.display = 'none';
        return;
    }

    isGeneratingActivity = true;

    // Let CSS handle responsive visibility (hidden on mobile, visible on desktop)
    const activityContainer = document.getElementById('activity-container');
    activityContainer.style.display = '';

    // Show loading indicator in the entire activity container (not just heatmap)
    activityContainer.innerHTML = `
        <div class="text-center text-gray-500 dark:text-gray-400 py-16">
            <i class="fas fa-spinner fa-spin text-4xl mb-4"></i>
            <p>Loading activity...</p>
        </div>
    `;

    try {
        // Use efficient API that returns only non-zero activity days
        // For category ID 0, the backend will return global activity data
        const response = await fetchActivityPeriod(
            currentCategory.id,
            currentCategory.recursiveMode || false,
            currentActivityPeriod
        );

        if (!response) {
            // Hide activity container for failed requests
            document.getElementById('activity-container').style.display = 'none';
            return;
        }

        // Always show the activity container if we have a valid response (category exists)
        // The heatmap will show as empty if there's no activity, but it should be visible
        // so users know the system is working and can see activity when it happens
        document.getElementById('activity-container').style.display = '';

        // Cache the response for fast period navigation
        currentActivityCache = response;

        // Generate heatmap from compact data
        generateHeatmapFromCache(response);

    } catch (error) {
        console.error('Failed to generate activity heatmap:', error);
        // Fallback to empty heatmap with valid dates
        const settings = window.currentSettings || await loadAppSettings();
        const periodMonths = settings.activityPeriodMonths || 4;
        const periodDays = periodMonths * 30;

        const now = new Date();
        const endDate = now.toISOString().split('T')[0];
        const startDate = new Date(now.getTime() - (periodDays * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

        const fallbackData = {
            days: [],
            start_date: startDate,
            end_date: endDate,
            stats: { total_posts: 0, active_days: 0, max_day_activity: 0 },
            max_periods: 0
        };
        currentActivityCache = fallbackData;
        generateHeatmapFromCache(fallbackData);
    } finally {
        isGeneratingActivity = false;
    }
}

// Fetch activity data from efficient backend API
async function fetchActivityPeriod(categoryId, recursive = false, period = 0) {
    return await fetchActivityData(categoryId, recursive, period);
}

// Update category breadcrumb display
function updateActivityCategoryBreadcrumb() {
    const breadcrumbElement = document.getElementById('activity-category-breadcrumb');
    if (!breadcrumbElement) return;

    if (!currentCategory || currentCategory.id === window.AppConstants.ALL_CATEGORIES_ID) {
        breadcrumbElement.innerHTML = `<span class="text-xs font-semibold text-gray-700 dark:text-gray-300">${window.AppConstants.UI_TEXT.allCategories}</span>`;
        return;
    }

    // Build breadcrumb path
    const breadcrumbPath = [];
    let category = currentCategory;

    // Build path from current category up to root
    while (category) {
        breadcrumbPath.unshift(category);
        if (category.parent_id && categories) {
            category = categories.find(cat => cat.id === category.parent_id);
        } else {
            category = null;
        }
    }

    // Generate breadcrumb HTML
    const breadcrumbHtml = breadcrumbPath.map((cat, index) => {
        const isLast = index === breadcrumbPath.length - 1;
        if (isLast) {
            return `<span class="text-xs font-semibold text-gray-700 dark:text-gray-300">${cat.name}</span>`;
        } else {
            return `<span class="text-xs font-medium text-gray-600 dark:text-gray-400">${cat.name}</span>`;
        }
    }).join(' <span class="text-gray-400 dark:text-gray-500 mx-1">></span> ');

    breadcrumbElement.innerHTML = breadcrumbHtml;
}

// Generate heatmap from cached activity data
function generateHeatmapFromCache(activityData) {
    // Restore the activity container structure if it was replaced by loading indicator
    const activityContainer = document.getElementById('activity-container');
    if (!activityContainer.querySelector('#activity-category-breadcrumb')) {
        activityContainer.innerHTML = `
            <!-- Category Breadcrumb -->
            <div id="activity-category-breadcrumb" class="mb-4">
                <!-- Breadcrumb will be generated dynamically -->
            </div>
            <div class="flex items-center justify-center mb-4">
                <button id="activity-prev" class="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 mr-3" onclick="changeActivityPeriod(-1)">
                    <i class="fas fa-chevron-left text-xs"></i>
                </button>
                <span id="activity-period" class="text-sm text-gray-600 dark:text-gray-400"></span>
                <button id="activity-next" class="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 ml-3" onclick="changeActivityPeriod(1)">
                    <i class="fas fa-chevron-right text-xs"></i>
                </button>
            </div>
            <div class="relative mb-6">
                <div class="flex justify-center">
                    <div id="activity-heatmap" class="min-h-16">
                        <!-- Heatmap will be generated here -->
                    </div>
                </div>
            </div>
            <div class="flex items-center justify-between text-xs mt-6">
                <div id="activity-legend" class="flex flex-col space-y-1">
                    <!-- Legend will be generated dynamically -->
                </div>
                <span id="activity-summary" class="text-gray-500 dark:text-gray-400"></span>
            </div>
        `;
    }

    // Update category breadcrumb
    updateActivityCategoryBreadcrumb();

    // Convert activity days array to map for O(1) lookups
    const activityMap = {};
    if (activityData.days && Array.isArray(activityData.days)) {
        activityData.days.forEach(day => {
            activityMap[day.date] = day.count;
        });
    }

    // Update period label
    const periodLabel = currentActivityPeriod === 0
        ? `${activityData.start_date} - ${activityData.end_date}`
        : `${activityData.start_date} - ${activityData.end_date}`;

    document.getElementById('activity-period').textContent = formatPeriodLabel(
        activityData.start_date,
        activityData.end_date,
        currentActivityPeriod
    );

    // Generate calendar grid efficiently
    const days = generateCalendarDays(activityData.start_date, activityData.end_date, activityMap);

    // Render heatmap
    renderHeatmapGrid(days, activityData.start_date, activityData.end_date);

    // Update summary with pre-calculated stats
    const postsText = activityData.stats.total_posts === 1 ? window.AppConstants.UI_TEXT.post : window.AppConstants.UI_TEXT.posts;
    const daysText = activityData.stats.active_days === 1 ? window.AppConstants.UI_TEXT.day : window.AppConstants.UI_TEXT.days;
    document.getElementById('activity-summary').textContent =
        `${activityData.stats.total_posts} ${postsText} ${window.AppConstants.UI_TEXT.on} ${activityData.stats.active_days} ${daysText}`;

    // Update navigation buttons
    document.getElementById('activity-next').disabled = currentActivityPeriod >= 0;

    // Use actual max_periods from unified API response
    const maxPeriods = activityData.max_periods !== undefined ? activityData.max_periods : 24;
    document.getElementById('activity-prev').disabled = currentActivityPeriod <= -maxPeriods;

    // Update legend with dynamic colors
    updateActivityLegend();

    // Add tooltips
    addHeatmapTooltips();
}

// Generate calendar days efficiently without fetching all data
function generateCalendarDays(startDate, endDate, activityMap) {
    const days = [];

    // Check if dates are valid
    if (!startDate || !endDate) {
        return days; // Return empty array for invalid dates
    }

    const current = new Date(startDate + 'T00:00:00Z'); // Ensure UTC
    const end = new Date(endDate + 'T00:00:00Z');

    // Check if dates are valid after parsing
    if (isNaN(current.getTime()) || isNaN(end.getTime())) {
        return days; // Return empty array for invalid dates
    }

    while (current <= end) {
        const dateKey = current.toISOString().split('T')[0];
        const count = activityMap[dateKey] || 0;
        const intensity = getIntensityLevel(count);

        days.push({
            date: dateKey,
            count: count,
            intensity: intensity,
            month: current.getUTCMonth(),
            day: current.getUTCDate()
        });

        current.setUTCDate(current.getUTCDate() + 1);
    }

    return days;
}

// Render heatmap grid with optimized layout
function renderHeatmapGrid(days, startDate, endDate) {
    const squaresPerRow = window.AppConstants.UI_CONFIG.heatmapSquaresPerRow;
    const rows = Math.ceil(days.length / squaresPerRow);

    // Handle empty days array
    if (days.length === 0) {
        document.getElementById('activity-heatmap').innerHTML = '<div class="text-center text-gray-500 dark:text-gray-400 py-4"><p>${window.AppConstants.USER_MESSAGES.info.noActivityData}</p></div>';
        return;
    }

    // Generate month labels based on the actual activity period dates
    const monthLabels = [];

    // Check if dates are valid
    if (!startDate || !endDate) {
        document.getElementById('activity-heatmap').innerHTML = '<div class="text-center text-gray-500 dark:text-gray-400 py-4"><p>${window.AppConstants.USER_MESSAGES.info.noActivityData}</p></div>';
        return;
    }

    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T00:00:00Z');

    // Check if dates are valid after parsing
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        document.getElementById('activity-heatmap').innerHTML = '<div class="text-center text-gray-500 dark:text-gray-400 py-4"><p>${window.AppConstants.USER_MESSAGES.info.noActivityData}</p></div>';
        return;
    }

    // Create array of unique months in the period
    const monthsSet = new Set();
    const current = new Date(start);

    while (current <= end) {
        const monthLabel = current.toLocaleDateString(window.AppConstants.LOCALE_SETTINGS.default, {
            month: window.AppConstants.DATE_FORMAT.monthStyle,
            timeZone: window.AppConstants.DATE_FORMAT.timezone
        });
        monthsSet.add(monthLabel);
        current.setUTCMonth(current.getUTCMonth() + 1);
        current.setUTCDate(1); // Reset to first day of month to avoid date overflow issues
    }

    const uniqueMonthLabels = Array.from(monthsSet);

    let html = '<div class="space-y-1">';

    const nRowGap = Math.round(30 / window.AppConstants.UI_CONFIG.heatmapSquaresPerRow);

    for (let row = 0; row < rows; row++) {
        const startIndex = row * squaresPerRow;
        const endIndex = Math.min(startIndex + squaresPerRow, days.length);

        // Show month every 3 rows using dynamic labels
        let monthLabel = '';
        if (row % nRowGap === 0) {
            const monthIndex = Math.floor(row / nRowGap);
            if (monthIndex < uniqueMonthLabels.length) {
                monthLabel = uniqueMonthLabels[monthIndex];
            }
        }

        html += '<div class="flex items-center relative">';
        if (monthLabel) {
            html += `<div class="absolute -left-10 w-8 text-xs text-gray-400 dark:text-gray-500 text-right">${monthLabel}</div>`;
        }
        html += '<div class="flex gap-1">';

        for (let i = startIndex; i < endIndex; i++) {
            if (i < days.length) {
                const day = days[i];
                const colorClass = getColorClass(day.intensity);
                const dayName = new Date(day.date + 'T00:00:00Z').toLocaleDateString(window.AppConstants.LOCALE_SETTINGS.default, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    timeZone: 'UTC'
                });

                html += `<div class="heatmap-square ${colorClass} rounded-sm cursor-pointer heatmap-cell hover:ring-1 hover:ring-gray-300 dark:hover:ring-gray-600 transition-all"
                             data-date="${day.date}"
                             data-count="${day.count}"
                             data-day="${dayName}">
                         </div>`;
            }
        }

        html += '</div></div>';
    }

    html += '</div>';
    document.getElementById('activity-heatmap').innerHTML = html;
}

// Generate activity legend using constants
function updateActivityLegend() {
    const legendElement = document.getElementById('activity-legend');
    if (!legendElement) return;

    const minColorClass = window.AppConstants.ACTIVITY_CLASSES[1]; // First actual activity level
    const minColorClassDark = window.AppConstants.ACTIVITY_CLASSES_DARK[1];
    const maxColorClass = window.AppConstants.ACTIVITY_CLASSES[window.AppConstants.ACTIVITY_CLASSES.length - 1]; // Highest activity level
    const maxColorClassDark = window.AppConstants.ACTIVITY_CLASSES_DARK[window.AppConstants.ACTIVITY_CLASSES_DARK.length - 1];

    legendElement.innerHTML = `
        <div class="flex items-center space-x-2">
            <div class="w-2 h-2 ${minColorClass} ${minColorClassDark} rounded-sm"></div>
            <span class="text-gray-400 dark:text-gray-500">${window.AppConstants.UI_TEXT.less}</span>
        </div>
        <div class="flex items-center space-x-2">
            <div class="w-2 h-2 ${maxColorClass} ${maxColorClassDark} rounded-sm"></div>
            <span class="text-gray-400 dark:text-gray-500">${window.AppConstants.UI_TEXT.more}</span>
        </div>
    `;
}

// Format period label
function formatPeriodLabel(startDate, endDate, period) {
    // Check if dates are valid
    if (!startDate || !endDate) {
        return 'No activity period';
    }

    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T00:00:00Z');

    // Check if dates are valid after parsing
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return 'No activity period';
    }

    const startMonth = start.toLocaleDateString(window.AppConstants.LOCALE_SETTINGS.default, { month: 'short', year: 'numeric', timeZone: 'UTC' });
    const endMonth = end.toLocaleDateString(window.AppConstants.LOCALE_SETTINGS.default, { month: 'short', year: 'numeric', timeZone: 'UTC' });

    return `${startMonth} – ${endMonth}`;
}

// Navigate activity periods efficiently
async function changeActivityPeriod(direction) {
    const newPeriod = currentActivityPeriod + direction;

    // Check bounds - if no cache, allow navigation and let generateActivityHeatmap handle it
    if (currentActivityCache) {
        const maxPeriods = currentActivityCache.max_periods !== undefined ? currentActivityCache.max_periods : 24;
        if (newPeriod > 0 || newPeriod < -maxPeriods) {
            return; // Out of bounds
        }
    } else {
        // Basic bounds check without cache
        if (newPeriod > 0 || newPeriod < -24) { // Allow up to 24 periods back
            return; // Out of bounds
        }
    }

    currentActivityPeriod = newPeriod;

    // Show loading indicator in heatmap only while fetching new period data
    const heatmapContainer = document.getElementById('activity-heatmap');
    if (heatmapContainer) {
        heatmapContainer.innerHTML = `
            <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                <p class="text-sm">Loading...</p>
            </div>
        `;
    }

    // Generate new heatmap (will fetch new data if needed)
    await generateActivityHeatmap();
}

// Make function globally accessible for onclick handlers
window.changeActivityPeriod = changeActivityPeriod;



// Get activity intensity level (same as before but using constants)
function getIntensityLevel(count) {
    if (count === 0) return window.AppConstants.ACTIVITY_LEVELS.none;
    if (count === window.AppConstants.ACTIVITY_THRESHOLDS.low) return window.AppConstants.ACTIVITY_LEVELS.low;
    if (count <= window.AppConstants.ACTIVITY_THRESHOLDS.medium) return window.AppConstants.ACTIVITY_LEVELS.medium;
    if (count <= window.AppConstants.ACTIVITY_THRESHOLDS.high) return window.AppConstants.ACTIVITY_LEVELS.high;
    return window.AppConstants.ACTIVITY_LEVELS.veryHigh;
}

// Get color class for activity level (using constants)
function getColorClass(intensity) {
    const lightClass = window.AppConstants.ACTIVITY_CLASSES[intensity] || window.AppConstants.ACTIVITY_CLASSES[0];
    const darkClass = window.AppConstants.ACTIVITY_CLASSES_DARK[intensity] || window.AppConstants.ACTIVITY_CLASSES_DARK[0];
    return `${lightClass} ${darkClass}`;
}

// Add tooltips (same as before)
function addHeatmapTooltips() {
    const cells = document.querySelectorAll('.heatmap-cell');
    let tooltip = null;

    cells.forEach(cell => {
        cell.addEventListener('mouseenter', (e) => {
            const count = e.target.getAttribute('data-count');
            const day = e.target.getAttribute('data-day');

            tooltip = document.createElement('div');
            tooltip.className = 'absolute bg-gray-900 text-white text-xs px-3 py-2 rounded shadow-lg pointer-events-none z-50 max-w-xs';
            const postText = count === '1' ? window.AppConstants.UI_TEXT.post : window.AppConstants.UI_TEXT.posts;
            tooltip.innerHTML = `
                <div class="font-medium">${count} ${postText}</div>
                <div class="text-gray-300">${day}</div>
            `;

            document.body.appendChild(tooltip);

            const rect = e.target.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();

            // Position tooltip
            let left = rect.right + 10;
            if (left + tooltipRect.width > window.innerWidth) {
                left = rect.left - tooltipRect.width - 10;
            }

            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${rect.top + window.scrollY - tooltipRect.height - 5}px`;
        });

        cell.addEventListener('mouseleave', () => {
            if (tooltip) {
                document.body.removeChild(tooltip);
                tooltip = null;
            }
        });
    });
}
