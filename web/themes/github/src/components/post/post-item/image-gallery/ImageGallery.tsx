import { useState } from 'preact/hooks';
import type { PostFile } from '@core/api';
import { isTabletMobile, openImageViewer } from '@core/state';
import { isImageFile } from '@core/utils/files';
import { formatFileSize } from '@core/utils/format';
import { ui } from '../../../../config';
import { SectionHeader } from '../../../shared/SectionHeader';
import { LazyImage, OverlayVisibility } from '../../../shared/LazyImage';
import {
  GalleryContainer,
  TwoImagesGrid,
  ThreeImagesGrid,
  FourImagesGrid,
  ImageContainer,
  RemoveButton,
} from './styles';

interface ImageGalleryProps {
  files: PostFile[] | File[];
  previewUrls?: Map<File, string>; // For create post modal
  onRemove?: (index: number) => void; // For create post modal
}

export function ImageGallery({ files, previewUrls, onRemove }: ImageGalleryProps) {
  const [currentPage, setCurrentPage] = useState(0);

  if (!files || files.length === 0) return null;

  const isCreatePostMode = !!previewUrls;
  const ITEMS_PER_PAGE = 4;

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

  const checkIsImage = (file: PostFile | File): boolean => {
    if ('file_type' in file) {
      return isImageFile(file.file_type);
    }
    return file.type.startsWith('image/');
  };

  const getFileName = (file: PostFile | File): string => {
    return 'filename' in file ? file.filename : file.name;
  };

  const getFileSize = (file: PostFile | File): string => {
    const size = 'file_size' in file ? file.file_size : file.size;
    return formatFileSize(size);
  };

  const getImageUrl = (file: PostFile | File): string => {
    if (isCreatePostMode && file instanceof File) {
      return previewUrls?.get(file) || '';
    }
    if ('file_path' in file) {
      return `/uploads/${file.file_path}`;
    }
    return '';
  };

  const handleFileClick = (index: number) => {
    if (isCreatePostMode) return;

    const actualIndex = startIndex + index;
    const file = files[actualIndex];
    const isImage = checkIsImage(file);

    if (!isImage) {
      if ('file_path' in file) {
        window.open(`/uploads/${file.file_path}`, '_blank');
      }
      return;
    }

    const trueImages = files.filter(checkIsImage);
    const trueImageIndex = trueImages.findIndex((img) => {
      if ('id' in img && 'id' in file) {
        return img.id === file.id;
      }
      return img === file;
    });

    if (trueImageIndex !== -1) {
      const imageData = trueImages.map((img) => ({
        url: 'file_path' in img ? `/uploads/${img.file_path}` : '',
        filename: getFileName(img),
      }));
      openImageViewer(imageData, trueImageIndex);
    }
  };

  const renderRemoveButton = (index: number) => {
    if (!isCreatePostMode || !onRemove) return null;
    const actualIndex = startIndex + index;
    return (
      <RemoveButton onClick={(e) => { e.stopPropagation(); onRemove(actualIndex); }}>
        <i class="fas fa-times" />
      </RemoveButton>
    );
  };

  const renderFile = (file: PostFile | File, index: number) => {
    const isImage = checkIsImage(file);
    const url = getImageUrl(file);
    const fileName = getFileName(file);
    const fileSize = getFileSize(file);

    if (!url) return null;

    let bgOverlay = 'never' as OverlayVisibility;
    if (isCreatePostMode || isTabletMobile()){
      bgOverlay = isImage ? 'never' : 'always';
    } else {
      bgOverlay = 'hover';
    }

    let fileDescriptionVisibility = 'never' as OverlayVisibility;
    if (isCreatePostMode || isTabletMobile()) {
      fileDescriptionVisibility = isImage ? 'never' : 'always';
    } else {
      fileDescriptionVisibility = isImage ? 'never' : 'hover';
    }

    return (
      <LazyImage
        src={url}
        ext={isCreatePostMode && file instanceof File ? file.name.split('.').pop() : undefined}
        alt={fileName}
        preview={{
          size: currentCount === 1 ? 'large' : currentCount === 3 && index === 0 ? 'large' : 'medium',
        }}
        bgOverlay={bgOverlay}
        fileDescription={!isImage ? { filename: fileName, fileSize } : undefined}
        fileDescriptionVisibility={fileDescriptionVisibility}
      />
    );
  };

  const renderGrid = () => {
    const displayCount = currentPage === 0 ? currentCount : 4;

    const { maxHeight, gap } = ui.imageGallery;

    if (displayCount === 1) {
      return (
        <GalleryContainer>
          <ImageContainer singleImage maxHeight={maxHeight} onClick={() => handleFileClick(0)}>
            {renderFile(currentFiles[0], 0)}
            {renderRemoveButton(0)}
          </ImageContainer>
        </GalleryContainer>
      );
    }

    if (displayCount === 2) {
      return (
        <GalleryContainer>
          <TwoImagesGrid maxHeight={maxHeight} gap={gap}>
            {currentFiles.map((file, idx) => (
              <ImageContainer maxHeight={maxHeight} key={idx} onClick={() => handleFileClick(idx)}>
                {renderFile(file, idx)}
                {renderRemoveButton(idx)}
              </ImageContainer>
            ))}
          </TwoImagesGrid>
        </GalleryContainer>
      );
    }

    if (displayCount === 3) {
      return (
        <GalleryContainer>
          <ThreeImagesGrid maxHeight={maxHeight} gap={gap}>
            {currentFiles.map((file, idx) => (
              <ImageContainer maxHeight={maxHeight} key={idx} onClick={() => handleFileClick(idx)}>
                {renderFile(file, idx)}
                {renderRemoveButton(idx)}
              </ImageContainer>
            ))}
          </ThreeImagesGrid>
        </GalleryContainer>
      );
    }

    return (
      <GalleryContainer>
        <FourImagesGrid maxHeight={maxHeight} gap={gap}>
          {Array.from({ length: 4 }).map((_, idx) => {
            const file = currentFiles[idx];
            return (
              <ImageContainer
                maxHeight={maxHeight}
                key={idx}
                onClick={() => file && handleFileClick(idx)}
                style={!file ? "opacity: 0; pointer-events: none;" : ""}
              >
                {file && renderFile(file, idx)}
                {file && renderRemoveButton(idx)}
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
    </>
  );
}
