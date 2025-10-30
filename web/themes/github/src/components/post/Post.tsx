import { useState } from 'preact/hooks';
import type { Post as PostType } from '@core/api';
import { formatRelativeDate, formatFullDateTime } from '@core/utils/date';
import { FileAttachments } from './FileAttachments';
import { LinkPreviews } from './LinkPreviews';
import { PostActionMenu } from './PostActionMenu';
import { postStyles } from '../../styles/post';

const Article = postStyles.article;
const Header = postStyles.header;
const HeaderLeft = postStyles.headerLeft;
const Breadcrumb = postStyles.breadcrumb;
const Timestamp = postStyles.timestamp;
const TimestampText = postStyles.timestampText;
const TimestampTooltip = postStyles.timestampTooltip;
const ActionButton = postStyles.actionButton;
const Content = postStyles.content;

interface PostProps {
  post: PostType;
  showSpaceBreadcrumb?: boolean;
  spaceBreadcrumb?: string;
  onBreadcrumbClick?: (spaceId: number) => void;
  onDelete?: (postId: number) => void;
  onMove?: (postId: number) => void;
}

export function Post({ post, showSpaceBreadcrumb, spaceBreadcrumb, onBreadcrumbClick, onDelete, onMove }: PostProps) {
  const [showMenu, setShowMenu] = useState(false);

  // Backend can return either 'files' or 'attachments'
  const files = post.files || post.attachments || [];
  const hasAttachments = files.length > 0;
  const hasLinkPreviews = post.link_previews && post.link_previews.length > 0;
  const isTextOnly = !hasAttachments && !hasLinkPreviews;

  // Check if content is link-only (only contains a single URL and whitespace)
  const urlRegex = /https?:\/\/\S+/g;
  const urlMatches = post.content.match(urlRegex);
  const isLinkOnly = urlMatches && urlMatches.length === 1 && post.content.trim() === urlMatches[0];
  const shouldHideContent = isLinkOnly && hasLinkPreviews;

  return (
    <Article data-post-id={post.id}>
      {/* Header */}
      <Header class={isTextOnly ? '' : 'with-content'}>
        <HeaderLeft>
          {showSpaceBreadcrumb && spaceBreadcrumb && (
            <Breadcrumb onClick={() => onBreadcrumbClick?.(post.space_id)}>
              {spaceBreadcrumb}
            </Breadcrumb>
          )}
          <Timestamp>
            <TimestampText>{formatRelativeDate(post.created)}</TimestampText>
            <TimestampTooltip>{formatFullDateTime(post.created)}</TimestampTooltip>
          </Timestamp>
        </HeaderLeft>

        {/* Action menu */}
        <div style={{ position: 'relative' }}>
          <ActionButton onClick={() => setShowMenu(!showMenu)}>
            <i class="fas fa-ellipsis-h" />
          </ActionButton>
          {showMenu && (
            <PostActionMenu
              postId={post.id}
              onClose={() => setShowMenu(false)}
              onDelete={onDelete}
              onMove={onMove}
            />
          )}
        </div>
      </Header>

      {/* Content */}
      {!shouldHideContent && (
        <Content style={{ marginBottom: isTextOnly ? '0' : '1rem' }}>
          {post.content.trim()}
        </Content>
      )}

      {/* Link Previews (show if no attachments) */}
      {!hasAttachments && hasLinkPreviews && (
        <LinkPreviews previews={post.link_previews!} postId={post.id} />
      )}

      {/* File Attachments */}
      {hasAttachments && <FileAttachments files={files} />}
    </Article>
  );
}
