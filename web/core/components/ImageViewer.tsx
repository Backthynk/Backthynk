import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { styled } from 'goober';
import { zIndex } from '../styles/zIndex';

interface ImageData {
  url: string;
  filename: string;
}

// Global state for image viewer
export const currentImageGallery = signal<ImageData[]>([]);
export const currentImageIndex = signal<number>(0);
export const isViewerOpen = signal<boolean>(false);

// Styled components
const Backdrop = styled('div')`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(5px);
  z-index: ${zIndex.imageViewer};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Image = styled('img')`
  max-width: 90%;
  max-height: 90vh;
  object-fit: contain;
  transition: all 0.3s ease;
`;

const CloseButton = styled('button')`
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border-radius: 50%;
  padding: 0.75rem;
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.7);
  }

  i {
    font-size: 1.25rem;
  }
`;

const NavButton = styled('button')`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border-radius: 50%;
  padding: 0.75rem;
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.7);
  }

  &.prev {
    left: 1rem;
  }

  &.next {
    right: 1rem;
  }

  i {
    font-size: 1.25rem;
  }
`;

const Info = styled('div')`
  position: absolute;
  bottom: 1rem;
  left: 1rem;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 8px;

  .filename {
    font-size: 0.875rem;
  }

  .counter {
    font-size: 0.75rem;
    opacity: 0.75;
    margin-top: 0.25rem;
  }
`;

interface ImageViewerProps {
  images: ImageData[];
  startIndex: number;
  onClose: () => void;
}

export function ImageViewer({ images, startIndex, onClose }: ImageViewerProps) {
  useEffect(() => {
    currentImageGallery.value = images;
    currentImageIndex.value = startIndex;
    isViewerOpen.value = true;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        navigateImage(-1);
      } else if (e.key === 'ArrowRight') {
        navigateImage(1);
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
      isViewerOpen.value = false;
    };
  }, [images, startIndex, onClose]);

  const navigateImage = (direction: number) => {
    if (images.length <= 1) return;

    let newIndex = currentImageIndex.value + direction;
    if (newIndex < 0) newIndex = images.length - 1;
    if (newIndex >= images.length) newIndex = 0;
    currentImageIndex.value = newIndex;
  };

  const currentImage = images[currentImageIndex.value];

  if (!currentImage) return null;

  return (
    <Backdrop onClick={onClose}>
      {/* Image */}
      <Image
        src={currentImage.url}
        alt={currentImage.filename}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Close button */}
      <CloseButton onClick={onClose}>
        <i class="fas fa-times" />
      </CloseButton>

      {/* Navigation buttons (only show if multiple images) */}
      {images.length > 1 && (
        <>
          <NavButton
            class="prev"
            onClick={(e) => {
              e.stopPropagation();
              navigateImage(-1);
            }}
          >
            <i class="fas fa-chevron-left" />
          </NavButton>
          <NavButton
            class="next"
            onClick={(e) => {
              e.stopPropagation();
              navigateImage(1);
            }}
          >
            <i class="fas fa-chevron-right" />
          </NavButton>
        </>
      )}

      {/* Image info */}
      <Info>
        <div class="filename">{currentImage.filename}</div>
        {images.length > 1 && (
          <div class="counter">
            {currentImageIndex.value + 1} / {images.length}
          </div>
        )}
      </Info>
    </Backdrop>
  );
}
