import { useRef } from 'preact/hooks';
import { computed } from '@preact/signals';
import { spaces as spacesSignal, getRecursivePostCount, hasChildren, getDescendantSpaceIds, getSpaceById, isRecursiveMode } from '@core/state';
import type { Space } from '@core/api';
import { formatFileSize } from '@core/utils';
import { companionStyles } from '../../styles/companion';

const Container = companionStyles.container;
const SearchContainer = companionStyles.searchContainer;
const SearchInput = companionStyles.searchInput;
const SpaceHeader = companionStyles.spaceHeader;
const Breadcrumb = companionStyles.breadcrumb;
const HeaderContent = companionStyles.headerContent;
const TitleSection = companionStyles.titleSection;
const Stats = companionStyles.stats;
const Description = companionStyles.description;

interface CompanionPanelProps {
  space: Space | null;
  onRecursiveToggle?: () => void;
}

export function CompanionPanel({ space, onRecursiveToggle }: CompanionPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Calculate stats
  const stats = computed(() => {
    if (!space) {
      // "All Spaces" - sum everything
      const allSpaces = spacesSignal.value;
      const totalPosts = allSpaces.reduce((sum, s) => sum + (s.post_count || 0), 0);
      return {
        posts: totalPosts,
        files: 0,
        size: 0,
      };
    }

    // Individual space
    const posts = isRecursiveMode(space.id)
      ? getRecursivePostCount(space.id)
      : space.post_count || 0;

    return {
      posts,
      files: 0,
      size: 0,
    };
  });

  const canToggleRecursive = space && hasChildren(space.id);

  // Build breadcrumb for the space
  const buildBreadcrumb = () => {
    if (!space) {
      return (
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          All Spaces
        </span>
      );
    }

    // Build breadcrumb path from current space up to root
    const breadcrumbPath: Space[] = [];
    let current: Space | undefined = space;

    while (current) {
      breadcrumbPath.unshift(current);
      if (current.parent_id) {
        current = getSpaceById(current.parent_id);
      } else {
        current = undefined;
      }
    }

    const breadcrumbElements: any[] = [];

    if (breadcrumbPath.length > 2) {
      // Show "..." followed by the last 2 spaces
      const lastTwo = breadcrumbPath.slice(-2);
      breadcrumbElements.push(
        <span key="ellipsis" class="breadcrumb-link">...</span>
      );
      breadcrumbElements.push(
        <span key="sep-ellipsis" class="breadcrumb-separator">{'>'}</span>
      );

      lastTwo.forEach((s, index) => {
        const isLast = index === lastTwo.length - 1;
        if (isLast) {
          breadcrumbElements.push(
            <span key={`space-${s.id}`} style={{ fontWeight: 600 }}>{s.name}</span>
          );
        } else {
          breadcrumbElements.push(
            <span key={`space-${s.id}`} class="breadcrumb-link">{s.name}</span>
          );
          breadcrumbElements.push(
            <span key={`sep-${s.id}`} class="breadcrumb-separator">{'>'}</span>
          );
        }
      });
    } else {
      // Show all spaces if depth <= 2
      breadcrumbPath.forEach((s, index) => {
        const isLast = index === breadcrumbPath.length - 1;
        if (isLast) {
          breadcrumbElements.push(
            <span key={`space-${s.id}`} style={{ fontWeight: 600 }}>{s.name}</span>
          );
        } else {
          breadcrumbElements.push(
            <span key={`space-${s.id}`} class="breadcrumb-link">{s.name}</span>
          );
          breadcrumbElements.push(
            <span key={`sep-${s.id}`} class="breadcrumb-separator">{'>'}</span>
          );
        }
      });
    }

    // Add recursive badge if in recursive mode
    if (isRecursiveMode(space.id) && recursiveBadgeData.value) {
      breadcrumbElements.push(
        <span key="sep-recursive" class="breadcrumb-separator">/</span>
      );
      breadcrumbElements.push(
        <span key="recursive-badge" class="recursive-badge">
          {recursiveBadgeData.value.count}
        </span>
      );
    }

    return breadcrumbElements;
  };

  // Calculate recursive badge data
  const recursiveBadgeData = computed(() => {
    if (!space || !isRecursiveMode(space.id)) return null;

    const descendantIds = getDescendantSpaceIds(space.id);
    const descendants = spacesSignal.value.filter(s => descendantIds.includes(s.id));

    if (descendants.length === 0) return null;

    const displayCount = descendants.length > 9 ? '9+' : descendants.length.toString();

    // Build tooltip with space names
    const maxDisplay = 9;
    const spacesToShow = descendants.slice(0, maxDisplay);
    const remaining = descendants.length - maxDisplay;

    let tooltipLines = [`Exploring recursively:\n${space.name}`];
    spacesToShow.forEach(s => {
      tooltipLines.push(`  • ${s.name}`);
    });
    if (remaining > 0) {
      tooltipLines.push(`  ...and ${remaining} more`);
    }

    return {
      count: displayCount,
      tooltip: tooltipLines.join('\n'),
    };
  });

  const handleTitleClick = () => {
    if (canToggleRecursive && onRecursiveToggle) {
      onRecursiveToggle();

      // Trigger animation using querySelector since styled components may not forward refs properly
      setTimeout(() => {
        const header = containerRef.current?.querySelector('[data-space-header]');
        if (header) {
          header.classList.add('animating');
          setTimeout(() => {
            header.classList.remove('animating');
          }, 600);
        }
      }, 0);
    }
  };

  const formattedStats = computed(() => {
    const s = stats.value;
    const parts = [`${s.posts} post${s.posts !== 1 ? 's' : ''}`];

    if (s.files > 0) {
      parts.push(`${s.files} file${s.files !== 1 ? 's' : ''}`);
    }

    if (s.size > 0) {
      parts.push(formatFileSize(s.size));
    }

    return parts.join(' • ');
  });

  return (
    <Container ref={containerRef}>
      {/* Search Input */}
      <SearchContainer>
        <SearchInput
          type="text"
          placeholder="Coming soon..."
          disabled
          readonly
        />
      </SearchContainer>

      {/* Space Info Card */}
      <SpaceHeader data-space-header>
        {/* Space Breadcrumb */}
        <Breadcrumb
          onClick={handleTitleClick}
          style={{ cursor: canToggleRecursive ? 'pointer' : 'default' }}
        >
          {buildBreadcrumb()}
        </Breadcrumb>

        <HeaderContent>
          <TitleSection>
            <Stats>{formattedStats.value}</Stats>
          </TitleSection>
        </HeaderContent>

        {space?.description && space.description.trim() && (
          <Description>
            "{space.description.trim()}"
          </Description>
        )}
      </SpaceHeader>
    </Container>
  );
}
