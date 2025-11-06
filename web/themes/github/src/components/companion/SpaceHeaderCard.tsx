import { useRef, useState, useEffect } from 'preact/hooks';
import { computed } from '@preact/signals';
import { spaces as spacesSignal, isRecursiveMode } from '@core/state';
import type { Space, SpaceStats } from '@core/api';
import { fetchSpaceStats } from '@core/api';
import { formatFileSize } from '@core/utils';
import { formatFullDateTime } from '@core/utils/date';
import { clientConfig } from '@core/state/settings';
import { useTooltip } from '@core/components';
import { companionStyles } from '../../styles/companion';
import { TitleBreadcrumb } from '../shared/TitleBreadcrumb';

const SpaceHeader = companionStyles.spaceHeader;
const HeaderContent = companionStyles.headerContent;
const TitleSection = companionStyles.titleSection;
const Description = companionStyles.description;

interface SpaceHeaderCardProps {
  space: Space | null;
}

export function SpaceHeaderCard({ space }: SpaceHeaderCardProps) {
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [spaceStats, setSpaceStats] = useState<SpaceStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const { show, hide, TooltipPortal } = useTooltip();

  // Fetch space stats when space changes or recursive mode changes
  useEffect(() => {
    const spaceStatsEnabled = clientConfig.value.space_stats;

    if (!spaceStatsEnabled) {
      setSpaceStats(null);
      setLoadingStats(false);
      return;
    }

    setLoadingStats(true);

    if (!space) {
      // Fetch global stats (id=0)
      fetchSpaceStats(0, false)
        .then(stats => {
          setSpaceStats(stats);
          setLoadingStats(false);
        })
        .catch(err => {
          console.error('Failed to fetch global stats:', err);
          setLoadingStats(false);
        });
    } else {
      const recursive = isRecursiveMode(space.id);
      fetchSpaceStats(space.id, recursive)
        .then(stats => {
          setSpaceStats(stats);
          setLoadingStats(false);
        })
        .catch(err => {
          console.error('Failed to fetch space stats:', err);
          setLoadingStats(false);
        });
    }
  }, [space?.id, space && isRecursiveMode(space.id)]);

  // Calculate stats
  const stats = computed(() => {
    if (!space) {
      // "All Spaces" - sum everything
      const allSpaces = spacesSignal.value;
      const totalPosts = allSpaces.reduce((sum, s) => sum + (s.post_count || 0), 0);
      return {
        posts: totalPosts,
        files: spaceStats?.file_count || 0,
        size: spaceStats?.total_size || 0,
      };
    }

    // Individual space
    const posts = isRecursiveMode(space.id)
      ? space.recursive_post_count || 0
      : space.post_count || 0;

    return {
      posts,
      files: spaceStats?.file_count || 0,
      size: spaceStats?.total_size || 0,
    };
  });

  // Calculate individual stat values
  const postCount = computed(() => {
    if (!space) {
      const allSpaces = spacesSignal.value;
      return allSpaces.reduce((sum, s) => sum + (s.post_count || 0), 0);
    }
    return isRecursiveMode(space.id)
      ? space.recursive_post_count || 0
      : space.post_count || 0;
  });

  const fileStats = computed(() => {
    const s = stats.value;
    return {
      count: s.files,
      size: s.size,
    };
  });

  // Get creation date - either from selected space or earliest space
  const creationDate = computed(() => {
    if (space?.created) {
      return space.created;
    }
    // When no space is selected, find the earliest created space
    const allSpaces = spacesSignal.value;
    if (allSpaces.length === 0) return null;

    const earliestSpace = allSpaces.reduce((earliest, current) => {
      if (!earliest || current.created < earliest.created) {
        return current;
      }
      return earliest;
    });

    return earliestSpace.created;
  });

  // Format creation date for display
  const formattedCreationDate = creationDate.value
    ? new Date(creationDate.value).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  // Format full timestamp for tooltip
  const creationTimestamp = creationDate.value
    ? formatFullDateTime(creationDate.value / 1000)
    : null;

  return (
    <>
      <SpaceHeader className={space && isRecursiveMode(space.id) ? "recursive" : ""}>
        {/* Space Breadcrumb */}
        <div style={{ marginBottom: '12px' }}>
          <TitleBreadcrumb
            spaceId={space?.id || 0}
            size="large"
          />
        </div>

        <HeaderContent style={{ marginBottom: space?.description?.trim() ? '8px' : '0' }}>
          <TitleSection>
            {/* Post Count and File Stats Line */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginBottom: '8px',
              fontSize: '13px',
              color: 'var(--text-secondary)',
            }}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="currentColor"
                style={{ flexShrink: 0, opacity: 0.7 }}
              >
                <path d="M1.5 1.75V13.5h13.75a.75.75 0 0 1 0 1.5H.75a.75.75 0 0 1-.75-.75V1.75a.75.75 0 0 1 1.5 0Zm14.28 2.53-5.25 5.25a.75.75 0 0 1-1.06 0L7 7.06 4.28 9.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.25-3.25a.75.75 0 0 1 1.06 0L10 7.94l4.72-4.72a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"></path>
              </svg>
              <span>{postCount.value} post{postCount.value !== 1 ? 's' : ''}</span>

              {/* File stats inline - only show if loading or has files */}
              {clientConfig.value.space_stats && (loadingStats || fileStats.value.count > 0) && (
                <>
                  <span style={{ fontSize: '11px', opacity: 0.7, marginLeft: 2 }}>
                    {loadingStats ? (
                      '(loading...)'
                    ) : (
                      `(${fileStats.value.count} file${fileStats.value.count !== 1 ? 's' : ''}`
                    )}
                  </span>
                  {!loadingStats && fileStats.value.count > 0 && (
                    <>
                      <span style={{ opacity: 0.5 }}>/</span>
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>
                        {formatFileSize(fileStats.value.size)})
                      </span>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Creation Date Line */}
            {formattedCreationDate && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  style={{ flexShrink: 0, opacity: 0.7 }}
                >
                  <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z"></path>
                </svg>
                <span
                  style={{ cursor: 'default' }}
                  onMouseEnter={(e: any) => show(e.currentTarget as HTMLElement, creationTimestamp || '')}
                  onMouseLeave={hide}
                >
                  {formattedCreationDate}
                </span>
              </div>
            )}
          </TitleSection>
        </HeaderContent>

        {space?.description && space.description.trim() && (
          <Description>
            "{space.description.trim()}"
          </Description>
        )}
      </SpaceHeader>

      {/* Tooltip */}
      {TooltipPortal}
    </>
  );
}
