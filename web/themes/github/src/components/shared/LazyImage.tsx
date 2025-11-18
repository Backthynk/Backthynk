import { useState, useEffect } from 'preact/hooks';
import { styled } from 'goober';
import { getFileIcon } from '@core/utils/files';

const ImageContainer = styled('div')`
  position: relative;
  overflow: hidden;
  background: var(--bg-secondary, #f6f8fa);
  width: 100%;
  height: 100%;
`;

const StyledImage = styled('img')<{ loaded: boolean }>`
  width: 100%;
  height: 100%;
  opacity: ${(props) => (props.loaded ? 1 : 0)};
  transition: opacity 0.3s ease-in-out;
  display: block;
  object-fit: cover;
`;

const Loader = styled('div')`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary, #f6f8fa);

  &::after {
    content: '';
    width: 24px;
    height: 24px;
    border: 3px solid var(--border-primary, #d0d7de);
    border-top-color: var(--text-link, #0969da);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const ErrorState = styled('div')`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary, #f6f8fa);
  color: var(--text-secondary, #656d76);
  font-size: 0.875rem;

  i {
    margin-right: 0.5rem;
  }
`;

const FilePlaceholder = styled('div')<{ bgColor?: string; frontColor?: string }>`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: ${(props) => props.bgColor || 'rgba(0, 0, 0, 0.015)'};
  color: ${(props) => props.frontColor || 'var(--text-secondary)'};
  min-height: 200px;

  .dark & {
    background: ${(props) => props.bgColor || 'rgba(255, 255, 255, 0.015)'};
  }

  i {
    font-size: 3rem;
    color: ${(props) => props.frontColor || 'var(--text-secondary)'};
    margin-bottom: 0.5rem;
  }

  .file-type {
    font-size: 1rem;
    font-weight: 600;
    color: ${(props) => props.frontColor || 'var(--text-primary)'};
    text-transform: uppercase;
  }
`;

const ShadowOverlay = styled('div')<{ visibility: 'hover' | 'always' | 'never' }>`
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.15) 30%, transparent 60%);
  border-radius: inherit;
  opacity: ${(props) => (props.visibility === 'always' ? 1 : 0)};
  transition: opacity 0.3s ease;
  pointer-events: none;
  z-index: 1;
  display: ${(props) => (props.visibility === 'never' ? 'none' : 'block')};

  ${ImageContainer}:hover & {
    opacity: ${(props) => (props.visibility === 'hover' || props.visibility === 'always' ? 1 : 0)};
  }
`;

const FileDescriptionOverlay = styled('div')<{ visibility: 'hover' | 'always' | 'never' }>`
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.15) 30%, transparent 60%);
  padding: 0.5rem;
  border-radius: inherit;
  display: ${(props) => (props.visibility === 'never' ? 'none' : 'flex')};
  flex-direction: column;
  justify-content: flex-end;
  opacity: ${(props) => (props.visibility === 'always' ? 1 : 0)};
  transition: opacity 0.3s ease;
  z-index: 2;

  ${ImageContainer}:hover & {
    opacity: ${(props) => (props.visibility === 'hover' || props.visibility === 'always' ? 1 : 0)};
  }

  /* Always show on mobile/tablet (can't hover) */
  @media (hover: none) {
    opacity: ${(props) => (props.visibility === 'never' ? 0 : 1)};
  }

  p {
    color: white;
    font-size: 0.875rem;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin: 0;
  }

  .size {
    opacity: 0.8;
    font-size: 0.75rem;
    margin-top: 0.25rem;
  }
