import type { Space } from '@core/api';
import { formatFileSize } from '@core/utils';
import { useStatsCard } from '@core/hooks/useStatsCard';
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
  const stats = useStatsCard(space);

  // Don't render if stats should not be shown (disabled or no data)
  if (!stats.shouldShow) {
    return null;
  }

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
          <StatValue isRecursive={stats.isRecursive}>{stats.postCount}</StatValue>
        </StatItem>

        {/* Subspace Count */}
        <StatItem>
          <StatLabel>Spaces</StatLabel>
          <StatValue isRecursive={stats.isRecursive}>{stats.subspaceCount}</StatValue>
        </StatItem>

        {/* File Stats */}
        <StatItem
          onMouseEnter={(e) => {
            if (!stats.isLoading && stats.fileSize > 0) {
              show(e.currentTarget as HTMLElement, `Total file size: ${formatFileSize(stats.fileSize)}`);
            }
          }}
          onMouseLeave={hide}
        >
          <StatLabel>Files</StatLabel>
          <StatValue isRecursive={stats.isRecursive}>
            {stats.fileCount}
          </StatValue>
        </StatItem>
      </StatsContent>

      {/* Loading overlay on top to maintain size */}
      {stats.isLoading && (
        <LoadingOverlay minHeight={MIN_HEIGHT}>
          <Spinner />
        </LoadingOverlay>
      )}

      {TooltipPortal}
    </StatsCardContainer>
  );
}
