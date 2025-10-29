import { styled } from 'goober';

// Activity Container
export const ActivityContainer = styled('div')`
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  padding: 16px;
  transition: background-color 0.2s ease-in-out, border-color 0.2s ease-in-out;

  @media (max-width: 1024px) {
    display: none; /* Hidden on mobile */
  }
`;

// Space Breadcrumb
export const SpaceBreadcrumb = styled('div')`
  margin-bottom: 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);

  .breadcrumb-separator {
    color: var(--text-tertiary);
    margin: 0 4px;
  }

  .breadcrumb-link {
    color: var(--link-primary);
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
      color: var(--link-hover);
    }
  }

  .recursive-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--activity-low);
    color: var(--text-primary);
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 20px;
    margin-left: 4px;
    position: relative;

    &:hover::after {
      content: attr(data-tooltip);
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      background: var(--bg-tooltip);
      color: var(--text-inverse);
      padding: 4px 8px;
      border-radius: 6px;
      white-space: nowrap;
      font-size: 12px;
      margin-bottom: 4px;
      z-index: 50;
    }
  }
`;

// Period Navigation
export const PeriodNav = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  gap: 12px;
`;

export const NavButton = styled('button')`
  padding: 4px;
  color: var(--text-tertiary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 0.2s;

  &:hover:not(:disabled) {
    color: var(--text-secondary);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  i {
    font-size: 12px;
  }
`;

export const PeriodLabel = styled('span')`
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 140px;
  text-align: center;
  font-weight: 600;
`;

// Heatmap Container
export const HeatmapWrapper = styled('div')`
  position: relative;
  margin-bottom: 16px;
`;

export const HeatmapGrid = styled('div')`
  display: flex;
  justify-content: center;
`;

export const HeatmapContent = styled('div')`
  min-height: 64px;
`;

export const HeatmapRow = styled('div')`
  display: flex;
  align-items: center;
  position: relative;
  margin-bottom: 3px;

  &:last-child {
    margin-bottom: 0;
  }
`;

export const MonthLabel = styled('div')`
  position: absolute;
  left: -40px;
  width: 32px;
  font-size: 11px;
  color: var(--text-tertiary);
  text-align: right;
`;

export const SquaresContainer = styled('div')`
  display: flex;
  gap: 3px;
`;

export const HeatmapSquare = styled('div')<{ intensity: number }>`
  width: 11px;
  height: 11px;
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.2s;

  ${({ intensity }) => {
    switch (intensity) {
      case 0:
        return `
          background: var(--activity-none);
          border: 1px solid rgba(27, 31, 35, 0.06);
          .dark & {
            border: 1px solid rgba(240, 246, 252, 0.1);
          }
        `;
      case 1:
        return `
          background: var(--activity-low);
        `;
      case 2:
        return `
          background: var(--activity-medium);
        `;
      case 3:
        return `
          background: var(--activity-high);
        `;
      case 4:
        return `
          background: var(--activity-very-high);
        `;
      default:
        return `
          background: var(--activity-none);
          border: 1px solid rgba(27, 31, 35, 0.06);
          .dark & {
            border: 1px solid rgba(240, 246, 252, 0.1);
          }
        `;
    }
  }}

  &:hover {
    ring: 1px solid var(--border-secondary);
    transform: scale(1.1);
  }
`;

// Legend and Summary
export const Footer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  margin-top: 12px;
`;

export const Legend = styled('div')`
  display: flex;
  align-items: center;
  gap: 6px;
`;

export const LegendItem = styled('div')`
  display: flex;
  align-items: center;
  gap: 4px;
`;

export const LegendSquare = styled('div')<{ intensity: number }>`
  width: 10px;
  height: 10px;
  border-radius: 2px;

  ${({ intensity }) => {
    switch (intensity) {
      case 0:
        return `
          background: var(--activity-none);
          border: 1px solid rgba(27, 31, 35, 0.06);
          .dark & {
            border: 1px solid rgba(240, 246, 252, 0.1);
          }
        `;
      case 1:
        return `background: var(--activity-low);`;
      case 2:
        return `background: var(--activity-medium);`;
      case 3:
        return `background: var(--activity-high);`;
      case 4:
        return `background: var(--activity-very-high);`;
      default:
        return `
          background: var(--activity-none);
          border: 1px solid rgba(27, 31, 35, 0.06);
          .dark & {
            border: 1px solid rgba(240, 246, 252, 0.1);
          }
        `;
    }
  }}
`;

export const LegendLabel = styled('span')`
  color: var(--text-tertiary);
  font-size: 11px;
`;

export const Summary = styled('div')`
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-tertiary);
  font-size: 11px;
`;

// Loading State
export const LoadingContainer = styled('div')`
  text-align: center;
  color: var(--text-tertiary);
  padding: 64px 0;

  i {
    font-size: 32px;
    margin-bottom: 16px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

// Skeleton Placeholder for Loading State
export const SkeletonHeatmap = styled('div')`
  margin-bottom: 16px;
`;

export const SkeletonRow = styled('div')`
  display: flex;
  align-items: center;
  position: relative;
  margin-bottom: 3px;

  &:last-child {
    margin-bottom: 0;
  }
`;

export const SkeletonMonthLabel = styled('div')`
  position: absolute;
  left: -40px;
  width: 32px;
  height: 11px;
  background: var(--activity-none);
  border-radius: 2px;
  opacity: 0.3;
  animation: pulse 1.5s ease-in-out infinite;

  @keyframes pulse {
    0%, 100% {
      opacity: 0.3;
    }
    50% {
      opacity: 0.6;
    }
  }
`;

export const SkeletonSquares = styled('div')`
  display: flex;
  gap: 3px;
`;

export const SkeletonSquare = styled('div')`
  width: 11px;
  height: 11px;
  border-radius: 2px;
  background: var(--activity-none);
  border: 1px solid rgba(27, 31, 35, 0.06);

  .dark & {
    border: 1px solid rgba(240, 246, 252, 0.1);
  }

  animation: pulse 1.5s ease-in-out infinite;
  animation-delay: calc(var(--index) * 0.05s);

  @keyframes pulse {
    0%, 100% {
      opacity: 0.3;
    }
    50% {
      opacity: 0.6;
    }
  }
`;

// Tooltip
export const Tooltip = styled('div')`
  position: fixed;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 4px;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  z-index: 999;
  white-space: nowrap;
  transform: translate(-50%, -100%);
  margin-top: -8px;

  .dark & {
    background: rgba(255, 255, 255, 0.95);
    color: #1b1f23;
  }

  .tooltip-count {
    font-weight: 600;
  }

  .tooltip-date {
    color: rgba(255, 255, 255, 0.8);
    margin-top: 2px;
    font-size: 11px;

    .dark & {
      color: rgba(27, 31, 35, 0.7);
    }
  }
`;

// Export all styles as a namespace
export const activityStyles = {
  container: ActivityContainer,
  breadcrumb: SpaceBreadcrumb,
  periodNav: PeriodNav,
  navButton: NavButton,
  periodLabel: PeriodLabel,
  heatmapWrapper: HeatmapWrapper,
  heatmapGrid: HeatmapGrid,
  heatmapContent: HeatmapContent,
  heatmapRow: HeatmapRow,
  monthLabel: MonthLabel,
  squaresContainer: SquaresContainer,
  heatmapSquare: HeatmapSquare,
  footer: Footer,
  legend: Legend,
  legendItem: LegendItem,
  legendSquare: LegendSquare,
  legendLabel: LegendLabel,
  summary: Summary,
  loadingContainer: LoadingContainer,
  skeletonHeatmap: SkeletonHeatmap,
  skeletonRow: SkeletonRow,
  skeletonMonthLabel: SkeletonMonthLabel,
  skeletonSquares: SkeletonSquares,
  skeletonSquare: SkeletonSquare,
  tooltip: Tooltip,
};
