import { useState, useEffect, useRef, useLayoutEffect } from 'preact/hooks';
import { Modal } from '../modal';
import { SpaceSelector } from '../SpaceSelector';
import { type Space, type Post as PostType } from '@core/api';
import { postCreationModalStyles } from '../../styles/post-creation-modal';
import { formatFileSize } from '@core/utils/format';
import { clientConfig } from '@core/state/settings';
import { Post } from './Post';

const Container = postCreationModalStyles.container;
const Header = postCreationModalStyles.header;
const SpaceSelectorWrapper = postCreationModalStyles.spaceSelectorWrapper;
const ContentArea = postCreationModalStyles.contentArea;
const Textarea = postCreationModalStyles.textarea;
const AttachmentsGrid = postCreationModalStyles.attachmentsGrid;
const AttachmentItem = postCreationModalStyles.attachmentItem;
const AttachmentPreview = postCreationModalStyles.attachmentPreview;
const RemoveButton = postCreationModalStyles.removeButton;
const ToolbarButton = postCreationModalStyles.toolbarButton;
const Button = postCreationModalStyles.button;

// Configuration constants
const MAX_MODAL_HEIGHT_PERCENT = 0.75; // 75% of viewport height
const HEADER_HEIGHT = 65; // Approximate header height
const FOOTER_HEIGHT = 52; // Approximate footer height
const CONTENT_PADDING = 40; // Total vertical padding for content area

interface PostCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSpace: Space | null;
}

