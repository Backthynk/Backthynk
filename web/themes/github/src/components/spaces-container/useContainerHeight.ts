import { useEffect, useState, type RefObject } from 'preact/hooks';

interface HeightConfig {
  gaps?: number;      // Number of 1rem gaps between components
  padding?: number;   // Total padding in rem (top + bottom)
  maxHeight?: number; // Optional max height in pixels
}

/**
 * Calculates dynamic max-height for a container by subtracting measured element heights
 *
 * @param refs - Array of refs to elements that should be subtracted from viewport height
 * @param config - Configuration for gaps, padding, and optional max height
 * @returns CSS max-height string (e.g., "calc(100vh - 12.5rem)" or "min(calc(100vh - 12.5rem), 800px)")
 *
 * @example
 * const footerRef = useRef<HTMLDivElement>(null);
 * const buttonRef = useRef<HTMLDivElement>(null);
 * const maxHeight = useContainerHeight([footerRef, buttonRef], { gaps: 3, padding: 2 });
 */
export function useContainerHeight(
  refs: RefObject<HTMLElement>[],
  config: HeightConfig = {}
): string {
  const { gaps = 0, padding = 0, maxHeight } = config;
  const [totalHeight, setTotalHeight] = useState(0);

  useEffect(() => {
    // Measure all elements and sum their heights
    const measureElements = () => {
      let heightInPx = 0;

      refs.forEach(ref => {
        if (ref.current) {
          heightInPx += ref.current.offsetHeight;
        }
      });

      // Convert px to rem (assuming 16px = 1rem)
      const heightInRem = heightInPx / 16;
      setTotalHeight(heightInRem);
    };

    // Initial measurement
    measureElements();

    // Create ResizeObserver to watch for size changes
    const resizeObserver = new ResizeObserver(measureElements);

    // Observe all refs
    refs.forEach(ref => {
      if (ref.current) {
        resizeObserver.observe(ref.current);
      }
    });

    // Watch for window resize
    window.addEventListener('resize', measureElements);

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', measureElements);
    };
  }, [refs, gaps, padding]);

  // Calculate total height to subtract
  const subtractHeight = padding + totalHeight + gaps;
  const calculatedMaxHeight = `calc(100vh - ${subtractHeight}rem)`;

  // Return with optional max height constraint
  return maxHeight
    ? `min(${calculatedMaxHeight}, ${maxHeight}px)`
    : calculatedMaxHeight;
}
