/**
 * LazyImage Component Automated Unit Tests
 *
 * Tests the LazyImage component behavior with mocked image loading
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/preact';
import { LazyImage } from '../LazyImage';

// ============================================================================
// TEST URLS (Mocked - for reference only)
// ============================================================================

const MOCK_URLS = {
  // Remote image - Should fail with preview size, succeed with original
  REMOTE_IMAGE: 'https://pbs.twimg.com/profile_images/1695778664217206784/ipj0m5rq_400x400.jpg',

  // PDF file - Should display file placeholder
  LOCAL_PDF: 'http://localhost:1369/uploads/1763356920_The.Go.Programming.Language.pdf',

  // Text file - Should display file placeholder
  LOCAL_TEXT: 'http://localhost:1369/uploads/1763356920_message.txt',

  // Non-existent file - Should display error fallback
  NONEXISTENT: 'http://localhost:1369/uploads/17633_message.txt',

  // Local filesystem image - Should work
  LOCAL_IMAGE: '/home/louis/Pictures/Screenshots/Screenshot from 2025-07-03 06-28-53.png',

  // Local filesystem PDF - Should display file placeholder
  LOCAL_FS_PDF: '/home/louis/Downloads/ao-taotlus-est-eng-27.12.2023.pdf',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Simulate image load success
 */
const triggerImageLoad = (img: HTMLImageElement) => {
  fireEvent.load(img);
};

/**
 * Simulate image load error
 */
const triggerImageError = (img: HTMLImageElement) => {
  fireEvent.error(img);
};

/**
 * Get the img element from container
 */
const getImage = (container: HTMLElement): HTMLImageElement | null => {
  return container.querySelector('img');
};

/**
 * Check if error state is showing
 */
const hasErrorState = (container: HTMLElement): boolean => {
  return container.textContent?.includes('Failed to load image') || false;
};

/**
 * Check if file placeholder is showing
 */
const hasFilePlaceholder = (container: HTMLElement): boolean => {
  return container.querySelector('.file-type') !== null;
};

/**
 * Get file type from placeholder
 */
const getFileType = (container: HTMLElement): string | null => {
  return container.querySelector('.file-type')?.textContent || null;
};

// ============================================================================
// TESTS WITH PREVIEW PARAMETER
// ============================================================================

describe('LazyImage - WITH preview parameter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render image with preview size in URL', () => {
    const { container } = render(
      <LazyImage
        src={MOCK_URLS.REMOTE_IMAGE}
        alt="Test image"
        preview={{ size: 'medium' }}
      />
    );

    const img = getImage(container);
    expect(img).toBeTruthy();
    expect(img?.src).toContain('?size=medium');
  });

  it('should hide loader after image loads successfully', async () => {
    const { container } = render(
      <LazyImage
        src={MOCK_URLS.REMOTE_IMAGE}
        alt="Test image"
        preview={{ size: 'medium' }}
      />
    );

    const img = getImage(container);
    expect(img).toBeTruthy();

    // Trigger load
    triggerImageLoad(img!);

    await waitFor(() => {
      // Check that image has opacity: 1 (loaded state)
      const style = window.getComputedStyle(img!);
      expect(parseFloat(style.opacity)).toBe(1);
    });
  });

  it('should fallback to original URL when preview fails (remote image)', async () => {
    const { container } = render(
      <LazyImage
        src={MOCK_URLS.REMOTE_IMAGE}
        alt="Test image"
        preview={{ size: 'medium' }}
      />
    );

    const img = getImage(container);
    expect(img).toBeTruthy();
    expect(img?.src).toContain('?size=medium');

    // Trigger error on preview URL
    triggerImageError(img!);

    await waitFor(() => {
      const img = getImage(container);
      expect(img?.src).toBe(MOCK_URLS.REMOTE_IMAGE);
      expect(img?.src).not.toContain('?size=');
    });
  });

  it('should show file placeholder for PDF files', async () => {
    const { container } = render(
      <LazyImage
        src={MOCK_URLS.LOCAL_PDF}
        alt="Test PDF"
        preview={{ size: 'medium' }}
      />
    );

    const img = getImage(container);
    expect(img).toBeTruthy();

    // Trigger error on preview URL
    triggerImageError(img!);

    // Wait for src to change to original
    await waitFor(() => {
      const img = getImage(container);
      expect(img?.src).toBe(MOCK_URLS.LOCAL_PDF);
    });

    // Trigger error on original URL too
    const imgAfterFallback = getImage(container);
    if (imgAfterFallback) {
      triggerImageError(imgAfterFallback);
    }

    // Should show placeholder
    await waitFor(() => {
      expect(hasFilePlaceholder(container)).toBe(true);
      expect(getFileType(container)?.toLowerCase()).toBe('pdf');
    });
  });

  it('should show file placeholder for text files', async () => {
    const { container } = render(
      <LazyImage
        src={MOCK_URLS.LOCAL_TEXT}
        alt="Test text file"
        preview={{ size: 'medium' }}
      />
    );

    let img = getImage(container);
    triggerImageError(img!);

    await waitFor(() => {
      const img = getImage(container);
      expect(img?.src).toBe(MOCK_URLS.LOCAL_TEXT);
    });

    img = getImage(container);
    if (img) {
      triggerImageError(img);
    }

    await waitFor(() => {
      expect(hasFilePlaceholder(container)).toBe(true);
      expect(getFileType(container)?.toLowerCase()).toBe('txt');
    });
  });

  it('should work with local filesystem image', () => {
    const { container } = render(
      <LazyImage
        src={MOCK_URLS.LOCAL_IMAGE}
        alt="Local image"
        preview={{ size: 'medium' }}
      />
    );

    const img = getImage(container);
    expect(img).toBeTruthy();
    expect(img?.src).toContain('?size=medium');
  });

  it('should handle different preview sizes (small, medium, large)', () => {
    const sizes: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];

    sizes.forEach(size => {
      const { container } = render(
        <LazyImage
          src={MOCK_URLS.REMOTE_IMAGE}
          alt={`Test ${size}`}
          preview={{ size }}
        />
      );

      const img = getImage(container);
      expect(img?.src).toContain(`?size=${size}`);
    });
  });
});

