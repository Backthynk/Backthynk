import { styled } from 'goober';

export const spacesContainerStyles = {
  container: styled('div')`
    background: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 6px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: background-color 0.2s ease-in-out, border-color 0.2s ease-in-out;
  `,

  header: styled('div')`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-primary);
    flex-shrink: 0;
    transition: border-color 0.2s ease-in-out;
    background: var(--bg-tertiary);

    h2 {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
      transition: color 0.2s ease-in-out;
    }
  `,

  addButton: styled('button')`
    width: 1.75rem;
    height: 1.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    border-radius: 6px;
    transition: all 0.2s;

    &:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    i {
      font-size: 0.75rem;
    }
  `,

  spacesList: styled('div')`
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;

    /* Custom scrollbar styling */
    &::-webkit-scrollbar {
      width: 8px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--bg-tertiary);
      border-radius: 4px;
      transition: background-color 0.2s ease-in-out;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: var(--border-secondary);
    }
  `,

  spaceItem: styled('div')`
    margin-bottom: 1px;

    &.no-gap {
      margin-bottom: 0;
    }
  `,

  spaceRow: styled('div')`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
    user-select: none;
    font-size: 14px;
    font-weight: 500;
    position: relative;

    /* Fast, smooth transitions */
    transition:
      background-color 0.15s ease-out,
      color 0.15s ease-out;

    &:hover {
      background: var(--bg-hover);
    }

    &.selected {
      background: var(--bg-active);
      color: var(--text-on-active);
      font-weight: 500;

      & > * {
        color: var(--text-on-active);
      }

      i {
        color: var(--text-on-active) !important;
      }

      span:not([class*="postCount"]) {
        color: var(--text-on-active);
      }

      &.recursive {
        background: var(--recursive-bg);
        color: var(--recursive-text);

        & > * {
          color: var(--recursive-text);
        }

        i {
          color: var(--recursive-text) !important;
        }

        span:not([class*="postCount"]) {
          color: var(--recursive-text);
        }
      }
    }

    &.child-recursive {
      background: var(--recursive-bg-child);
    }
  `,

  expandButton: styled('button')`
    width: 1rem;
    height: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    flex-shrink: 0;
    transition: color 0.2s;

    &:hover {
      color: var(--text-primary);
    }

    i {
      font-size: 0.625rem;
    }
  `,

  spaceName: styled('div')`
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--text-primary);
    min-width: 0;
    transition: color 0.15s ease-out;

    i {
      font-size: 12px;
      color: var(--text-secondary);
      flex-shrink: 0;
      transition: color 0.15s ease-out;
    }

    span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }
  `,

  postCount: styled('span')`
    margin-left: auto;
    font-size: 12px;
    color: var(--count-text);
    background: var(--count-bg);
    padding: 2px 6px;
    border-radius: 20px;
    flex-shrink: 0;
    font-weight: 500;
    transition:
      background-color 0.15s ease-out,
      color 0.15s ease-out;
  `,

  children: styled('div')`
    position: relative;
  `,

  footer: styled('div')`
    border-top: 1px solid var(--border-primary);
    padding: 8px 16px;
    background: var(--bg-tertiary);
    flex-shrink: 0;
    border-radius: 0 0 6px 6px;
    transition: background-color 0.2s ease-in-out, border-color 0.2s ease-in-out;
  `,

  sortOptions: styled('div')`
    display: flex;
    align-items: center;
    gap: 0;
    width: 100%;
  `,

  sortButton: styled('button')`
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 12px;
    color: var(--text-secondary);
    transition: all 0.15s ease-in-out;
    background: transparent;
    border: none;
    padding: 4px 8px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;

    &:hover {
      color: var(--text-primary);
      background: var(--bg-hover);
    }

    &.active {
      color: var(--text-on-active);
      background: var(--bg-active);
      font-weight: 600;
    }

    i {
      font-size: 10px;
    }
  `,

  footerLinks: styled('div')`
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  `,

  footerActionsCard: styled('div')`
    background: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 6px;
    padding: 6px 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background-color 0.2s ease-in-out, border-color 0.2s ease-in-out;
  `,

  footerActionButton: styled('button')`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    color: var(--text-secondary);
    border-radius: 6px;
    transition: all 0.15s ease-in-out;
    background: transparent;
    border: none;
    cursor: pointer;

    &:hover {
      color: var(--text-primary);
      background: var(--bg-hover);
    }

    i {
      font-size: 14px;
    }

    /* Handle both button and anchor tag */
    text-decoration: none;

    /* Discord hover color */
    &:has(i.fa-discord):hover {
      color: #5865f2;
    }
  `,

  footerInfoText: styled('div')`
    font-size: 11px;
    text-align: center;
    color: var(--text-tertiary);
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: color 0.2s ease-in-out;
  `,
};
