import { useState } from 'preact/hooks';
import type { PostFile } from '@core/api';
import { ImageViewer } from '@core/components/ImageViewer';
import { LazyImage } from '@core/components';
import { isImageFile, getFileIcon, supportsPreview } from '@core/utils/files';
import { formatFileSize } from '@core/utils/format';
import { clientConfig } from '@core/state/settings';
import { styled } from 'goober';
import { SectionHeader } from './SectionHeader';

const GalleryContainer = styled('div')`
  border-radius: 12px;
  overflow: hidden;
  margin-top: 0.75rem;
  border: 1px solid var(--border-primary);
`;

const TwoImagesGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  max-height: 400px;

  & > div {
    width: 100%;
    height: 100%;
    max-height: 400px;
  }

  & > div:first-child {
    border-radius: 12px 0 0 12px;
  }

  & > div:last-child {
    border-radius: 0 12px 12px 0;
  }
`;

const ThreeImagesGrid = styled('div')`
  display: grid;
  grid-template-columns: 2fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 2px;
  max-height: 400px;
  height: 400px;

  & > div:first-child {
    grid-row: 1 / 3;
    grid-column: 1;
    border-radius: 12px 0 0 12px;
  }

  & > div:nth-child(2) {
    grid-row: 1;
    grid-column: 2;
    border-radius: 0 12px 0 0;
  }

  & > div:nth-child(3) {
    grid-row: 2;
    grid-column: 2;
    border-radius: 0 0 12px 0;
  }

  & > div {
    width: 100%;
    height: 100%;
  }
`;

const FourImagesGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 2px;
  max-height: 400px;
  height: 400px;

  & > div {
    width: 100%;
    height: 100%;
  }

  & > div:nth-child(1) {
    border-radius: 12px 0 0 0;
  }

  & > div:nth-child(2) {
    border-radius: 0 12px 0 0;
  }

  & > div:nth-child(3) {
    border-radius: 0 0 0 12px;
  }

  & > div:nth-child(4) {
    border-radius: 0 0 12px 0;
  }
`;

const ImageContainer = styled('div')`
  position: relative;
  overflow: hidden;
  cursor: pointer;
  max-height: 500px;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &:hover .file-overlay {
    opacity: 1;
  }

  &:first-child:last-child {
    border-radius: 12px;
  }
`;

const FileOverlay = styled('div')`
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.6), transparent);
  padding: 0.5rem;
  border-radius: inherit;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  opacity: 0;
  transition: opacity 0.2s ease;

  p {
    color: white;
    font-size: 0.875rem;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .size {
    opacity: 0.8;
    font-size: 0.75rem;
  }
`;

const FilePlaceholder = styled('div')`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  min-height: 200px;

  i {
    font-size: 3rem;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }

  .file-type {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    text-transform: uppercase;
  }
`;

const FilePlaceholderFooter = styled('div')`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.6);
  color: white;

  p {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .size {
    opacity: 0.8;
    font-size: 0.75rem;
    margin-top: 0.25rem;
  }
`;

const RemoveButton = styled('button')`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  opacity: 0;
  transition: all 0.2s ease;
  z-index: 10;

  &:hover {
    background: rgba(220, 38, 38, 0.9);
    transform: scale(1.1);
  }

  ${ImageContainer}:hover & {
    opacity: 1;
  }
`;

interface ImageGalleryProps {
  files: PostFile[] | File[];
  previewUrls?: Map<File, string>; // For create post modal
  onRemove?: (index: number) => void; // For create post modal
}