// ============================================================================
// TESTS WITHOUT PREVIEW PARAMETER
// ============================================================================

describe('LazyImage - WITHOUT preview parameter', () => {
  it('should load image directly without preview size parameter', () => {
    const { container } = render(
      <LazyImage
        src={MOCK_URLS.REMOTE_IMAGE}
        alt="Test image"
      />
    );

    const img = getImage(container);
    expect(img).toBeTruthy();
    expect(img?.src).toBe(MOCK_URLS.REMOTE_IMAGE);
    expect(img?.src).not.toContain('?size=');
  });

  it('should hide loader after image loads', async () => {
    const { container } = render(
      <LazyImage
        src={MOCK_URLS.REMOTE_IMAGE}
        alt="Test image"
      />
    );

    const img = getImage(container);
    triggerImageLoad(img!);

    await waitFor(() => {
      const style = window.getComputedStyle(img!);
      expect(parseFloat(style.opacity)).toBe(1);
    });
  });

  it('should show error for non-existent image file', async () => {
    // Use a .jpg extension so it's detected as an image
    const nonExistentImage = 'http://localhost:1369/uploads/nonexistent.jpg';

    const { container } = render(
      <LazyImage
        src={nonExistentImage}
        alt="Non-existent"
      />
    );

    const img = getImage(container);
    triggerImageError(img!);

    await waitFor(() => {
      expect(hasErrorState(container)).toBe(true);
    });
  });

  it('should work with local filesystem image', () => {
    const { container } = render(
      <LazyImage
        src={MOCK_URLS.LOCAL_IMAGE}
        alt="Local image"
      />
    );

    const img = getImage(container);
    expect(img).toBeTruthy();
    // Browser normalizes paths and URL-encodes spaces
    expect(img?.src).toContain('Screenshot');
    expect(img?.src).toContain('.png');
  });
});

// ============================================================================
// CALLBACK TESTS
// ============================================================================