export function PostCreationModal({ isOpen, onClose, currentSpace }: PostCreationModalProps) {
  const [selectedSpaceId, setSelectedSpaceId] = useState<number | null>(null);
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Map<File, string>>(new Map());
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [modalHeight, setModalHeight] = useState<number | 'auto'>('auto');
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const attachmentGridRef = useRef<HTMLDivElement>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef(0);

  // Get config limits (with fallback defaults)
  const maxFilesPerPost = clientConfig.value.file_upload?.max_files_per_post || 50;
  const maxFileSizeMB = clientConfig.value.file_upload?.max_file_size_mb || 100;
  const allowedExtensions = clientConfig.value.file_upload?.allowed_extensions || [];

  // Calculate and update modal height based on content
  const updateModalHeight = () => {
    if (!textareaRef.current || !modalContainerRef.current) return;

    const viewportHeight = window.innerHeight;
    const maxHeight = viewportHeight * MAX_MODAL_HEIGHT_PERCENT;

    // Calculate content height
    let contentHeight = HEADER_HEIGHT + FOOTER_HEIGHT + CONTENT_PADDING;

    // Add textarea height (already calculated by auto-grow effect)
    const textarea = textareaRef.current;
    if (textarea) {
      contentHeight += textarea.scrollHeight;
    }
    
    // Add attachments grid height if present
    if (attachments.length > 0 && attachmentGridRef.current) {
      const gridElement = attachmentGridRef.current;
      contentHeight += gridElement.scrollHeight + 16; // Add gap
    }
    
    // Add some buffer for margins and unexpected elements
    contentHeight += 20;

    // Always keep modal height as auto - let content area handle scrolling
    setModalHeight('auto');

    // If content would exceed max height, make content area scrollable
    if (contentAreaRef.current) {
      if (contentHeight >= maxHeight) {
        contentAreaRef.current.style.maxHeight = `${maxHeight - HEADER_HEIGHT - FOOTER_HEIGHT - CONTENT_PADDING}px`;
        contentAreaRef.current.style.overflowY = 'auto';
      } else {
        contentAreaRef.current.style.maxHeight = 'none';
        contentAreaRef.current.style.overflowY = 'visible';
      }
    }
  };

  // Update height whenever content or attachments change
  useLayoutEffect(() => {
    if (!isOpen || showPreview) return;
    updateModalHeight();
  }, [content, attachments, isOpen, showPreview]);

  // Handle window resize
  useEffect(() => {
    if (!isOpen) return;
    
    const handleResize = () => {
      updateModalHeight();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  // Initialize selected space
  useEffect(() => {
    if (isOpen) {
      if (currentSpace && currentSpace.id !== 0) {
        setSelectedSpaceId(currentSpace.id);
      } else {
        setSelectedSpaceId(null);
      }
      // Set initial height calculation
      setTimeout(updateModalHeight, 0);
    } else {
      // Reset on close
      setSelectedSpaceId(null);
      setContent('');
      setAttachments([]);
      setPreviewUrls(new Map());
      setError('');
      setShowPreview(false);
      setModalHeight('auto');
      dragCounterRef.current = 0;
      // Reset content area scroll
      if (contentAreaRef.current) {
        contentAreaRef.current.style.maxHeight = 'none';
        contentAreaRef.current.style.overflowY = 'visible';
      }
    }
  }, [isOpen, currentSpace]);

  // Auto-grow textarea (with height update)
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !(textarea instanceof HTMLTextAreaElement)) return;

    // Reset height to auto to get accurate scrollHeight
    textarea.style.height = 'auto';

    // Set height to scrollHeight to remove scrollbar
    const newHeight = textarea.scrollHeight;
    textarea.style.height = `${newHeight}px`;

    // Trigger modal height update
    updateModalHeight();
  }, [content]);

  // Auto-focus textarea when modal opens
  useEffect(() => {
    if (!isOpen || showPreview) return;

    const timer = setTimeout(() => {
      const textarea = textareaRef.current;
      if (textarea && textarea instanceof HTMLTextAreaElement) {
        textarea.focus();
        // Place cursor at end
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen, showPreview]);

  // Create preview URLs for images
  useEffect(() => {
    const newPreviewUrls = new Map<File, string>();

    attachments.forEach(file => {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        newPreviewUrls.set(file, url);
      }
    });

    // Cleanup old URLs
    previewUrls.forEach((url, file) => {
      if (!attachments.includes(file)) {
        URL.revokeObjectURL(url);
      }
    });

    setPreviewUrls(newPreviewUrls);

    return () => {
      newPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [attachments]);

  // Handle paste for screenshots/clipboard images
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!isOpen) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            // Check file count limit
            if (attachments.length >= maxFilesPerPost) {
              setError(`Maximum ${maxFilesPerPost} files allowed per post`);
              return;
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const renamedFile = new File([file], `screenshot-${timestamp}.png`, { type: file.type });
            setAttachments(prev => [...prev, renamedFile]);
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [isOpen, attachments.length, maxFilesPerPost]);

  // Drag and drop handlers
  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1 && containerRef.current) {
      containerRef.current.classList.add('dragging');
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0 && containerRef.current) {
      containerRef.current.classList.remove('dragging');
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    if (containerRef.current) {
      containerRef.current.classList.remove('dragging');
    }

    const files = Array.from(e.dataTransfer?.files || []);
    addFiles(files);
  };

  // Handle file input
  const handleFileSelect = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const files = Array.from(target.files || []);
    addFiles(files);
    target.value = '';
  };

  // Add files with validation
  const addFiles = (files: File[]) => {
    setError('');

    // Check file count
    const remainingSlots = maxFilesPerPost - attachments.length;
    if (files.length > remainingSlots) {
      setError(`Can only add ${remainingSlots} more file(s). Maximum ${maxFilesPerPost} files per post.`);
      files = files.slice(0, remainingSlots);
    }

    // Validate each file
    const validFiles: File[] = [];
    for (const file of files) {
      // Check file size
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > maxFileSizeMB) {
        setError(`File "${file.name}" exceeds ${maxFileSizeMB}MB limit`);
        continue;
      }

      // Check extension if restrictions exist
      if (allowedExtensions.length > 0) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext && !allowedExtensions.includes(ext)) {
          setError(`File type ".${ext}" not allowed`);
          continue;
        }
      }

      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      setAttachments(prev => [...prev, ...validFiles]);
    }
  };

  // Remove attachment
  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
    setError(''); // Clear error when removing files
  };

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

  // Get character limit from config (fallback to 5000)
  const maxContentLength = clientConfig.value.core?.max_content_length || 5000;
  const contentLength = content.length;
  const isOverLimit = contentLength > maxContentLength;

  const handlePublish = () => {
    setError('');

    // Validation only on publish
    if (!selectedSpaceId) {
      setError('Please select a space to publish your post');
      return;
    }

    if (!content.trim() && attachments.length === 0) {
      setError('Please add some content or attachments');
      return;
    }

    if (isOverLimit) {
      setError(`Content exceeds maximum length of ${maxContentLength} characters`);
      return;
    }

    // TODO: API call will be handled later
    console.log('Publishing post:', { selectedSpaceId, content, attachments });
    onClose();
  };

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
      <Button type="button" className="publish" onClick={handlePublish} disabled={isOverLimit}>
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
      <Header>
        <SpaceSelectorWrapper>
          <label>Publish to:</label>
          <SpaceSelector
            value={selectedSpaceId}
            onChange={(value) => {
              setSelectedSpaceId(value);
              if (error && error.includes('space')) {
                setError('');
              }
            }}
            placeholder={error && error.includes('space') ? error : "Select a space..."}
            error={!!(error && error.includes('space'))}
            showAllDepths={true}
          />
        </SpaceSelectorWrapper>
        <ToolbarButton
          onClick={() => setShowPreview(!showPreview)}
          title={showPreview ? "Hide preview" : "Show preview"}
          className={showPreview ? 'active' : ''}
        >
          <i class={showPreview ? "fas fa-edit" : "fas fa-eye"} />
        </ToolbarButton>
      </Header>

      <ContentArea ref={contentAreaRef}>
        {!showPreview ? (
          <Container
            ref={containerRef}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <Textarea
              ref={textareaRef}
              value={content}
              onInput={(e) => setContent((e.target as HTMLTextAreaElement).value)}
              placeholder="What's on your mind?"
              rows={3}
              style={{ minHeight: '100px' }}
            />

            {attachments.length > 0 && (
              <AttachmentsGrid ref={attachmentGridRef}>
                {attachments.map((file, index) => {
                  const isImage = file.type.startsWith('image/');
                  const previewUrl = previewUrls.get(file);

                  return (
                    <AttachmentItem key={index}>
                      <AttachmentPreview>
                        {isImage && previewUrl ? (
                          <img src={previewUrl} alt={file.name} />
                        ) : (
                          <div class="file-icon">
                            <i class="fas fa-file" />
                            <span>{file.name.split('.').pop()?.toUpperCase()}</span>
                          </div>
                        )}
                      </AttachmentPreview>
                      <RemoveButton onClick={() => handleRemoveAttachment(index)}>
                        <i class="fas fa-times" />
                      </RemoveButton>
                      {!isImage && (
                        <div class="file-info">
                          <span class="filename">{file.name}</span>
                          <span class="filesize">{formatFileSize(file.size)}</span>
                        </div>
                      )}
                    </AttachmentItem>
                  );
                })}
              </AttachmentsGrid>
            )}
            
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
          </Container>
        ) : (
          <div style={{ marginTop: '1rem' }}>
            {content.trim() || attachments.length > 0 ? (
              <Post post={previewPost} />
            ) : (
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
            )}
          </div>
        )}
      </ContentArea>
    </Modal>
  );
}