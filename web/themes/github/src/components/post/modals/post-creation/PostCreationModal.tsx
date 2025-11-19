import { type Space, type Post as PostType } from '@core/api';
import { Modal } from '../../../modal';
import { postCreationModalStyles } from '../../../../styles/post-creation-modal';
import { PostCreationHeader } from './PostCreationHeader';
import { PostCreationEditor } from './PostCreationEditor';
import { ImageGallery } from '../../post-item/image-gallery';
import { PostPreview } from './PostPreview';
import { usePostCreation } from './usePostCreation';

const ContentArea = postCreationModalStyles.contentArea;
const ToolbarButton = postCreationModalStyles.toolbarButton;
const Button = postCreationModalStyles.button;

interface PostCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSpace: Space | null;
}

export function PostCreationModal({ isOpen, onClose, currentSpace }: PostCreationModalProps) {
  const {
    selectedSpaceId,
    content,
    attachments,
    previewUrls,
    error,
    showPreview,
    modalHeight,
    maxContentLength,
    textareaRef,
    fileInputRef,
    containerRef,
    contentAreaRef,
    attachmentGridRef,
    modalContainerRef,
    setContent,
    handleFileSelect,
    handleRemoveAttachment,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleTogglePreview,
    handleSpaceChange,
    handlePublish,
  } = usePostCreation(isOpen, currentSpace);

  // Create a preview post object for the Post component
  const previewPost: PostType = {
    id: 0,
    space_id: selectedSpaceId || 0,
    content: content,
    created: Date.now() / 1000, // Unix timestamp in seconds
    files: attachments.map((file, index) => ({
      id: index,
      filename: file.name,
      file_type: file.type,
      file_size: file.size,
      file_path: previewUrls.get(file) || '',
      created: Date.now() / 1000,
    })),
    link_previews: [],
  };

  const contentLength = content.length;
  const isOverLimit = contentLength > maxContentLength;

  const footer = (
    <>
      <ToolbarButton onClick={() => fileInputRef.current?.click()} title="Add images or files">
        <i class="fas fa-image" />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </ToolbarButton>
      <div style={{ flex: 1 }} />
      {contentLength > 0 && (
        <span style={{
          fontSize: '13px',
          color: isOverLimit ? '#f44336' : 'var(--text-tertiary)',
          marginRight: '12px'
        }}>
          {contentLength} / {maxContentLength}
        </span>
      )}
      <Button type="button" className="publish" onClick={() => handlePublish(onClose)} disabled={isOverLimit}>
        Publish
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      footer={footer}
      size="timeline"
      modalContainerRef={modalContainerRef}
      modalHeight={modalHeight}
    >
      <PostCreationHeader
        selectedSpaceId={selectedSpaceId}
        onSpaceChange={handleSpaceChange}
        error={error}
        showPreview={showPreview}
        onTogglePreview={handleTogglePreview}
      />

      <ContentArea ref={contentAreaRef}>
        {!showPreview ? (
          <>
            <PostCreationEditor
              containerRef={containerRef}
              textareaRef={textareaRef}
              content={content}
              onContentChange={setContent}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />

            <div style={{ minHeight: attachments.length > 0 ? '200px' : '0' }}>
              <ImageGallery
                files={attachments}
                previewUrls={previewUrls}
                onRemove={handleRemoveAttachment}
              />
            </div>

            {error && (
              <div style={{
                padding: '8px 12px',
                background: 'rgba(244, 67, 54, 0.1)',
                border: '1px solid rgba(244, 67, 54, 0.3)',
                borderRadius: '6px',
                color: '#f44336',
                fontSize: '13px',
                marginTop: '8px'
              }}>
                {error}
              </div>
            )}
          </>
        ) : (
          <div style={{ marginTop: '1rem' }}>
            <PostPreview
              post={previewPost}
              hasContent={content.trim() !== '' || attachments.length > 0}
            />
          </div>
        )}
      </ContentArea>
    </Modal>
  );
}