describe('LazyImage - Callbacks and Events', () => {
  it('should call onError callback when image fails to load', async () => {
    const onError = vi.fn();

    const { container } = render(
      <LazyImage
        src={MOCK_URLS.NONEXISTENT}
        alt="Test"
        onError={onError}
      />
    );

    const img = getImage(container);
    triggerImageError(img!);

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });
  });

  it('should call onClick when image is clicked', () => {
    const onClick = vi.fn();

    const { container } = render(
      <LazyImage
        src={MOCK_URLS.REMOTE_IMAGE}
        alt="Test"
        onClick={onClick}
      />
    );

    const img = getImage(container);
    fireEvent.click(img!);

    expect(onClick).toHaveBeenCalled();
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('LazyImage - Edge Cases', () => {
  it('should handle missing file extension gracefully', async () => {
    const urlWithoutExt = 'http://example.com/file';

    const { container } = render(
      <LazyImage
        src={urlWithoutExt}
        alt="No extension"
        preview={{ size: 'medium' }}
      />
    );

    const img = getImage(container);
    triggerImageError(img!);

    await waitFor(() => {
      const img = getImage(container);
      if (img?.src === urlWithoutExt) {
        triggerImageError(img);
      }
    });

    await waitFor(() => {
      expect(hasFilePlaceholder(container)).toBe(true);
      expect(getFileType(container)?.toUpperCase()).toBe('FILE');
    });
  });

  it('should handle URLs with query parameters correctly', () => {
    const urlWithParams = 'http://example.com/image.jpg?v=123';

    const { container } = render(
      <LazyImage
        src={urlWithParams}
        alt="With params"
        preview={{ size: 'medium' }}
      />
    );

    const img = getImage(container);
    // URL already has params, should add size with &
    expect(img?.src).toContain('v=123');
    expect(img?.src).toContain('size=medium');
  });

  it('should handle className prop', () => {
    const { container } = render(
      <LazyImage
        src={MOCK_URLS.REMOTE_IMAGE}
        alt="Test"
        className="custom-class"
      />
    );

    // className is applied to the ImageContainer wrapper
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('custom-class');
  });
});

// ============================================================================
// OVERLAY AND FILE DESCRIPTION TESTS
// ============================================================================

describe('LazyImage - Background Overlay', () => {
  it('should not show bg overlay by default (never)', () => {
    const { container } = render(
      <LazyImage
        src={MOCK_URLS.REMOTE_IMAGE}
        alt="Test"
      />
    );

    // No bgOverlay prop means default 'never' - overlay should not exist or be hidden
    const overlays = container.querySelectorAll('div');
    const hasVisibleOverlay = Array.from(overlays).some(div => {
      const style = window.getComputedStyle(div);
      return style.background.includes('gradient') && style.display !== 'none';
    });

    // With default 'never', gradient overlays should not be visible
    expect(hasVisibleOverlay).toBe(false);
  });

  it('should show bg overlay on hover when set to "hover"', () => {
    const { container } = render(
      <LazyImage
        src={MOCK_URLS.REMOTE_IMAGE}
        alt="Test"
        bgOverlay="hover"
      />
    );

    // Should render an overlay element
    const overlays = container.querySelectorAll('div');
    const gradientOverlay = Array.from(overlays).find(div => {
      const style = window.getComputedStyle(div);
      return style.background.includes('gradient') &&
             style.position === 'absolute' &&
             !div.querySelector('p'); // Not the file description overlay
    });

    expect(gradientOverlay).toBeTruthy();
  });

  it('should show bg overlay always when set to "always"', () => {
    const { container } = render(
      <LazyImage
        src={MOCK_URLS.REMOTE_IMAGE}
        alt="Test"
        bgOverlay="always"
      />
    );

    // Should render an overlay element with opacity 1
    const overlays = container.querySelectorAll('div');
    const gradientOverlay = Array.from(overlays).find(div => {
      const style = window.getComputedStyle(div);
      return style.background.includes('gradient') &&
             style.position === 'absolute' &&
             !div.querySelector('p');
    });

    expect(gradientOverlay).toBeTruthy();
  });

  it('should never show bg overlay when set to "never"', () => {
    const { container } = render(
      <LazyImage
        src={MOCK_URLS.REMOTE_IMAGE}
        alt="Test"
        bgOverlay="never"
      />
    );

    // Overlay should either not exist or be hidden
    const overlays = container.querySelectorAll('div');
    const gradientOverlay = Array.from(overlays).find(div => {
      const style = window.getComputedStyle(div);
      return style.background.includes('gradient') &&
             style.position === 'absolute' &&
             !div.querySelector('p') &&
             style.display !== 'none';
    });

    expect(gradientOverlay).toBeFalsy();
  });
});

describe('LazyImage - File Description Overlay', () => {
  const fileDesc = {
    filename: 'test-document.pdf',
    fileSize: '2.5 MB'
  };

  it('should not show file description when not provided', () => {
    const { container } = render(
      <LazyImage
        src={MOCK_URLS.REMOTE_IMAGE}
        alt="Test"
      />
    );

    expect(container.textContent).not.toContain('test-document.pdf');
  });

  it('should show file description on hover when visibility is "hover"', () => {
    const { container } = render(
      <LazyImage
        src={MOCK_URLS.REMOTE_IMAGE}
        alt="Test"
        fileDescription={fileDesc}
        fileDescriptionVisibility="hover"
      />
    );

    expect(container.textContent).toContain('test-document.pdf');
    expect(container.textContent).toContain('2.5 MB');

    // Should have overlay with text
    const overlay = Array.from(container.querySelectorAll('div')).find(div =>
      div.textContent?.includes('test-document.pdf')
    );
    expect(overlay).toBeTruthy();
  });

  it('should show file description always when visibility is "always"', () => {
    const { container } = render(
      <LazyImage
        src={MOCK_URLS.REMOTE_IMAGE}
        alt="Test"
        fileDescription={fileDesc}
        fileDescriptionVisibility="always"
      />
    );

    expect(container.textContent).toContain('test-document.pdf');
    expect(container.textContent).toContain('2.5 MB');
  });

  it('should not show file description when visibility is "never"', () => {
    const { container } = render(
      <LazyImage
        src={MOCK_URLS.REMOTE_IMAGE}
        alt="Test"
        fileDescription={fileDesc}
        fileDescriptionVisibility="never"
      />
    );

    // Element should exist but with display: none
    const text = container.textContent || '';
    // Text exists in DOM but overlay has display: none
    expect(text).toContain('test-document.pdf');

    // Verify the overlay has display: none
    const overlay = Array.from(container.querySelectorAll('div')).find(div =>
      div.textContent?.includes('test-document.pdf')
    );
    expect(overlay).toBeTruthy();
    const style = window.getComputedStyle(overlay!);
    expect(style.display).toBe('none');
  });

  it('should show file description without file size', () => {
    const { container } = render(
      <LazyImage
        src={MOCK_URLS.REMOTE_IMAGE}
        alt="Test"
        fileDescription={{ filename: 'test.pdf' }}
        fileDescriptionVisibility="always"
      />
    );

    expect(container.textContent).toContain('test.pdf');
    // Should have only one p tag (filename, no size)
    const overlay = Array.from(container.querySelectorAll('div')).find(div =>
      div.textContent?.includes('test.pdf')
    );
    const paragraphs = overlay?.querySelectorAll('p');
    expect(paragraphs?.length).toBe(1);
  });

  it('should show file description on placeholder for non-images', async () => {
    const { container } = render(
      <LazyImage
        src={MOCK_URLS.LOCAL_PDF}
        alt="Test PDF"
        preview={{ size: 'medium' }}
        fileDescription={fileDesc}
        fileDescriptionVisibility="always"
      />
    );

    const img = getImage(container);
    triggerImageError(img!);

    await waitFor(() => {
      const img = getImage(container);
      if (img) {
        triggerImageError(img);
      }
    });

    await waitFor(() => {
      expect(hasFilePlaceholder(container)).toBe(true);
      expect(container.textContent).toContain('test-document.pdf');
      expect(container.textContent).toContain('2.5 MB');
    });
  });
});

describe('LazyImage - Combined Overlays', () => {
  it('should show both bg overlay and file description when both are configured', () => {
    const { container } = render(
      <LazyImage
        src={MOCK_URLS.REMOTE_IMAGE}
        alt="Test"
        bgOverlay="hover"
        fileDescription={{ filename: 'image.jpg', fileSize: '1.2 MB' }}
        fileDescriptionVisibility="hover"
      />
    );

    // Should have gradient background overlays
    const overlays = container.querySelectorAll('div');
    expect(overlays.length).toBeGreaterThan(1);

    // Should show file description
    expect(container.textContent).toContain('image.jpg');
    expect(container.textContent).toContain('1.2 MB');
  });

  it('should handle different visibility combinations', () => {
    const { container } = render(
      <LazyImage
        src={MOCK_URLS.REMOTE_IMAGE}
        alt="Test"
        bgOverlay="always"
        fileDescription={{ filename: 'photo.png' }}
        fileDescriptionVisibility="never"
      />
    );

    // BG overlay should exist (position absolute, pointer-events none)
    const gradientOverlay = Array.from(container.querySelectorAll('div')).find(div => {
      const style = window.getComputedStyle(div);
      return style.background.includes('gradient') &&
             style.position === 'absolute' &&
             style.pointerEvents === 'none' &&
             !div.querySelector('p');
    });
    expect(gradientOverlay).toBeTruthy();

    // File description should exist but be hidden (display: none)
    const fileDescOverlay = Array.from(container.querySelectorAll('div')).find(div =>
      div.textContent?.includes('photo.png')
    );
    expect(fileDescOverlay).toBeTruthy();
    const style = window.getComputedStyle(fileDescOverlay!);
    expect(style.display).toBe('none');
  });
});
