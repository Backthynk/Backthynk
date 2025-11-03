import { useState } from 'preact/hooks';
import { styled } from 'goober';

const ImageContainer = styled('div')`
  position: relative;
  overflow: hidden;
  background: var(--bg-secondary, #f6f8fa);
`;

const StyledImage = styled('img')<{ loaded: boolean }>`
  width: 100%;
  height: 100%;
  opacity: ${(props) => (props.loaded ? 1 : 0)};
  transition: opacity 0.3s ease-in-out;
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

interface LazyImageProps extends Omit<JSX.HTMLAttributes<HTMLImageElement>, 'loading'> {
  src: string;
  alt: string;
  className?: string;
  style?: any;
  onClick?: (e: MouseEvent) => void;
  onError?: (e: Event) => void;
  showLoader?: boolean; // Show loading spinner (default: true)
  showError?: boolean; // Show error message on failure (default: true)
}

export function LazyImage({
  src,
  alt,
  className,
  style,
  onClick,
  onError,
  showLoader = true,
  showError = true,
  ...props
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const handleLoad = () => {
    setLoaded(true);
  };

  const handleError = (e: Event) => {
    setError(true);
    if (onError) {
      onError(e);
    }
  };

  return (
    <ImageContainer className={className} style={style}>
      <StyledImage
        src={src}
        alt={alt}
        loaded={loaded}
        onLoad={handleLoad}
        onError={handleError}
        onClick={onClick}
        loading="lazy"
        {...props}
      />
      {!loaded && !error && showLoader && <Loader />}
      {error && showError && (
        <ErrorState>
          <i class="fas fa-image" />
          Failed to load image
        </ErrorState>
      )}
    </ImageContainer>
  );
}
