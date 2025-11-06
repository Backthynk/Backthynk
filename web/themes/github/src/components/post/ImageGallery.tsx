import { useState } from 'preact/hooks';
import type { PostFile } from '@core/api';
import { ImageViewer } from '@core/components/ImageViewer';
import { LazyImage } from '@core/components';
import { isImageFile } from '@core/utils/files';
import { formatFileSize } from '@core/utils/format';
import { styled } from 'goober';

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

const MoreOverlay = styled('div')`
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 600;
  color: white;
  cursor: pointer;
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

interface ImageGalleryProps {
  images: PostFile[];
}

export function ImageGallery({ images }: ImageGalleryProps) {
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);

  if (!images || images.length === 0) return null;

  // Separate true images from preview-supported files (like PDFs)
  const trueImages = images.filter(img => isImageFile(img.file_type));
  const previewFiles = images.filter(img => !isImageFile(img.file_type));

  const handleImageClick = (index: number) => {
    const img = images[index];

    // If it's not a true image (e.g., PDF), open it directly
    if (!isImageFile(img.file_type)) {
      window.open(`/uploads/${img.file_path}`, '_blank');
      return;
    }

    // For true images, find the index in the trueImages array for the viewer
    const trueImageIndex = trueImages.findIndex(ti => ti.id === img.id);
    if (trueImageIndex !== -1) {
      setImageViewerIndex(trueImageIndex);
      setShowImageViewer(true);
    }
  };

  // Only include true images in the viewer
  const imageData = trueImages.map((img) => ({
    url: `/uploads/${img.file_path}`,
    filename: img.filename,
  }));

  // Single image
  if (images.length === 1) {
    const file = images[0];
    const isImage = isImageFile(file.file_type);

    return (
      <>
        <GalleryContainer>
          <ImageContainer onClick={() => handleImageClick(0)}>
            <LazyImage
              src={`/uploads/${file.file_path}`}
              alt={file.filename}
              previewSize="large"
            />

              <FileOverlay className="file-overlay">
                {!isImage && <p>{file.filename}</p>}
                {!isImage && <p className="size">{formatFileSize(file.file_size)}</p>}
              </FileOverlay>
            
          </ImageContainer>
        </GalleryContainer>
        {showImageViewer && imageData.length > 0 && (
          <ImageViewer images={imageData} startIndex={imageViewerIndex} onClose={() => setShowImageViewer(false)} />
        )}
      </>
    );
  }

  // Two images
  if (images.length === 2) {
    return (
      <>
        <GalleryContainer>
          <TwoImagesGrid>
            {images.map((img, idx) => {
              const isImage = isImageFile(img.file_type);
              return (
                <ImageContainer key={img.id} onClick={() => handleImageClick(idx)}>
                  <LazyImage
                    src={`/uploads/${img.file_path}`}
                    alt={img.filename}
                    previewSize="large"
                  />
                  <FileOverlay className="file-overlay">
                    {!isImage && <p>{img.filename}</p>}
                    {!isImage && <p className="size">{formatFileSize(img.file_size)}</p>}
                  </FileOverlay>
                </ImageContainer>
              );
            })}
          </TwoImagesGrid>
        </GalleryContainer>
        {showImageViewer && imageData.length > 0 && (
          <ImageViewer images={imageData} startIndex={imageViewerIndex} onClose={() => setShowImageViewer(false)} />
        )}
      </>
    );
  }

  // Three images
  if (images.length === 3) {
    return (
      <>
        <GalleryContainer>
          <ThreeImagesGrid>
            {images.map((img, idx) => {
              const isImage = isImageFile(img.file_type);
              const previewSize = idx === 0 ? 'large' : 'medium';
              return (
                <ImageContainer key={img.id} onClick={() => handleImageClick(idx)}>
                  <LazyImage
                    src={`/uploads/${img.file_path}`}
                    alt={img.filename}
                    previewSize={previewSize}
                  />
                  <FileOverlay className="file-overlay">
                    {!isImage && <p>{img.filename}</p>}
                    {!isImage && <p className="size">{formatFileSize(img.file_size)}</p>}
                  </FileOverlay>
                </ImageContainer>
              );
            })}
          </ThreeImagesGrid>
        </GalleryContainer>
        {showImageViewer && imageData.length > 0 && (
          <ImageViewer images={imageData} startIndex={imageViewerIndex} onClose={() => setShowImageViewer(false)} />
        )}
      </>
    );
  }

  // Four or more images
  const displayImages = images.slice(0, 4);
  const remainingCount = images.length - 4;

  return (
    <>
      <GalleryContainer>
        <FourImagesGrid>
          {displayImages.map((img, idx) => {
            const isImage = isImageFile(img.file_type);
            return (
              <ImageContainer key={img.id} onClick={() => handleImageClick(idx)}>
                <LazyImage
                  src={`/uploads/${img.file_path}`}
                  alt={img.filename}
                  previewSize="medium"
                />
                <FileOverlay className="file-overlay">
                  {!isImage && <p>{img.filename}</p>}
                  {!isImage && <p className="size">{formatFileSize(img.file_size)}</p>}
                </FileOverlay>
                {idx === 3 && remainingCount > 0 && <MoreOverlay>+{remainingCount}</MoreOverlay>}
              </ImageContainer>
            );
          })}
        </FourImagesGrid>
      </GalleryContainer>
      {showImageViewer && imageData.length > 0 && (
        <ImageViewer images={imageData} startIndex={imageViewerIndex} onClose={() => setShowImageViewer(false)} />
      )}
    </>
  );
}
