import { useState, useEffect, useRef, useLayoutEffect } from 'preact/hooks';
import { type Space } from '@core/api';
import { clientConfig } from '@core/state/settings';

// Configuration constants
const MAX_MODAL_HEIGHT_PERCENT = 0.75; // 75% of viewport height
const HEADER_HEIGHT = 65; // Approximate header height
const FOOTER_HEIGHT = 52; // Approximate footer height
const CONTENT_PADDING = 40; // Total vertical padding for content area

export function usePostCreation(isOpen: boolean, currentSpace: Space | null) {
  const [selectedSpaceId, setSelectedSpaceId] = useState<number | null>(null);
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Map<File, string>>(new Map());
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [modalHeight, setModalHeight] = useState<number | 'auto'>('auto');
  const [savedTextareaHeight, setSavedTextareaHeight] = useState<number | null>(null);
  const [savedCursorPosition, setSavedCursorPosition] = useState<number | null>(null);
  const [savedScrollTop, setSavedScrollTop] = useState<number | null>(null);

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
  const maxContentLength = clientConfig.value.core?.max_content_length || 5000;

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

    // If returning from preview mode and we have saved state, restore it
    if (!showPreview && savedTextareaHeight !== null) {
      textarea.style.height = `${savedTextareaHeight}px`;

      // Restore cursor position
      if (savedCursorPosition !== null) {
        textarea.setSelectionRange(savedCursorPosition, savedCursorPosition);
      }

      // Restore scroll position
      if (savedScrollTop !== null) {
        textarea.scrollTop = savedScrollTop;
      }

      // Clear saved state after restoring
      setSavedTextareaHeight(null);
      setSavedCursorPosition(null);
      setSavedScrollTop(null);
    } else {
      // Reset height to auto to get accurate scrollHeight
      textarea.style.height = 'auto';

      // Set height to scrollHeight to remove scrollbar
      const newHeight = textarea.scrollHeight;
      textarea.style.height = `${newHeight}px`;
    }

    // Trigger modal height update
    updateModalHeight();
  }, [content, showPreview, savedTextareaHeight, savedCursorPosition, savedScrollTop]);

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

  // Create preview URLs for all attachments
  useEffect(() => {
    const newPreviewUrls = new Map<File, string>();

    attachments.forEach(file => {
      const url = URL.createObjectURL(file);
      newPreviewUrls.set(file, url);
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

  const handleTogglePreview = () => {
    // Save current textarea state before switching to preview
    if (!showPreview && textareaRef.current) {
      const textarea = textareaRef.current;
      setSavedTextareaHeight(textarea.scrollHeight);
      setSavedCursorPosition(textarea.selectionStart);
      setSavedScrollTop(textarea.scrollTop);
    }
    setShowPreview(!showPreview);
  };

  const handleSpaceChange = (value: number | null) => {
    setSelectedSpaceId(value);
    if (error && error.includes('space')) {
      setError('');
    }
  };

  const handlePublish = (onClose: () => void) => {
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

    const isOverLimit = content.length > maxContentLength;
    if (isOverLimit) {
      setError(`Content exceeds maximum length of ${maxContentLength} characters`);
      return;
    }

    // TODO: API call will be handled later
    console.log('Publishing post:', { selectedSpaceId, content, attachments });
    onClose();
  };

  return {
    // State
    selectedSpaceId,
    content,
    attachments,
    previewUrls,
    error,
    showPreview,
    modalHeight,
    maxContentLength,

    // Refs
    textareaRef,
    fileInputRef,
    containerRef,
    contentAreaRef,
    attachmentGridRef,
    modalContainerRef,

    // Handlers
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
  };
}
