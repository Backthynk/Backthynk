// Modern, efficient activity tracking using cached backend data
// Replaces the old system that fetched all posts on every request

let currentActivityCache = null;
// currentActivityPeriod is defined in state.js

// Initialize activity tracking with cached data
async function generateActivityHeatmap() {
    // Check if activity system is enabled
    if (!activityEnabled || !currentCategory) {
        document.getElementById('activity-container').style.display = 'none';
        return;
    }

    // Let CSS handle responsive visibility (hidden on mobile, visible on desktop)
    document.getElementById('activity-container').style.display = '';

    try {
        // Use efficient API that returns only non-zero activity days
        const response = await fetchActivityPeriod(
            currentCategory.id,
            currentCategory.recursiveMode || false,
            currentActivityPeriod
        );

        if (!response || response.days.length === 0) {
            // Hide activity container for empty categories
            document.getElementById('activity-container').style.display = 'none';
            return;
        }

        // Cache the response for fast period navigation
        currentActivityCache = response;

        // Generate heatmap from compact data
        generateHeatmapFromCache(response);

    } catch (error) {
        console.error('Failed to generate activity heatmap:', error);
        // Fallback to empty heatmap
        generateHeatmapFromCache({
            days: [],
            stats: { total_posts: 0, active_days: 0, max_day_activity: 0 },
            max_periods: 0
        });
    }
}

// Fetch activity data from efficient backend API
async function fetchActivityPeriod(categoryId, recursive = false, period = 0, periodMonths = 6) {
    const params = new URLSearchParams({
        recursive: recursive.toString(),
        period: period.toString(),
        period_months: periodMonths.toString()
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

// Generate heatmap from cached activity data
function generateHeatmapFromCache(activityData) {
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
    renderHeatmapGrid(days);

    // Update summary with pre-calculated stats
    document.getElementById('activity-summary').textContent =
        `${activityData.stats.total_posts} posts on ${activityData.stats.active_days} days`;

    // Update navigation buttons
    document.getElementById('activity-next').disabled = currentActivityPeriod >= 0;
    document.getElementById('activity-prev').disabled = currentActivityPeriod <= -activityData.max_periods;

    // Add tooltips
    addHeatmapTooltips();
}

// Generate calendar days efficiently without fetching all data
function generateCalendarDays(startDate, endDate, activityMap) {
    const days = [];
    const current = new Date(startDate + 'T00:00:00Z'); // Ensure UTC
    const end = new Date(endDate + 'T00:00:00Z');

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
function renderHeatmapGrid(days) {
    const squaresPerRow = window.AppConstants.UI_CONFIG.heatmapSquaresPerRow;
    const rows = Math.ceil(days.length / squaresPerRow);

    let html = '<div class="space-y-1">';
    let lastMonthShown = -1;

    for (let row = 0; row < rows; row++) {
        const startIndex = row * squaresPerRow;
        const endIndex = Math.min(startIndex + squaresPerRow, days.length);

        // Get first day of row for month label
        const firstDay = days[startIndex];
        const currentMonth = firstDay ? firstDay.month : -1;

        // Only show month label when it changes
        let monthLabel = '';
        if (currentMonth !== lastMonthShown) {
            monthLabel = new Date(firstDay.date + 'T00:00:00Z').toLocaleDateString('en-US', {
                month: 'short',
                timeZone: 'UTC'
            });
            lastMonthShown = currentMonth;
        }

        html += '<div class="flex items-center">';
        html += `<div class="w-8 text-xs text-gray-400 flex-shrink-0">${monthLabel}</div>`;
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

                html += `<div class="w-3 h-3 ${colorClass} rounded-sm cursor-pointer heatmap-cell hover:ring-1 hover:ring-gray-300 transition-all flex-shrink-0"
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

// Format period label
function formatPeriodLabel(startDate, endDate, period) {
    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T00:00:00Z');

    const startMonth = start.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

    return `${startMonth} - ${endMonth}`;
}

// Navigate activity periods efficiently
async function changeActivityPeriod(direction) {
    const newPeriod = currentActivityPeriod + direction;

    // Check bounds
    if (currentActivityCache) {
        if (newPeriod > 0 || newPeriod < -currentActivityCache.max_periods) {
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
            tooltip.innerHTML = `
                <div class="font-medium">${count} post${count !== '1' ? 's' : ''}</div>
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

