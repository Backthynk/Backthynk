import { type Post as PostType } from '@core/api';
import { Post } from '../../post-item/Post';

interface PostPreviewProps {
  post: PostType;
  hasContent: boolean;
}

export function PostPreview({ post, hasContent }: PostPreviewProps) {
  if (!hasContent) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem',
        color: 'var(--text-tertiary)',
        gap: '0.75rem'
      }}>
        <i class="fas fa-eye-slash" style={{ fontSize: '3rem' }} />
        <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Nothing to preview yet
        </p>
        <span style={{ fontSize: '13px', textAlign: 'center', maxWidth: '300px' }}>
          Start writing to see how your post will look
        </span>
      </div>
    );
  }

  return <Post post={post} />;
}
