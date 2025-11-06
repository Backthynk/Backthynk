import { useState, useEffect, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { styled } from 'goober';
import { zIndex } from '../styles/zIndex';

const TooltipContainer = styled('div')<{ maxWidth?: string }>`
  position: fixed;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 4px;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  z-index: ${zIndex.tooltip};
  white-space: nowrap;
  line-height: 1.4;
  max-width: ${props => props.maxWidth || '250px'};

  .dark & {
    background: rgba(255, 255, 255, 0.95);
    color: #1b1f23;
  }
`;

const TooltipTitle = styled('div')`
  font-weight: 600;
  margin-bottom: 2px;
`;

const TooltipContent = styled('div')`
  color: rgba(255, 255, 255, 0.8);
  font-size: 11px;

  .dark & {
    color: rgba(27, 31, 35, 0.7);
  }
`;

export interface TooltipProps {
  rect: DOMRect;
  content: string | string[] | { title?: string; lines?: string[] };
  maxWidth?: string;
  offset?: number;
}

export function Tooltip({ rect, content, maxWidth, offset = 8 }: TooltipProps) {
  const ref = useRef<any>(null);
  const [style, setStyle] = useState<any>({ opacity: 0 });

  useEffect(() => {
    if (!rect) return;

    // Use requestAnimationFrame to ensure the DOM is ready
    requestAnimationFrame(() => {
      if (!ref.current) return;

      // Get the actual DOM element - goober styled components store it in 'base'
      const tooltip = ref.current.base || ref.current;
      if (!tooltip || typeof tooltip.getBoundingClientRect !== 'function') {
        return;
      }

      const tooltipRect = tooltip.getBoundingClientRect();

      // Default: try below, centered
      let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
      let top = rect.bottom + offset;

      // If would go off right edge, align right
      if (left + tooltipRect.width > window.innerWidth - 8) {
        left = window.innerWidth - tooltipRect.width - 8;
      }
      // If would go off left edge, align left
      if (left < 8) {
        left = 8;
      }

      // If would go off bottom, show above instead
      if (top + tooltipRect.height > window.innerHeight - 8) {
        top = rect.top - tooltipRect.height - offset;
      }

      setStyle({
        left: `${left}px`,
        top: `${top}px`,
        opacity: 1,
      });
    });
  }, [rect, offset]);

  // Parse content
  let title: string | undefined;
  let lines: string[] = [];

  if (typeof content === 'string') {
    lines = [content];
  } else if (Array.isArray(content)) {
    lines = content;
  } else if (content && typeof content === 'object') {
    title = content.title;
    lines = content.lines || [];
  }

  return (
    <TooltipContainer ref={ref} maxWidth={maxWidth} style={style}>
      {title && <TooltipTitle>{title}</TooltipTitle>}
      {lines.length > 0 && (
        <TooltipContent>
          {lines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </TooltipContent>
      )}
    </TooltipContainer>
  );
}

// Hook for managing tooltip state
export function useTooltip(maxWidth = '250px', offset = 8) {
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    rect: DOMRect;
    content: string | string[] | { title?: string; lines?: string[] };
  } | null>(null);

  const show = (element: HTMLElement, content: string | string[] | { title?: string; lines?: string[] }) => {
    if (!element || typeof element.getBoundingClientRect !== 'function') {
      console.warn('Tooltip: Invalid element passed to show()');
      return;
    }
    const rect = element.getBoundingClientRect();
    setTooltip({ visible: true, rect, content });
  };

  const hide = () => {
    setTooltip(null);
  };

  // Render function you call in your component
  const TooltipPortal = tooltip?.visible && tooltip.rect ?
    createPortal(
      <Tooltip
        rect={tooltip.rect}
        content={tooltip.content}
        maxWidth={maxWidth}
        offset={offset}
      />,
      document.body
    ) : null;

  return { show, hide, TooltipPortal };
}