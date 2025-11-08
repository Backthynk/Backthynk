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
const LoadingOverlay = companionStyles.loadingOverlay;
const Spinner = companionStyles.spinner;
const StatsContent = companionStyles.statsContent;

interface StatsCardProps {
  space: Space | null;
}

export function StatsCard({ space }: StatsCardProps) {
  const { show, hide, TooltipPortal } = useTooltip();

  const spaceStatsEnabled = clientConfig.value.space_stats;

  // Don't render if space stats are disabled
  if (!spaceStatsEnabled) {
    return null;
  }

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

  // Don't render if there are no posts or subspaces
  if (postCount.value === 0 && subspaceCount.value === 0) {
    return null;
  }

  // Fetch space stats when space changes or recursive mode changes
  // Only fetch if there are posts to avoid unnecessary requests
  useEffect(() => {
    if (postCount.value === 0) {
      return;
    }

    if (!space) {
      // Fetch global stats (id=0)
      getOrFetchSpaceStats(0, false);
    } else {
      const recursive = isRecursiveMode(space.id);
      getOrFetchSpaceStats(space.id, recursive);
    }
  }, [space?.id, space ? isRecursiveMode(space.id) : false, postCount.value]);

  // Get file stats
  const fileStats = computed(() => {
    // Return 0s if no posts (don't fetch)
    if (postCount.value === 0) {
      return {
        count: 0,
        size: 0,
      };
    }

    const spaceStatsData = !space
      ? getSpaceStats(0, false)
      : getSpaceStats(space.id, isRecursiveMode(space.id));

    return {
      count: spaceStatsData?.file_count || 0,
      size: spaceStatsData?.total_size || 0,
    };
  });

  const isRecursive = !!(space && isRecursiveMode(space.id));
  const loading = computed(() => {
    // Don't show loading if no posts
    if (postCount.value === 0) {
      return false;
    }

    const spaceId = space?.id || 0;
    const recursive = !space ? false : isRecursiveMode(space?.id || 0);
    const isLoading = isLoadingStats(spaceId, recursive);
    const hasStats = getSpaceStats(spaceId, recursive);
    // Show loading if actively loading OR if we have no stats yet
    return isLoading || !hasStats;
  });

  // Calculate minimum height based on stat item content
  // Height = padding (14px top + 14px bottom) + label (~13px) + gap (4px) + value (~24px) = ~59px
  const MIN_HEIGHT = 59;

  return (
    <StatsCardContainer>
      {/* Always render content with 0 values to maintain size */}
      <StatsContent minHeight={MIN_HEIGHT}>
        {/* Post Count */}
        <StatItem>
          <StatLabel>Posts</StatLabel>
          <StatValue isRecursive={isRecursive}>{postCount.value}</StatValue>
        </StatItem>

        {/* Subspace Count */}
        <StatItem>
          <StatLabel>Spaces</StatLabel>
          <StatValue isRecursive={isRecursive}>{subspaceCount.value}</StatValue>
        </StatItem>

        {/* File Stats */}
        <StatItem
          onMouseEnter={(e) => {
            if (!loading.value && fileStats.value.size > 0) {
              show(e.currentTarget as HTMLElement, `Total file size: ${formatFileSize(fileStats.value.size)}`);
            }
          }}
          onMouseLeave={hide}
        >
          <StatLabel>Files</StatLabel>
          <StatValue isRecursive={isRecursive}>
            {fileStats.value.count}
          </StatValue>
        </StatItem>
      </StatsContent>

      {/* Loading overlay on top to maintain size */}
      {loading.value && (
        <LoadingOverlay minHeight={MIN_HEIGHT}>
          <Spinner />
        </LoadingOverlay>
      )}

      {TooltipPortal}
    </StatsCardContainer>
  );
}
