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
  getChildSpaces,
  getDescendantSpaceIds,
  rootSpaces
} from '@core/state';
import { clientConfig } from '@core/state/settings';
import { useTooltip } from '@core/components/Tooltip';
import { companionStyles } from '../../styles/companion';

const StatsCardContainer = companionStyles.statsCard;
const StatItem = companionStyles.statItem;
const StatLabel = companionStyles.statLabel;
const StatValue = companionStyles.statValue;

interface StatsCardProps {
  space: Space | null;
}

export function StatsCard({ space }: StatsCardProps) {
  const { show, hide, TooltipPortal } = useTooltip();

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
  }, [space?.id, space ? isRecursiveMode(space.id) : false]);

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
      // When no space is selected, show count of root spaces
      return rootSpaces.value.length;
    }

    // When recursive mode is enabled, count all descendants recursively
    if (isRecursiveMode(space.id)) {
      const descendantIds = getDescendantSpaceIds(space.id);
      return descendantIds.length;
    }

    // Otherwise, count only direct children
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

  // Don't render if space stats are disabled
  if (!spaceStatsEnabled) {
    return null;
  }

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
          <StatLabel>Posts</StatLabel>
          <StatValue isRecursive={isRecursive}>{postCount.value}</StatValue>
        </StatItem>
      )}

      {/* Subspace Count - only show if > 0 */}
      {subspaceCount.value > 0 && (
        <StatItem>
          <StatLabel>Spaces</StatLabel>
          <StatValue isRecursive={isRecursive}>{subspaceCount.value}</StatValue>
        </StatItem>
      )}

      {/* File Stats - only show if space_stats is enabled and (loading or has data) */}
      {showFiles && (
        <StatItem
          onMouseEnter={(e) => {
            if (!loading && fileStats.value.size > 0) {
              show(e.currentTarget as HTMLElement, `Total file size: ${formatFileSize(fileStats.value.size)}`);
            }
          }}
          onMouseLeave={hide}
        >
          <StatLabel>Files</StatLabel>
          <StatValue isRecursive={isRecursive}>
            {loading ? '...' : fileStats.value.count}
          </StatValue>
        </StatItem>
      )}
      {TooltipPortal}
    </StatsCardContainer>
  );
}
