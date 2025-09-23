// Activity tracking and heatmap functions

// Helper function to fetch all posts for activity tracking
async function fetchAllPostsForActivity(categoryId) {
    let allPosts = [];
    let offset = 0;
    const limit = 100; // Fetch in batches
    let hasMore = true;

    while (hasMore) {
        try {
            const response = await fetchPosts(categoryId, limit, offset, true);
            const posts = response.posts || response;

            if (posts.length === 0) {
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
            console.error('Error fetching posts for activity:', error);
            break;
        }
    }

    return allPosts;
}
async function generateActivityHeatmap() {
    if (!currentCategory) {
        document.getElementById('activity-container').style.display = 'none';
        return;
    }

    document.getElementById('activity-container').style.display = 'block';

    try {
        // Fetch all posts for activity tracking - we need all posts for the heatmap
        const allPosts = await fetchAllPostsForActivity(currentCategory.id);

        if (allPosts.length === 0) {
            // Hide the entire activity container for empty categories
            document.getElementById('activity-container').style.display = 'none';
            return;
        }

        // Find the earliest post date
        const earliestPost = new Date(Math.min(...allPosts.map(post => new Date(post.created))));
        const today = new Date();

        // Calculate how many 6-month periods we need to go back to include the earliest post
        const monthsDiff = (today.getFullYear() - earliestPost.getFullYear()) * 12 + (today.getMonth() - earliestPost.getMonth());
        const maxPeriods = Math.ceil(monthsDiff / 6);

        // Always start at current period (0) by default - don't change currentActivityPeriod on first load

        const activityMap = {};
        allPosts.forEach(post => {
            const date = new Date(post.created);
            const dateKey = date.toISOString().split('T')[0];
            activityMap[dateKey] = (activityMap[dateKey] || 0) + 1;
        });

        generateHeatmapForPeriod(activityMap, maxPeriods);

    } catch (error) {
        generateHeatmapForPeriod({}, 0);
    }
}

function generateHeatmapForPeriod(activityMap, maxPeriods) {
    const today = new Date();
    let periodStart, periodEnd;

    // Calculate period dates
    if (currentActivityPeriod === 0) {
        // For current period, show last 6 months up to today
        periodEnd = new Date(today);
        periodEnd.setDate(periodEnd.getDate() + 1); // Include today

        periodStart = new Date(today);
        periodStart.setMonth(today.getMonth() - 5); // 6 months total (current + 5 back)
        periodStart.setDate(1);
    } else {
        // For historical periods, calculate continuous 6-month windows going backwards
        // currentActivityPeriod = -1 should be the 6 months before the current period

        // Current period ends today, starts 6 months back
        const currentPeriodStart = new Date(today);
        currentPeriodStart.setMonth(today.getMonth() - 5);
        currentPeriodStart.setDate(1);

        // Each previous period is 6 months before the previous one
        periodStart = new Date(currentPeriodStart);
        periodStart.setMonth(currentPeriodStart.getMonth() + (6 * currentActivityPeriod));
        periodStart.setDate(1);

        periodEnd = new Date(periodStart);
        periodEnd.setMonth(periodStart.getMonth() + 6);
    }

    // Update period label
    const startMonth = periodStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const endMonth = currentActivityPeriod === 0
        ? today.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : new Date(periodEnd.getTime() - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    document.getElementById('activity-period').textContent = `${startMonth} - ${endMonth}`;

    // Generate all days in the period
    const days = [];
    const currentDate = new Date(periodStart);

    while (currentDate < periodEnd) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const count = activityMap[dateKey] || 0;
        const intensity = getIntensityLevel(count);

        days.push({
            date: dateKey,
            count: count,
            intensity: intensity,
            month: currentDate.getMonth(),
            day: currentDate.getDate()
        });

        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calculate dynamic squares per row
    const squaresPerRow = 12; // Fixed number that works well for sidebar
    const rows = Math.ceil(days.length / squaresPerRow);

    let html = '<div class="space-y-1">';
    let lastMonthShown = -1;

    for (let row = 0; row < rows; row++) {
        const startIndex = row * squaresPerRow;
        const endIndex = Math.min(startIndex + squaresPerRow, days.length);

        // Get the first day of this row to determine month label
        const firstDay = days[startIndex];
        const currentMonth = firstDay ? firstDay.month : -1;

        // Only show month label when it changes
        let monthLabel = '';
        if (currentMonth !== lastMonthShown) {
            monthLabel = new Date(firstDay.date).toLocaleDateString('en-US', { month: 'short' });
            lastMonthShown = currentMonth;
        }

        html += '<div class="flex items-center">';

        // Month label aligned to the left (no margin-right)
        html += `<div class="w-8 text-xs text-gray-400 flex-shrink-0">${monthLabel}</div>`;

        // Squares row starting right after month label
        html += '<div class="flex gap-1">';

        for (let i = startIndex; i < endIndex; i++) {
            if (i < days.length) {
                const day = days[i];
                const colorClass = getColorClass(day.intensity);
                html += `<div class="w-3 h-3 ${colorClass} rounded-sm cursor-pointer heatmap-cell hover:ring-1 hover:ring-gray-300 transition-all flex-shrink-0"
                             data-date="${day.date}"
                             data-count="${day.count}"
                             data-day="${new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}">
                         </div>`;
            }
        }

        html += '</div></div>';
    }

    html += '</div>';
    document.getElementById('activity-heatmap').innerHTML = html;

    // Update summary
    const totalPosts = days.reduce((sum, day) => sum + day.count, 0);
    const activeDays = days.filter(day => day.count > 0).length;
    document.getElementById('activity-summary').textContent = `${totalPosts} posts on ${activeDays} days`;

    // Update navigation buttons
    document.getElementById('activity-next').disabled = currentActivityPeriod >= 0;
    document.getElementById('activity-prev').disabled = currentActivityPeriod <= -maxPeriods;

    addHeatmapTooltips();
}

function changeActivityPeriod(direction) {
    currentActivityPeriod += direction;
    generateActivityHeatmap();
}

function getIntensityLevel(count) {
    if (count === 0) return 0;
    if (count === 1) return 1;
    if (count <= 3) return 2;
    if (count <= 5) return 3;
    return 4;
}

function getColorClass(intensity) {
    const colors = [
        'bg-gray-100',      // 0 posts
        'bg-green-200',     // 1 post
        'bg-green-400',     // 2-3 posts
        'bg-green-600',     // 4-5 posts
        'bg-green-800'      // 6+ posts
    ];
    return colors[intensity] || colors[0];
}

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

            // Position tooltip to the right, or left if no space
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