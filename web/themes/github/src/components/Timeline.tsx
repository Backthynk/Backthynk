import { useRef } from 'preact/hooks';
import { useTimeline } from '@core/hooks/useTimeline';
import { getSpaceById, getSpaceBreadcrumb } from '@core/state';
import { Post } from './post';
import { VirtualScroller } from '@core/components/VirtualScroller';
import { styled, keyframes } from 'goober';
import { useLocation } from 'preact-iso';
import { navigateToSpace } from '@core/actions/spaceActions';

const fadeSlideIn = keyframes`
  0% {
    opacity: 0;
    transform: translateY(-10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
`;

const Container = styled('main')`
  min-height: 400px;

`;

const EmptyState = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 1rem;
  text-align: center;
  color: var(--text-secondary);

  i {
    font-size: 3rem;
    opacity: 0.3;
  }

  p {
    margin-top: 1rem;
    font-size: 0.875rem;
  }
`;

const PostsList = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 0;
`;

const LoadMoreSection = styled('div')`
  text-align: center;
  padding: 1rem 0;
`;

const LoadMoreText = styled('div')`
  color: var(--text-secondary);

  i {
    margin-right: 0.5rem;
  }
`;

const LoadMoreButton = styled('button')`
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  transition: all 0.2s ease;

  &:hover {
    background: var(--bg-hover);
  }
`;

interface TimelineProps {
  spaceId: number | null;
  recursive?: boolean;
}

// Context for passing timeline state to child components
export interface TimelineContext {
  spaceId: number | null;
  recursive: boolean;
}

const VIRTUAL_SCROLL_THRESHOLD = 999999; // Disabled - posts have variable heights

export function Timeline({ spaceId, recursive = false }: TimelineProps) {
  const containerRef = useRef<HTMLElement>(null);
  const location = useLocation();

  // Use the centralized timeline hook for all state management and data fetching
  const { posts: postsList, isLoading: loading, hasMore, loadMore } = useTimeline(spaceId, recursive);

  // Timeline context to pass to child components
  const timelineContext: TimelineContext = {
    spaceId,
    recursive,
  };


  // Show breadcrumbs when viewing all posts (no space selected) or in recursive mode
  const showBreadcrumbs = spaceId === null || recursive;

  // Navigate to a space when clicking on breadcrumb
  const handleBreadcrumbClick = (postSpaceId: number) => {
    const space = getSpaceById(postSpaceId);
    if (!space) return;

    navigateToSpace(space, location);
  };

  if (loading && postsList.length === 0) {
    return (
      <Container ref={containerRef}>
        <EmptyState>
          <i class="fas fa-spinner fa-spin" />
          <p>Loading posts...</p>
        </EmptyState>
      </Container>
    );
  }

  if (postsList.length === 0) {
    return (
      <Container ref={containerRef}>
        <EmptyState>
          <i class="fas fa-comment-slash" />
          <p>No posts yet</p>
        </EmptyState>
      </Container>
    );
  }

  // Use virtual scrolling for large lists
  const useVirtualScroll = postsList.length > VIRTUAL_SCROLL_THRESHOLD;

  if (useVirtualScroll) {
    return (
      <Container ref={containerRef}>
        <VirtualScroller
          items={postsList}
          itemHeight={200}
          renderItem={(post) => (
            <Post
              post={post}
              showSpaceBreadcrumb={showBreadcrumbs}
              spaceBreadcrumb={showBreadcrumbs ? getSpaceBreadcrumb(post.space_id) : undefined}
              onBreadcrumbClick={handleBreadcrumbClick}
              timelineContext={timelineContext}
            />
          )}
          onLoadMore={loadMore}
          hasMore={hasMore}
          buffer={5}
        />
      </Container>
    );
  }

  return (
    <Container ref={containerRef}>
      <PostsList>
        {postsList.map((post) => (
          <Post
            key={post.id}
            post={post}
            showSpaceBreadcrumb={showBreadcrumbs}
            spaceBreadcrumb={showBreadcrumbs ? getSpaceBreadcrumb(post.space_id) : undefined}
            onBreadcrumbClick={handleBreadcrumbClick}
            timelineContext={timelineContext}
          />
        ))}
      </PostsList>

      {/* Load more indicator */}
      {hasMore && (
        <LoadMoreSection>
          {loading ? (
            <LoadMoreText>
              <i class="fas fa-spinner fa-spin" />
              Loading more posts...
            </LoadMoreText>
          ) : (
            <LoadMoreButton onClick={loadMore}>Load more</LoadMoreButton>
          )}
        </LoadMoreSection>
      )}
    </Container>
  );
}