export function ImageGallery({ files, previewUrls, onRemove }: ImageGalleryProps) {
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);

  if (!files || files.length === 0) return null;

  const isCreatePostMode = !!previewUrls;
  const ITEMS_PER_PAGE = 4;

  // Get preview supported formats from config
  const previewFormats = clientConfig.value.preview?.supported_formats || [];

  // Calculate pagination
  const totalPages = Math.ceil(files.length / ITEMS_PER_PAGE);
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, files.length);
  const currentFiles = files.slice(startIndex, endIndex);
  const currentCount = currentFiles.length;

  // Navigate pages
  const navigatePage = (direction: number) => {
    const newPage = currentPage + direction;
    if (newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Helper to check if file is an image
  const checkIsImage = (file: PostFile | File): boolean => {
    if ('file_type' in file) {
      return isImageFile(file.file_type);
    }
    return file.type.startsWith('image/');
  };

  // Helper to check if file supports preview
  const checkSupportsPreview = (file: PostFile | File): boolean => {
    if ('file_type' in file && 'filename' in file) {
      return supportsPreview(file.filename, previewFormats);
    }
    return false;
  };

  // Helper to get file extension
  const getFileExtension = (file: PostFile | File): string => {
    const name = 'filename' in file ? file.filename : file.name;
    return name.split('.').pop()?.toLowerCase() || 'FILE';
  };

  // Helper to get file size
  const getFileSize = (file: PostFile | File): string => {
    const size = 'file_size' in file ? file.file_size : file.size;
    return formatFileSize(size);
  };

  // Helper to get file name
  const getFileName = (file: PostFile | File): string => {
    return 'filename' in file ? file.filename : file.name;
  };

  // Get image URL for PostFile or File
  const getImageUrl = (file: PostFile | File): string => {
    if (isCreatePostMode && file instanceof File) {
      return previewUrls?.get(file) || '';
    }
    if ('file_path' in file) {
      return `/uploads/${file.file_path}`;
    }
    return '';
  };

  // Handle file click
  const handleFileClick = (index: number) => {
    const actualIndex = startIndex + index;
    const file = files[actualIndex];
    const isImage = checkIsImage(file);

    if (isCreatePostMode) {
      return; // Don't open viewer in create mode
    }

    if (!isImage) {
      // For non-images, open directly
      if ('file_path' in file) {
        window.open(`/uploads/${file.file_path}`, '_blank');
      }
      return;
    }

    // For images, open viewer
    const trueImages = files.filter(checkIsImage);
    const trueImageIndex = trueImages.findIndex((img) => {
      if ('id' in img && 'id' in file) {
        return img.id === file.id;
      }
      return img === file;
    });

    if (trueImageIndex !== -1) {
      setImageViewerIndex(trueImageIndex);
      setShowImageViewer(true);
    }
  };

  // Prepare image data for viewer (only true images)
  const imageData = files
    .filter(checkIsImage)
    .map((img) => ({
      url: 'file_path' in img ? `/uploads/${img.file_path}` : '',
      filename: getFileName(img),
    }));

  // Render remove button for create post mode
  const renderRemoveButton = (index: number) => {
    if (!isCreatePostMode || !onRemove) return null;

    const actualIndex = startIndex + index;
    return (
      <RemoveButton
        onClick={(e) => {
          e.stopPropagation();
          onRemove(actualIndex);
        }}
      >
        <i class="fas fa-times" />
      </RemoveButton>
    );
  };

  // Render file preview (image or placeholder)
  const renderFilePreview = (file: PostFile | File, index: number) => {
    const isImage = checkIsImage(file);
    const hasPreview = checkSupportsPreview(file);
    const url = getImageUrl(file);
    const fileName = getFileName(file);
    const fileSize = getFileSize(file);
    const fileExtension = getFileExtension(file);

    // Try to render image first
    if (isImage || hasPreview) {
      if (url) {
        // In create post mode, use regular img tag for blob URLs
        if (isCreatePostMode) {
          return (
            <>
              <img src={url} alt={fileName} style="width: 100%; height: 100%; object-fit: cover; display: block;" />
              {!isImage && (
                <FileOverlay class="file-overlay">
                  <p>{fileName}</p>
                  <p class="size">{fileSize}</p>
                </FileOverlay>
              )}
            </>
          );
        }

        // For post view mode, use LazyImage with preview sizes
        return (
          <>
            <LazyImage
              src={url}
              alt={fileName}
              previewSize={currentCount === 1 ? 'large' : currentCount === 3 && index === 0 ? 'large' : 'medium'}
              onError={(e: any) => {
                // If image fails to load, show placeholder
                e.target.style.display = 'none';
                e.target.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <FilePlaceholder class="hidden" style="display: none;">
              <i class={`fas ${getFileIcon(fileExtension)}`} />
              <span class="file-type">{fileExtension}</span>
              <FilePlaceholderFooter>
                <p>{fileName}</p>
                <p class="size">{fileSize}</p>
              </FilePlaceholderFooter>
            </FilePlaceholder>
            {!isImage && (
              <FileOverlay class="file-overlay">
                <p>{fileName}</p>
                <p class="size">{fileSize}</p>
              </FileOverlay>
            )}
          </>
        );
      }
    }

    // Show placeholder for non-images or when no URL
    return (
      <FilePlaceholder>
        <i class={`fas ${getFileIcon(fileExtension)}`} />
        <span class="file-type">{fileExtension}</span>
        <FilePlaceholderFooter>
          <p>{fileName}</p>
          <p class="size">{fileSize}</p>
        </FilePlaceholderFooter>
      </FilePlaceholder>
    );
  };

  // Render based on count for first page, always 2x2 for page 2+
  const renderGrid = () => {
    const displayCount = currentPage === 0 ? currentCount : 4;

    // Single file
    if (displayCount === 1) {
      return (
        <GalleryContainer>
          <ImageContainer onClick={() => handleFileClick(0)}>
            {renderFilePreview(currentFiles[0], 0)}
            {renderRemoveButton(0)}
          </ImageContainer>
        </GalleryContainer>
      );
    }

    // Two files
    if (displayCount === 2) {
      return (
        <GalleryContainer>
          <TwoImagesGrid>
            {currentFiles.map((file, idx) => (
              <ImageContainer key={idx} onClick={() => handleFileClick(idx)}>
                {renderFilePreview(file, idx)}
                {renderRemoveButton(idx)}
              </ImageContainer>
            ))}
          </TwoImagesGrid>
        </GalleryContainer>
      );
    }

    // Three files
    if (displayCount === 3) {
      return (
        <GalleryContainer>
          <ThreeImagesGrid>
            {currentFiles.map((file, idx) => (
              <ImageContainer key={idx} onClick={() => handleFileClick(idx)}>
                {renderFilePreview(file, idx)}
                {renderRemoveButton(idx)}
              </ImageContainer>
            ))}
          </ThreeImagesGrid>
        </GalleryContainer>
      );
    }

    // Four files (or placeholder grid for pages 2+)
    return (
      <GalleryContainer>
        <FourImagesGrid>
          {Array.from({ length: 4 }).map((_, idx) => {
            const file = currentFiles[idx];
            if (!file) {
              return <ImageContainer key={idx} style="opacity: 0; pointer-events: none;" />;
            }
            return (
              <ImageContainer key={idx} onClick={() => handleFileClick(idx)}>
                {renderFilePreview(file, idx)}
                {renderRemoveButton(idx)}
              </ImageContainer>
            );
          })}
        </FourImagesGrid>
      </GalleryContainer>
    );
  };

  return (
    <>
      {files.length > 4 && (
        <SectionHeader
          title="Attachments"
          currentCount={endIndex}
          totalCount={files.length}
          onNavigate={navigatePage}
          canNavigateBack={currentPage > 0}
          canNavigateForward={currentPage < totalPages - 1}
        />
      )}

      {renderGrid()}

      {showImageViewer && imageData.length > 0 && (
        <ImageViewer images={imageData} startIndex={imageViewerIndex} onClose={() => setShowImageViewer(false)} />
      )}
    </>
  );
}
