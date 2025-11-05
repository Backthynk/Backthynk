import { useState, useMemo } from 'preact/hooks';
import type { Post as PostType } from '@core/api';
import { deletePost } from '@core/api';
import { formatRelativeDate, formatFullDateTime } from '@core/utils/date';
import { FileAttachments } from './FileAttachments';
import { LinkPreviews } from './LinkPreviews';
import { ImageGallery } from './ImageGallery';
import { PostActionMenu } from './PostActionMenu';
import { ConfirmModal } from '../modal';
import { MovePostModal } from './MovePostModal';
import { postStyles } from '../../styles/post';
import { linkifyText, extractUrls } from '../../utils/linkify';
import { canRenderAsImage } from '@core/utils/files';
import { clientConfig } from '@core/state/settings';
import { useTooltip, showError, showSuccess } from '@core/components';

const Article = postStyles.article;
const Header = postStyles.header;
const HeaderLeft = postStyles.headerLeft;
const Breadcrumb = postStyles.breadcrumb;
const TimestampWrapper = postStyles.timestamp;
const TimestampText = postStyles.timestampText;
const ActionButton = postStyles.actionButton;
const Content = postStyles.content;

interface PostProps {
  post: PostType;
  showSpaceBreadcrumb?: boolean;
  spaceBreadcrumb?: string;
  onBreadcrumbClick?: (spaceId: number) => void;
  onPostDeleted?: (postId: number) => void;
  onPostMoved?: (updatedPost: PostType) => void;
}

export function Post({ post, showSpaceBreadcrumb, spaceBreadcrumb, onBreadcrumbClick, onPostDeleted, onPostMoved }: PostProps) {
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const { show, hide, TooltipPortal } = useTooltip();

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

  // Handle right-click to show context menu
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    setMenuPosition({ x: e.clientX, y: e.clientY });
  };

  // Handle button click to show menu
  const handleButtonClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    // Position menu to the left of the button, aligned at the top
    setMenuPosition({ x: rect.left - 128, y: rect.top });
  };

  // Handle delete confirmation
  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await deletePost(post.id);
      showSuccess('Post deleted successfully');
      onPostDeleted?.(post.id);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Failed to delete post:', error);
      showError('Failed to delete post. Please try again.');
    }
  };

  // Handle move
  const handleMoveClick = () => {
    setMenuPosition(null);
    setShowMoveModal(true);
  };

  const handleMoveSuccess = (updatedPost: PostType) => {
    onPostMoved?.(updatedPost);
  };

  return (
    <Article data-post-id={post.id} onContextMenu={handleContextMenu}>
      {/* Header */}
      <Header class={isTextOnly ? '' : 'with-content'}>
        <HeaderLeft>
          {showSpaceBreadcrumb && spaceBreadcrumb && (
            <Breadcrumb onClick={() => onBreadcrumbClick?.(post.space_id)}>
              {spaceBreadcrumb}
            </Breadcrumb>
          )}
          <TimestampWrapper
            onMouseEnter={(e: any) => show(e.currentTarget as HTMLElement, formatFullDateTime(post.created))}
            onMouseLeave={hide}
          >
            <TimestampText>{formatRelativeDate(post.created)}</TimestampText>
          </TimestampWrapper>
        </HeaderLeft>

        {/* Action menu */}
        <ActionButton onClick={handleButtonClick}>
          <i class="fas fa-ellipsis-h" />
        </ActionButton>
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

      {/* Tooltip */}
      {TooltipPortal}

      {/* Context Menu */}
      {menuPosition && (
        <PostActionMenu
          postId={post.id}
          x={menuPosition.x}
          y={menuPosition.y}
          onClose={() => setMenuPosition(null)}
          onDelete={handleDeleteClick}
          onMove={handleMoveClick}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete post"
        message="Are you sure you want to delete this post? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Move Post Modal */}
      <MovePostModal
        isOpen={showMoveModal}
        onClose={() => setShowMoveModal(false)}
        post={post}
        onSuccess={handleMoveSuccess}
      />
    </Article>
  );
}
