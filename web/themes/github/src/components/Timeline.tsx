import { useEffect, useState, useRef } from 'preact/hooks';
import { posts, resetPosts, appendPosts, isLoadingPosts, hasMorePosts, spaces } from '@core/state';
import { fetchPosts, deletePost as deletePostApi } from '@core/api';
import { generateSlug } from '@core/utils';
import { Post } from './post';
import { VirtualScroller } from '@core/components/VirtualScroller';
import { styled, keyframes } from 'goober';
import { useLocation } from 'preact-iso';
import { posts as postsConfig } from '@core/config';

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

const VIRTUAL_SCROLL_THRESHOLD = 999999; // Disabled - posts have variable heights

export function Timeline({ spaceId, recursive = false }: TimelineProps) {
  const [offset, setOffset] = useState(0);
  const containerRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const prevRecursive = useRef(recursive);

  useEffect(() => {
    prevRecursive.current = recursive;

    resetPosts();
    isLoadingPosts.value = true;
    setOffset(0);

    // Pass null for spaceId to fetch all posts
    fetchPosts(spaceId, postsConfig.postsPerPage, 0, true, recursive)
      .then((result) => {
        appendPosts(result.posts, result.has_more);
        setOffset(result.posts.length);

      })
      .catch((error) => {
        console.error('Failed to fetch posts:', error);
      })
      .finally(() => {
        isLoadingPosts.value = false;
      });
  }, [spaceId, recursive]);

  const postsList = posts.value;
  const loading = isLoadingPosts.value;
  const hasMore = hasMorePosts.value;

  const loadMore = () => {
    if (loading || !hasMore) return;

    isLoadingPosts.value = true;
    fetchPosts(spaceId, postsConfig.postsPerPage, offset, true, recursive)
      .then((result) => {
        appendPosts(result.posts, result.has_more);
        setOffset(offset + result.posts.length);
      })
      .finally(() => {
        isLoadingPosts.value = false;
      });
  };

  const handleDelete = async (postId: number) => {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return;
    }

    try {
      await deletePostApi(postId);
      posts.value = posts.value.filter((p) => p.id !== postId);
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert('Failed to delete post. Please try again.');
    }
  };

  const handleMove = (postId: number) => {
    console.log('Move post:', postId);
    alert('Move functionality coming soon!');
  };

  // Helper to get space breadcrumb for a post
  const getSpaceBreadcrumb = (postSpaceId: number): string => {
    const space = spaces.value.find(s => s.id === postSpaceId);
    if (!space) return '';

    // Build breadcrumb by traversing parent hierarchy
    const breadcrumbs: string[] = [];
    let current = space;

    while (current) {
      breadcrumbs.unshift(current.name);
      if (current.parent_id === null) break;
      current = spaces.value.find(s => s.id === current.parent_id)!;
    }

    return breadcrumbs.join(' / ');
  };

  // Show breadcrumbs when viewing all posts (no space selected) or in recursive mode
  const showBreadcrumbs = spaceId === null || recursive;

  // Navigate to a space when clicking on breadcrumb
  const handleBreadcrumbClick = (postSpaceId: number) => {
    const space = spaces.value.find(s => s.id === postSpaceId);
    if (!space) return;

    // Build path by traversing parent hierarchy
    const pathSegments: string[] = [];
    let current = space;

    while (current) {
      pathSegments.unshift(generateSlug(current.name));
      if (current.parent_id === null) break;
      current = spaces.value.find(s => s.id === current.parent_id)!;
    }

    const path = '/' + pathSegments.join('/');
    location.route(path);
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
              onDelete={handleDelete}
              onMove={handleMove}
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
            onDelete={handleDelete}
            onMove={handleMove}
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