`;

type OverlayVisibility = 'hover' | 'always' | 'never';

interface PreviewConfig {
  size: 'small' | 'medium' | 'large';
  bgColor?: string;
  frontColor?: string;
}

interface FileDescription {
  filename: string;
  fileSize?: string;
}

interface LazyImageProps extends Omit<JSX.HTMLAttributes<HTMLImageElement>, 'loading'> {
  src: string;
  alt: string;
  className?: string;
  style?: any;
  onClick?: (e: MouseEvent) => void;
  onError?: (e: Event) => void;
  preview?: PreviewConfig;
  bgOverlay?: OverlayVisibility;
  fileDescription?: FileDescription;
  fileDescriptionVisibility?: OverlayVisibility;
}

export function LazyImage({
  src,
  alt,
  className,
  style,
  onClick,
  onError,
  preview,
  bgOverlay = 'never',
  fileDescription,
  fileDescriptionVisibility = 'never',
  ...props
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState('');
  const [error, setError] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(false);

  console.log(src);
  // Get file extension from src for placeholder icon
  const getFileExtension = (url: string): string => {
    try {
      const urlWithoutQuery = url.split('?')[0];
      const parts = urlWithoutQuery.split('/');
      const filename = parts[parts.length - 1];
      return filename.split('.').pop()?.toLowerCase() || 'FILE';
    } catch {
      return 'FILE';
    }
  };

  // Initialize src on mount or when src/preview changes
  useEffect(() => {
    setLoaded(false);
    setError(false);
    setShowPlaceholder(false);

    if (preview) {
      // Try with preview size first
      setCurrentSrc(`${src}?size=${preview.size}`);
    } else {
      // No preview - use original src
      setCurrentSrc(src);
    }
  }, [src, preview]);

  const handleLoad = () => {
    setLoaded(true);
    setError(false);
  };

  const handleError = (e: Event) => {
    if (onError) {
      onError(e);
    }

    // If preview is set and we failed with preview size, try original
    if (preview && currentSrc.includes('?size=')) {
      // Try to load original image
      setCurrentSrc(src);
      setError(false);
      return;
    }

    // Check if this is an image by trying to detect from extension
    const ext = getFileExtension(src);
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
    const isImage = imageExtensions.includes(ext);

    if (isImage) {
      // For images that failed, try origin if we haven't already
      // This is a fallback - we've already tried the original above
      // So at this point, just show error
      setError(true);
      setShowPlaceholder(false);
    } else {
      // Not an image - show file placeholder
      setShowPlaceholder(true);
      setError(false);
    }
  };

  // No preview set and error occurred - show simple error state
  if (!preview && error) {
    return (
      <ImageContainer className={className} style={style}>
        <ErrorState>
          <i class="fas fa-image" />
          Failed to load image
        </ErrorState>
      </ImageContainer>
    );
  }

  // Show file placeholder for non-images
  if (showPlaceholder) {
    const fileExtension = getFileExtension(src);
    return (
      <ImageContainer className={className} style={style}>
        <FilePlaceholder bgColor={preview?.bgColor} frontColor={preview?.frontColor}>
          <i class={`fas ${getFileIcon(fileExtension)}`} />
          <span class="file-type">{fileExtension}</span>
        </FilePlaceholder>
        {fileDescription && (
          <FileDescriptionOverlay visibility={fileDescriptionVisibility}>
            <p>{fileDescription.filename}</p>
            {fileDescription.fileSize && <p class="size">{fileDescription.fileSize}</p>}
          </FileDescriptionOverlay>
        )}
      </ImageContainer>
    );
  }

  return (
    <ImageContainer className={className} style={style}>
      <StyledImage
        src={currentSrc}
        alt={alt}
        loaded={loaded}
        onLoad={handleLoad}
        onError={handleError}
        onClick={onClick}
        loading="lazy"
        {...props}
      />
      {!loaded && !error && !showPlaceholder && <Loader />}
      {bgOverlay !== 'never' && <ShadowOverlay visibility={bgOverlay} />}
      {fileDescription && (
        <FileDescriptionOverlay visibility={fileDescriptionVisibility}>
          <p>{fileDescription.filename}</p>
          {fileDescription.fileSize && <p class="size">{fileDescription.fileSize}</p>}
        </FileDescriptionOverlay>
      )}
    </ImageContainer>
  );
}
