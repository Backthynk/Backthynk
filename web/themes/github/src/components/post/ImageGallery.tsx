import { useState } from 'preact/hooks';
import type { PostFile } from '@core/api';
import { ImageViewer } from '@core/components/ImageViewer';
import { LazyImage } from '@core/components';
import { isImageFile } from '@core/utils/files';
import { styled } from 'goober';

const GalleryContainer = styled('div')`
  border-radius: 12px;
  overflow: hidden;
  margin-top: 0.75rem;
  border: 1px solid var(--border-primary);
`;

const SingleImageContainer = styled('div')`
  width: 100%;
  max-height: 400px;
  cursor: pointer;

  img, & > div {
    width: 100%;
    height: 100%;
  }

  img {
    object-fit: cover;
    display: block;
  }
`;

const TwoImagesGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  max-height: 288px;

  & > div {
    width: 100%;
    height: 100%;
    min-height: 288px;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    cursor: pointer;
    display: block;
  }
`;

const ThreeImagesGrid = styled('div')`
  display: grid;
  grid-template-columns: 2fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 2px;
  height: 288px;

  & > div:first-child {
    grid-row: 1 / 3;
    grid-column: 1;
  }

  & > div:nth-child(2) {
    grid-row: 1;
    grid-column: 2;
  }

  & > div:nth-child(3) {
    grid-row: 2;
    grid-column: 2;
  }

  & > div {
    width: 100%;
    height: 100%;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    cursor: pointer;
    display: block;
  }
`;

const FourImagesGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 2px;
  max-height: 288px;
  height: 288px;

  & > div {
    width: 100%;
    height: 100%;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    cursor: pointer;
    display: block;
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
    return (
      <>
        <GalleryContainer>
          <SingleImageContainer onClick={() => handleImageClick(0)}>
            <LazyImage
              src={`/uploads/${images[0].file_path}`}
              alt={images[0].filename}
              previewSize="large"
            />
          </SingleImageContainer>
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
            {images.map((img, idx) => (
              <LazyImage
                key={img.id}
                src={`/uploads/${img.file_path}`}
                alt={img.filename}
                onClick={() => handleImageClick(idx)}
                previewSize="large"
              />
            ))}
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
            <LazyImage
              src={`/uploads/${images[0].file_path}`}
              alt={images[0].filename}
              onClick={() => handleImageClick(0)}
              previewSize="large"
            />
            <LazyImage
              src={`/uploads/${images[1].file_path}`}
              alt={images[1].filename}
              onClick={() => handleImageClick(1)}
              previewSize="medium"
            />
            <LazyImage
              src={`/uploads/${images[2].file_path}`}
              alt={images[2].filename}
              onClick={() => handleImageClick(2)}
              previewSize="medium"
            />
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
          {displayImages.map((img, idx) => (
            <ImageContainer key={img.id} onClick={() => handleImageClick(idx)}>
              <LazyImage
                src={`/uploads/${img.file_path}`}
                alt={img.filename}
                previewSize="medium"
              />
              {idx === 3 && remainingCount > 0 && <MoreOverlay>+{remainingCount}</MoreOverlay>}
            </ImageContainer>
          ))}
        </FourImagesGrid>
      </GalleryContainer>
      {showImageViewer && imageData.length > 0 && (
        <ImageViewer images={imageData} startIndex={imageViewerIndex} onClose={() => setShowImageViewer(false)} />
      )}
    </>
  );
}
