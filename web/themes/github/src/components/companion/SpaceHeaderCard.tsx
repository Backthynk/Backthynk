import { useRef, useState, useEffect } from 'preact/hooks';
import { computed } from '@preact/signals';
import { spaces as spacesSignal, isRecursiveMode, toggleRecursiveMode, isEligibleForRecursive } from '@core/state';
import type { Space, SpaceStats } from '@core/api';
import { fetchSpaceStats, deleteSpace } from '@core/api';
import { formatFileSize } from '@core/utils';
import { formatFullDateTime } from '@core/utils/date';
import { clientConfig } from '@core/state/settings';
import { useTooltip, showSuccess, showError } from '@core/components';
import { companionStyles } from '../../styles/companion';
import { TitleBreadcrumb } from '../shared/TitleBreadcrumb';
import { SpaceActionMenu } from './SpaceActionMenu';
import { UpdateSpaceModal } from './UpdateSpaceModal';
import { ConfirmModal } from '../modal/ConfirmModal';
import { styled } from 'goober';

const SpaceHeader = companionStyles.spaceHeader;
const HeaderContent = companionStyles.headerContent;
const TitleSection = companionStyles.titleSection;
const Description = companionStyles.description;

const MenuButton = styled('button')`
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0;

  &:hover {
    background: var(--bg-hover);
    border-color: var(--border-primary);
    color: var(--text-primary);
  }

  i {
    font-size: 14px;
  }
`;

interface SpaceHeaderCardProps {
  space: Space | null;
}

export function SpaceHeaderCard({ space }: SpaceHeaderCardProps) {
  const [spaceStats, setSpaceStats] = useState<SpaceStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isCardHovering, setIsCardHovering] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

  const canToggleRecursive = isEligibleForRecursive(space?.id);

  const handleCardClick = () => {
    if (canToggleRecursive && space) {
      toggleRecursiveMode(space.id);
    }
  };

  const handleMenuButtonClick = (e: MouseEvent) => {
    e.stopPropagation();
    const button = e.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    setMenuPosition({
      x: rect.right - 8,
      y: rect.bottom + 4,
    });
  };

  const handleEnableRecursive = (spaceId: number) => {
    const targetSpace = spacesSignal.value.find((s) => s.id === spaceId);
    if (targetSpace && isEligibleForRecursive(targetSpace.id)) {
      toggleRecursiveMode(targetSpace.id);
    }
  };

  const handleUpdate = (spaceId: number) => {
    setShowUpdateModal(true);
  };

  const handleDelete = async (spaceId: number) => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!space) return;

    try {
      await deleteSpace(space.id);
      // Update local state
      spacesSignal.value = spacesSignal.value.filter((s) => s.id !== space.id);
      showSuccess(`Space "${space.name}" deleted successfully!`);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Failed to delete space:', error);
      showError('Failed to delete space. Please try again.');
    }
  };

  const handleModalSuccess = () => {
    // Refetch stats after successful update
    if (space) {
      const recursive = isRecursiveMode(space.id);
      fetchSpaceStats(space.id, recursive)
        .then(stats => {
          setSpaceStats(stats);
        })
        .catch(err => {
          console.error('Failed to fetch space stats:', err);
        });
    }
  };

  return (
    <>
      <SpaceHeader
        onClick={handleCardClick}
        style={{
          cursor: canToggleRecursive ? 'pointer' : 'default',
          position: 'relative',
        }}
        onMouseEnter={() => {
          if (canToggleRecursive) {
            setIsHovering(true);
          }
          setIsCardHovering(true);
        }}
        onMouseLeave={() => {
          if (canToggleRecursive) {
            setIsHovering(false);
          }
          setIsCardHovering(false);
        }}
      >
        {/* Three-dot menu button - only show for actual spaces, not "All Spaces" */}
        {space && (
          <MenuButton
            onClick={handleMenuButtonClick}
            style={{
              opacity: isCardHovering ? 1 : 0,
            }}
          >
            <i class="fas fa-ellipsis-h" />
          </MenuButton>
        )}
        {/* Space Breadcrumb */}
        <div style={{ marginBottom: '12px' }}>
          <TitleBreadcrumb
            spaceId={space?.id || 0}
            size="large"
            showBadgeOnHover={canToggleRecursive && isHovering}
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
              color: space && isRecursiveMode(space.id) ? 'var(--recursive-text)' : 'var(--text-secondary)',
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
                      ''
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

      {/* Space Action Menu */}
      {menuPosition && space && (
        <SpaceActionMenu
          spaceId={space.id}
          x={menuPosition.x}
          y={menuPosition.y}
          onClose={() => setMenuPosition(null)}
          onEnableRecursive={handleEnableRecursive}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}

      {/* Update Space Modal */}
      {showUpdateModal && space && (
        <UpdateSpaceModal
          isOpen={showUpdateModal}
          onClose={() => setShowUpdateModal(false)}
          onSuccess={handleModalSuccess}
          space={space}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && space && (
        <ConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={confirmDelete}
          title="Delete Space"
          message={`Are you sure you want to delete "${space.name}"? This action cannot be undone.`}
          confirmText="Delete"
          variant="danger"
        />
      )}
    </>
  );
}
