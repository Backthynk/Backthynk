import { useState, useEffect, useRef } from 'preact/hooks';
import { styled } from 'goober';

const TooltipContainer = styled('div')`
  position: fixed;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 4px;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  z-index: 999;
  white-space: pre-line;
  transform: translate(-50%, -100%);
  margin-top: -8px;
  line-height: 1.4;
  max-width: 250px;

  .dark & {
    background: rgba(255, 255, 255, 0.95);
    color: #1b1f23;
  }

  strong {
    font-weight: 600;
  }

  .tooltip-secondary {
    color: rgba(255, 255, 255, 0.8);
    margin-top: 2px;
    font-size: 11px;

    .dark & {
      color: rgba(27, 31, 35, 0.7);
    }
  }
`;

interface TooltipProps {
  x: number;
  y: number;
  children: any;
}

export function Tooltip({ x, y, children }: TooltipProps) {
  return (
    <TooltipContainer style={{ left: `${x}px`, top: `${y}px` }}>
      {children}
    </TooltipContainer>
  );
}

// Hook for managing tooltip state
export function useTooltip() {
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    content: any;
  }>({
    visible: false,
    x: 0,
    y: 0,
    content: null,
  });

  const showTooltip = (e: MouseEvent, content: any) => {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    setTooltip({
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top,
      content,
    });
  };

  const hideTooltip = () => {
    setTooltip({
      visible: false,
      x: 0,
      y: 0,
      content: null,
    });
  };

  return { tooltip, showTooltip, hideTooltip };
}
