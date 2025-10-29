import { useEffect } from 'preact/hooks';
import { posts, resetPosts, appendPosts, isLoadingPosts } from '@core/state';
import { fetchPosts } from '@core/api';
import { timelineStyles } from '../styles/timeline';

interface TimelineProps {
  spaceId: number | null;
}

export function Timeline({ spaceId }: TimelineProps) {
  useEffect(() => {
    if (!spaceId) {
      resetPosts();
      return;
    }

    isLoadingPosts.value = true;
    fetchPosts(spaceId, 50, 0, true, false)
      .then((result) => {
        resetPosts();
        appendPosts(result.posts, result.has_more);
      })
      .finally(() => {
        isLoadingPosts.value = false;
      });
  }, [spaceId]);

  const postsList = posts.value;
  const loading = isLoadingPosts.value;

  if (!spaceId) {
    return (
      <main class={timelineStyles.timeline}>
        <div class={timelineStyles.empty}>
          <i class="fas fa-folder-open" style={{ fontSize: '3rem', opacity: 0.3 }} />
          <p>Select a space to view posts</p>
        </div>
      </main>
    );
  }

  if (loading && postsList.length === 0) {
    return (
      <main class={timelineStyles.timeline}>
        <div class={timelineStyles.loading}>
          <i class="fas fa-spinner fa-spin" style={{ fontSize: '2rem' }} />
          <p>Loading posts...</p>
        </div>
      </main>
    );
  }

  if (postsList.length === 0) {
    return (
      <main class={timelineStyles.timeline}>
        <div class={timelineStyles.empty}>
          <i class="fas fa-comment-slash" style={{ fontSize: '3rem', opacity: 0.3 }} />
          <p>No posts yet</p>
        </div>
      </main>
    );
  }

  return (
    <main class={timelineStyles.timeline}>
      {postsList.map((post) => (
        <article key={post.id} class={timelineStyles.post}>
          <div class={timelineStyles.postContent}>{post.content}</div>
          <div class={timelineStyles.postMeta}>
            <span>{new Date(post.created_at * 1000).toLocaleString()}</span>
          </div>
        </article>
      ))}
    </main>
  );
}
