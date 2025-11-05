import { useRef } from 'preact/hooks';
import { computed } from '@preact/signals';
import { spaces as spacesSignal, getRecursivePostCount, hasChildren, isRecursiveMode, toggleRecursiveMode } from '@core/state';
import type { Space } from '@core/api';
import { formatFileSize } from '@core/utils';
import { companionStyles } from '../../styles/companion';
import { TitleBreadcrumb } from '../shared/TitleBreadcrumb';

const Container = companionStyles.container;
const SearchContainer = companionStyles.searchContainer;
const SearchInput = companionStyles.searchInput;
const SpaceHeader = companionStyles.spaceHeader;
const HeaderContent = companionStyles.headerContent;
const TitleSection = companionStyles.titleSection;
const Stats = companionStyles.stats;
const Description = companionStyles.description;

interface CompanionPanelProps {
  space: Space | null;
}

export function CompanionPanel({ space }: CompanionPanelProps) {
  const headerRef = useRef<HTMLDivElement | null>(null);

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

  const canToggleRecursive = space ? hasChildren(space.id) : false;

  const handleTitleClick = () => {
    if (canToggleRecursive && space) {
      toggleRecursiveMode(space.id);
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
    <Container>
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
      <SpaceHeader style={{border: space && isRecursiveMode(space.id) ? '1px solid var(--accent-recursive)' : '1px solid var(--border-primary)'}} ref={headerRef} data-space-header class={isRecursiveMode(space?.id || 0) ? 'recursive-mode' : ''}>
        {/* Space Breadcrumb */}
        <div style={{ marginBottom: '12px' }}>
          <TitleBreadcrumb
            spaceId={space?.id || 0}
            size="large"
          />
        </div>

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
