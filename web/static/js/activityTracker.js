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
    document.getElementById('activity-container').style.display = '';

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
        const now = new Date();
        const endDate = now.toISOString().split('T')[0];
        const startDate = new Date(now.getTime() - (120 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]; // 120 days ago

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
async function fetchActivityPeriod(categoryId, recursive = false, period = 0, periodMonths = 4) {
    const params = new URLSearchParams({
        recursive: recursive.toString(),
        period: period.toString(),
        period_months: window.AppConstants.UI_CONFIG.activityPeriodMonths.toString()
    });

    const response = await fetch(`/api/activity/${categoryId}?${params}`, {
        headers: {
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
}

// Update category breadcrumb display
function updateActivityCategoryBreadcrumb() {
    const breadcrumbElement = document.getElementById('activity-category-breadcrumb');
    if (!breadcrumbElement) return;

    if (!currentCategory || currentCategory.id === window.AppConstants.ALL_CATEGORIES_ID) {
        breadcrumbElement.innerHTML = `<span class="text-xs font-semibold text-gray-700">${window.AppConstants.UI_TEXT.allCategories}</span>`;
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
            return `<span class="text-xs font-semibold text-gray-700">${cat.name}</span>`;
        } else {
            return `<span class="text-xs font-medium text-gray-600">${cat.name}</span>`;
        }
    }).join(' <span class="text-gray-400 mx-1">></span> ');

    breadcrumbElement.innerHTML = breadcrumbHtml;
}

// Generate heatmap from cached activity data
function generateHeatmapFromCache(activityData) {
    // Update category breadcrumb
    updateActivityCategoryBreadcrumb();

    // Convert activity days array to map for O(1) lookups
    const activityMap = {};
    activityData.days.forEach(day => {
        activityMap[day.date] = day.count;
    });

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
        document.getElementById('activity-heatmap').innerHTML = '<div class="text-center text-gray-500 py-4"><p>No activity data available</p></div>';
        return;
    }

    // Generate month labels based on the actual activity period dates
    const monthLabels = [];

    // Check if dates are valid
    if (!startDate || !endDate) {
        document.getElementById('activity-heatmap').innerHTML = '<div class="text-center text-gray-500 py-4"><p>No activity data available</p></div>';
        return;
    }

    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T00:00:00Z');

    // Check if dates are valid after parsing
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        document.getElementById('activity-heatmap').innerHTML = '<div class="text-center text-gray-500 py-4"><p>No activity data available</p></div>';
        return;
    }

    // Create array of unique months in the period
    const monthsSet = new Set();
    const current = new Date(start);

    while (current <= end) {
        const monthLabel = current.toLocaleDateString('en-US', {
            month: 'short',
            timeZone: 'UTC'
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
            html += `<div class="absolute -left-10 w-8 text-xs text-gray-400 text-right">${monthLabel}</div>`;
        }
        html += '<div class="flex gap-1">';

        for (let i = startIndex; i < endIndex; i++) {
            if (i < days.length) {
                const day = days[i];
                const colorClass = getColorClass(day.intensity);
                const dayName = new Date(day.date + 'T00:00:00Z').toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    timeZone: 'UTC'
                });

                html += `<div class="heatmap-square ${colorClass} rounded-sm cursor-pointer heatmap-cell hover:ring-1 hover:ring-gray-300 transition-all"
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
    const maxColorClass = window.AppConstants.ACTIVITY_CLASSES[window.AppConstants.ACTIVITY_CLASSES.length - 1]; // Highest activity level

    legendElement.innerHTML = `
        <div class="flex items-center space-x-2">
            <div class="w-2 h-2 ${minColorClass} rounded-sm"></div>
            <span class="text-gray-400">${window.AppConstants.UI_TEXT.less}</span>
        </div>
        <div class="flex items-center space-x-2">
            <div class="w-2 h-2 ${maxColorClass} rounded-sm"></div>
            <span class="text-gray-400">${window.AppConstants.UI_TEXT.more}</span>
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

    const startMonth = start.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

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

    // Generate new heatmap (will fetch new data if needed)
    await generateActivityHeatmap();
}


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
    return window.AppConstants.ACTIVITY_CLASSES[intensity] || window.AppConstants.ACTIVITY_CLASSES[0];
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


