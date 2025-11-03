import { useState, useMemo } from 'preact/hooks';
import type { Post as PostType } from '@core/api';
import { formatRelativeDate, formatFullDateTime } from '@core/utils/date';
import { FileAttachments } from './FileAttachments';
import { LinkPreviews } from './LinkPreviews';
import { ImageGallery } from './ImageGallery';
import { PostActionMenu } from './PostActionMenu';
import { postStyles } from '../../styles/post';
import { linkifyText, extractUrls } from '../../utils/linkify';
import { canRenderAsImage } from '@core/utils/files';
import { clientConfig } from '@core/state/settings';

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

  // Get preview supported formats from config
  const previewFormats = clientConfig.value.preview?.supported_formats || [];

  // Separate files that can render as images (native images + preview-supported files like PDFs)
  const images = useMemo(
    () => files.filter(f => canRenderAsImage(f.file_type, f.filename, previewFormats)),
    [files, previewFormats]
  );
  const otherFiles = useMemo(
    () => files.filter(f => !canRenderAsImage(f.file_type, f.filename, previewFormats)),
    [files, previewFormats]
  );
  const hasOnlyImages = hasAttachments && images.length > 0 && otherFiles.length === 0;

  // Extract URLs from content
  const contentUrls = useMemo(() => extractUrls(post.content), [post.content]);

  // Get URLs from link previews
  const previewUrls = useMemo(() => {
    return post.link_previews?.map(preview => preview.url) || [];
  }, [post.link_previews]);

  // Check if we should hide content:
  // 1. If there's only one link preview and that URL is the only thing in the content
  // 2. If content only contains URLs that all appear in link previews
  const shouldHideContent = useMemo(() => {
    if (!hasLinkPreviews || !post.content.trim()) return false;

    // Case 1: Single link preview and content is just that URL
    if (post.link_previews!.length === 1 && contentUrls.length === 1) {
      const trimmedContent = post.content.trim();
      return trimmedContent === contentUrls[0];
    }

    // Case 2: Content only contains URLs that are all in previews
    if (contentUrls.length > 0) {
      const allUrlsInPreviews = contentUrls.every(url => previewUrls.includes(url));
      const contentWithoutUrls = post.content.replace(/https?:\/\/\S+/g, '').trim();
      return allUrlsInPreviews && contentWithoutUrls.length === 0;
    }

    return false;
  }, [hasLinkPreviews, post.content, contentUrls, previewUrls, post.link_previews]);

  // Process content for display: linkify and optionally remove preview URLs
  const displayContent = useMemo(() => {
    if (!post.content.trim()) return '';

    let content = post.content;

    // If we have a single link preview, remove that URL from content
    if (hasLinkPreviews && post.link_previews!.length === 1 && contentUrls.length >= 1) {
      const previewUrl = previewUrls[0];
      if (contentUrls.includes(previewUrl)) {
        // Remove the preview URL from content
        content = content.replace(previewUrl, '').trim();
      }
    }

    // Linkify the content (excluding URLs that are in previews)
    return linkifyText(content, { excludeUrls: previewUrls });
  }, [post.content, hasLinkPreviews, post.link_previews, contentUrls, previewUrls]);

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
      {!shouldHideContent && displayContent && (
        <Content
          style={{ marginBottom: isTextOnly ? '0' : '1rem' }}
          dangerouslySetInnerHTML={{ __html: displayContent.trim() }}
        />
      )}

      {/* Link Previews (show if no attachments) */}
      {!hasAttachments && hasLinkPreviews && (
        <LinkPreviews
          previews={post.link_previews!}
          postId={post.id}
          standalone={shouldHideContent}
        />
      )}

      {/* Image Gallery (for image-only posts) */}
      {hasOnlyImages && <ImageGallery images={images} />}

      {/* File Attachments (for mixed or non-image files) */}
      {hasAttachments && !hasOnlyImages && <FileAttachments files={files} />}
    </Article>
  );
}
