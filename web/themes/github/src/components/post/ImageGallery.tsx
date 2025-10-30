import { useState } from 'preact/hooks';
import type { PostFile } from '@core/api';
import { ImageViewer } from '@core/components/ImageViewer';
import { styled } from 'goober';

const GalleryContainer = styled('div')`
  border-radius: 12px;
  overflow: hidden;
  margin-top: 0.75rem;
  border: 1px solid var(--border-primary);
`;

const SingleImageContainer = styled('div')`
  width: 100%;
  max-height: 500px;
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;

const TwoImagesGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  max-height: 400px;

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
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 2px;
  max-height: 400px;

  .main {
    grid-row: 1 / 3;
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
  max-height: 400px;

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

  const openImageViewer = (index: number) => {
    setImageViewerIndex(index);
    setShowImageViewer(true);
  };

  const imageData = images.map((img) => ({
    url: `/uploads/${img.file_path}`,
    filename: img.filename,
  }));

  // Single image
  if (images.length === 1) {
    return (
      <>
        <GalleryContainer>
          <SingleImageContainer onClick={() => openImageViewer(0)}>
            <img src={`/uploads/${images[0].file_path}`} alt={images[0].filename} />
          </SingleImageContainer>
        </GalleryContainer>
        {showImageViewer && (
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
              <img
                key={img.id}
                src={`/uploads/${img.file_path}`}
                alt={img.filename}
                onClick={() => openImageViewer(idx)}
              />
            ))}
          </TwoImagesGrid>
        </GalleryContainer>
        {showImageViewer && (
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
            <img
              class="main"
              src={`/uploads/${images[0].file_path}`}
              alt={images[0].filename}
              onClick={() => openImageViewer(0)}
            />
            <img
              src={`/uploads/${images[1].file_path}`}
              alt={images[1].filename}
              onClick={() => openImageViewer(1)}
            />
            <img
              src={`/uploads/${images[2].file_path}`}
              alt={images[2].filename}
              onClick={() => openImageViewer(2)}
            />
          </ThreeImagesGrid>
        </GalleryContainer>
        {showImageViewer && (
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
            <ImageContainer key={img.id} onClick={() => openImageViewer(idx)}>
              <img src={`/uploads/${img.file_path}`} alt={img.filename} />
              {idx === 3 && remainingCount > 0 && <MoreOverlay>+{remainingCount}</MoreOverlay>}
            </ImageContainer>
          ))}
        </FourImagesGrid>
      </GalleryContainer>
      {showImageViewer && (
        <ImageViewer images={imageData} startIndex={imageViewerIndex} onClose={() => setShowImageViewer(false)} />
      )}
    </>
  );
}
