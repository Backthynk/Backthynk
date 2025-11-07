import { useState } from 'preact/hooks';
import { computed } from '@preact/signals';
import { spaces as spacesSignal, isEligibleForRecursive, getEarliestSpaceCreationDate } from '@core/state';
import type { Space } from '@core/api';
import { formatFullDateTime } from '@core/utils/date';
import { useTooltip } from '@core/components';
import { deleteSpaceAction, toggleRecursiveMode } from '@core/actions/spaceActions';
import { companionStyles } from '../../styles/companion';
import { TitleBreadcrumb } from '../shared/TitleBreadcrumb';
import { SpaceActionMenu } from './SpaceActionMenu';
import { UpdateSpaceModal } from '../spaces-container/UpdateSpaceModal';
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
  const [isHovering, setIsHovering] = useState(false);
  const [isCardHovering, setIsCardHovering] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const { show, hide, TooltipPortal } = useTooltip();

  // Get creation date - either from selected space or earliest space
  const creationDate = computed(() => {
    if (space?.created) {
      return space.created;
    }
    return getEarliestSpaceCreationDate();
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

  const handleDelete = async () => {
    if (!space) return;

    await deleteSpaceAction({
      spaceId: space.id,
      spaceName: space.name,
    });
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
          space={space}
        />
      )}
    </>
  );
}
