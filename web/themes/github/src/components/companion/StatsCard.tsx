import { computed } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { Space } from '@core/api';
import { formatFileSize } from '@core/utils';
import {
  getTotalPostCount,
  getSpacePostCount,
  getOrFetchSpaceStats,
  getSpaceStats,
  isLoadingStats,
  isRecursiveMode,
  getChildSpaces
} from '@core/state';
import { clientConfig } from '@core/state/settings';
import { companionStyles } from '../../styles/companion';

const StatsCardContainer = companionStyles.statsCard;
const StatItem = companionStyles.statItem;
const StatIcon = companionStyles.statIcon;
const StatLabel = companionStyles.statLabel;
const StatValue = companionStyles.statValue;

interface StatsCardProps {
  space: Space | null;
}

export function StatsCard({ space }: StatsCardProps) {
  // Fetch space stats when space changes or recursive mode changes
  useEffect(() => {
    const spaceStatsEnabled = clientConfig.value.space_stats;

    if (!spaceStatsEnabled) {
      return;
    }

    if (!space) {
      // Fetch global stats (id=0)
      getOrFetchSpaceStats(0, false);
    } else {
      const recursive = isRecursiveMode(space.id);
      getOrFetchSpaceStats(space.id, recursive);
    }
  }, [space?.id, space && isRecursiveMode(space.id)]);

  // Calculate post count
  const postCount = computed(() => {
    if (!space) {
      return getTotalPostCount();
    }
    return getSpacePostCount(space);
  });

  // Calculate subspace count
  const subspaceCount = computed(() => {
    if (!space) {
      return 0; // "All Spaces" doesn't show subspace count
    }

    const directChildren = getChildSpaces(space.id);
    return directChildren.length;
  });

  // Get file stats
  const fileStats = computed(() => {
    const spaceStatsData = !space
      ? getSpaceStats(0, false)
      : getSpaceStats(space.id, isRecursiveMode(space.id));

    return {
      count: spaceStatsData?.file_count || 0,
      size: spaceStatsData?.total_size || 0,
    };
  });

  const isRecursive = !!(space && isRecursiveMode(space.id));
  const loading = isLoadingStats(space?.id || 0, !space ? false : isRecursiveMode(space?.id || 0));
  const spaceStatsEnabled = clientConfig.value.space_stats;

  // Check if we should show the files stat
  const showFiles = spaceStatsEnabled && (loading || fileStats.value.count > 0);

  // Check if all stats are 0 - if so, don't render anything
  const hasAnyStats = postCount.value > 0 || subspaceCount.value > 0 || (showFiles && (loading || fileStats.value.count > 0));

  if (!hasAnyStats) {
    return null;
  }

  return (
    <StatsCardContainer>
      {/* Post Count - only show if > 0 */}
      {postCount.value > 0 && (
        <StatItem>
          <StatIcon>
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M1.5 1.75V13.5h13.75a.75.75 0 0 1 0 1.5H.75a.75.75 0 0 1-.75-.75V1.75a.75.75 0 0 1 1.5 0Zm14.28 2.53-5.25 5.25a.75.75 0 0 1-1.06 0L7 7.06 4.28 9.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.25-3.25a.75.75 0 0 1 1.06 0L10 7.94l4.72-4.72a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"></path>
            </svg>
          </StatIcon>
          <StatLabel>Posts</StatLabel>
          <StatValue isRecursive={isRecursive}>{postCount.value}</StatValue>
        </StatItem>
      )}

      {/* Subspace Count - only show for individual spaces and if > 0 */}
      {space && subspaceCount.value > 0 && (
        <StatItem>
          <StatIcon>
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25Z"></path>
            </svg>
          </StatIcon>
          <StatLabel>Spaces</StatLabel>
          <StatValue isRecursive={isRecursive}>{subspaceCount.value}</StatValue>
        </StatItem>
      )}

      {/* File Stats - only show if space_stats is enabled and (loading or has data) */}
      {showFiles && (
        <StatItem>
          <StatIcon>
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"></path>
            </svg>
          </StatIcon>
          <StatLabel>Files</StatLabel>
          <StatValue isRecursive={isRecursive}>
            {loading ? '...' : (
              <>
                {fileStats.value.count}
                <span style={{
                  opacity: 0.6,
                  fontSize: '11px',
                  marginLeft: '4px'
                }}>
                  ({formatFileSize(fileStats.value.size)})
                </span>
              </>
            )}
          </StatValue>
        </StatItem>
      )}
    </StatsCardContainer>
  );
}
