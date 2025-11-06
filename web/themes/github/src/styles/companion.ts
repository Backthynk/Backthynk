import { styled, keyframes } from 'goober';

const pulseAnimation = keyframes`
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 var(--recursive-pulse-start);
    border-color: var(--border-primary);
  }
  50% {
    transform: scale(1.03);
    box-shadow: 0 0 0 12px var(--recursive-pulse-mid);
    border-color: var(--recursive-pulse-border);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 var(--recursive-pulse-mid);
    border-color: var(--border-primary);
  }
`;

const badgePulse = keyframes`
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.1);
  }
`;

const badgeAppear = keyframes`
  0% {
    opacity: 0;
    transform: scale(0.5) rotate(-180deg);
  }
  60% {
    transform: scale(1.15) rotate(10deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
`;

const badgeDisappear = keyframes`
  0% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
  100% {
    opacity: 0;
    transform: scale(0.5) rotate(180deg);
  }
`;

export const companionStyles = {
  container: styled('div')`
    position: sticky;
    top: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  `,

  searchContainer: styled('div')`
    display: flex;
    align-items: center;
    gap: 8px;
  `,

  searchInput: styled('input')`
    flex: 1;
    padding: 8px 12px;
    font-size: 14px;
    background: var(--bg-secondary);
    color: var(--text-tertiary);
    border: 1px solid var(--border-primary);
    border-radius: 6px;
    cursor: not-allowed;
    transition: background-color 0.2s ease-in-out, border-color 0.2s ease-in-out, color 0.2s ease-in-out;

    &:focus {
      outline: none;
    }

    &::placeholder {
      color: var(--text-tertiary);
    }
  `,

  spaceHeader: styled('div')`
    background: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    padding: 16px;
    box-shadow: var(--shadow-sm);
    transition: background-color 0.2s ease-in-out, border-color 0.2s ease-in-out;
  `,

  headerContent: styled('div')`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 8px;
  `,

  titleSection: styled('div')`
    flex: 1;
    min-width: 0;
  `,

  title: styled('h2')`
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 4px 0;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: color 0.2s ease-in-out;
  `,

  titleClickable: styled('span')`
    cursor: pointer;

    &:hover {
      color: var(--accent-primary);
    }
  `,

  recursiveBadge: styled('span')`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px 8px;
    background: var(--accent-recursive);
    color: var(--text-inverted);
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    cursor: default;
    pointer-events: none;
    animation: ${badgeAppear} 0.4s ease-out forwards;

    &.disappearing {
      animation: ${badgeDisappear} 0.3s ease-in forwards;
    }
  `,

  stats: styled('div')`
    font-size: 12px;
    color: var(--text-secondary);
    transition: color 0.2s ease-in-out;
  `,

  description: styled('div')`
    padding-top: 12px;
    margin-top: 12px;
    border-top: 1px solid var(--border-primary);
    font-size: 12px;
    color: var(--text-tertiary);
    font-style: italic;
    line-height: 1.5;
    transition: color 0.2s ease-in-out, border-color 0.2s ease-in-out;
  `,
};
