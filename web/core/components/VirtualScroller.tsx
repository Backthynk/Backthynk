import { useEffect, useRef, useState, useMemo } from 'preact/hooks';

interface VirtualScrollerProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => preact.JSX.Element;
  buffer?: number;
  className?: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  threshold?: number;
}

export function VirtualScroller<T extends { id: number | string }>({
  items,
  itemHeight,
  renderItem,
  buffer = 5,
  className = '',
  onLoadMore,
  hasMore = false,
  threshold = 300,
}: VirtualScrollerProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
    const visibleCount = Math.ceil(containerHeight / itemHeight) + buffer * 2;
    const endIndex = Math.min(items.length, startIndex + visibleCount);

    return { startIndex, endIndex };
  }, [scrollTop, containerHeight, itemHeight, items.length, buffer]);

  // Handle scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);

      // Check if we need to load more
      if (onLoadMore && hasMore) {
        const scrollPosition = container.scrollTop + container.clientHeight;
        const scrollHeight = container.scrollHeight;

        if (scrollHeight - scrollPosition < threshold) {
          onLoadMore();
        }
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [onLoadMore, hasMore, threshold]);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateHeight = () => {
      setContainerHeight(container.clientHeight);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const totalHeight = items.length * itemHeight;
  const offsetY = visibleRange.startIndex * itemHeight;

  return (
    <div ref={containerRef} class={`overflow-auto ${className}`} style={{ height: '100%' }}>
      <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {items.slice(visibleRange.startIndex, visibleRange.endIndex).map((item, idx) => (
            <div key={item.id} style={{ height: `${itemHeight}px` }}>
              {renderItem(item, visibleRange.startIndex + idx)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
