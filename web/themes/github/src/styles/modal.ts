import { styled } from 'goober';

export const modalStyles = {
  overlay: styled('div')`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
    backdrop-filter: blur(2px);
  `,

  container: styled('div')`
    background: var(--bg-primary);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: background-color 0.2s ease-in-out, border-color 0.2s ease-in-out;

    &.small {
      width: 400px;
    }

    &.medium {
      width: 500px;
    }

    &.large {
      width: 700px;
    }
  `,

  header: styled('div')`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-primary);
    flex-shrink: 0;
    background: var(--bg-secondary);
    transition: background-color 0.2s ease-in-out, border-color 0.2s ease-in-out;
  `,

  title: styled('h2')`
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    transition: color 0.2s ease-in-out;
  `,

  closeButton: styled('button')`
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    border-radius: 6px;
    transition: all 0.2s;
    background: transparent;
    border: none;
    cursor: pointer;

    &:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    i {
      font-size: 14px;
    }
  `,

  content: styled('div')`
    padding: 20px;
    overflow-y: auto;
    overflow-x: hidden;
    flex: 1;
    min-height: 0;

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

  footer: styled('div')`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid var(--border-primary);
    flex-shrink: 0;
    background: var(--bg-secondary);
    transition: background-color 0.2s ease-in-out, border-color 0.2s ease-in-out;
  `,
};

export const formStyles = {
  formGroup: styled('div')`
    margin-bottom: 16px;
    overflow: visible;

    &:last-child {
      margin-bottom: 0;
    }
  `,

  label: styled('label')`
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 6px;
    transition: color 0.2s ease-in-out;
  `,

  input: styled('input')`
    width: 100%;
    padding: 8px 12px;
    font-size: 14px;
    color: var(--text-primary);
    background: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 6px;
    outline: none;
    transition: all 0.2s ease-in-out;
    font-family: inherit;

    &:focus {
      border-color: var(--bg-active);
      box-shadow: 0 0 0 3px rgba(3, 102, 214, 0.1);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    &.error {
      border-color: #d73a49;
    }
  `,

  textarea: styled('textarea')`
    width: 100%;
    padding: 8px 12px;
    font-size: 14px;
    color: var(--text-primary);
    background: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 6px;
    outline: none;
    transition: all 0.2s ease-in-out;
    resize: vertical;
    min-height: 80px;
    font-family: inherit;

    &:focus {
      border-color: var(--bg-active);
      box-shadow: 0 0 0 3px rgba(3, 102, 214, 0.1);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `,

  error: styled('div')`
    font-size: 12px;
    color: #d73a49;
    margin-top: 4px;
  `,

  hint: styled('div')`
    font-size: 12px;
    color: var(--text-tertiary);
    margin-top: 4px;
    transition: color 0.2s ease-in-out;
  `,

  button: styled('button')`
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 500;
    border-radius: 6px;
    transition: all 0.2s;
    cursor: pointer;
    border: 1px solid transparent;
    font-family: inherit;

    &.primary {
      background: var(--bg-active);
      color: var(--text-on-active);
      border-color: var(--bg-active);

      &:hover:not(:disabled) {
        opacity: 0.9;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    &.secondary {
      background: transparent;
      color: var(--text-primary);
      border-color: var(--border-primary);

      &:hover:not(:disabled) {
        background: var(--bg-hover);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    &.success {
      background: #1a7f37;
      color: #ffffff;
      border-color: rgba(27, 31, 36, 0.15);

      &:hover:not(:disabled) {
        background: #2da44e;
      }

      &:active:not(:disabled) {
        background: #1a7f37;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    &.danger {
      background: #d73a49;
      color: #ffffff;
      border-color: rgba(27, 31, 36, 0.15);

      &:hover:not(:disabled) {
        background: #cb2431;
      }

      &:active:not(:disabled) {
        background: #b31d28;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  `,

  selectWrapper: styled('div')`
    position: relative;
    overflow: visible;
  `,

  select: styled('div')`
    width: 100%;
    padding: 8px 12px;
    font-size: 14px;
    color: var(--text-primary);
    background: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
    display: flex;
    align-items: center;
    justify-content: space-between;
    user-select: none;

    &:hover {
      border-color: var(--border-secondary);
    }

    &.focused {
      border-color: var(--bg-active);
      box-shadow: 0 0 0 3px rgba(3, 102, 214, 0.1);
    }

    &.error {
      border-color: #d73a49;
    }

    i {
      color: var(--text-secondary);
      font-size: 12px;
      transition: transform 0.2s;
    }

    &.open i {
      transform: rotate(180deg);
    }
  `,

  selectPlaceholder: styled('span')`
    color: var(--text-tertiary);
  `,

  selectValue: styled('span')`
    color: var(--text-primary);
  `,

  dropdown: styled('div')`
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    width: 100%;
    background: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-height: 280px;
    overflow-y: auto;
    z-index: 1100;
    transition: background-color 0.2s ease-in-out, border-color 0.2s ease-in-out;

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

  searchInput: styled('input')`
    width: 100%;
    padding: 8px 12px;
    font-size: 14px;
    color: var(--text-primary);
    background: var(--bg-primary);
    border: none;
    border-bottom: 1px solid var(--border-primary);
    outline: none;
    transition: all 0.2s ease-in-out;
    font-family: inherit;
    position: sticky;
    top: 0;
    z-index: 1;

    &::placeholder {
      color: var(--text-tertiary);
    }
  `,

  option: styled('div')`
    padding: 8px 12px;
    font-size: 14px;
    color: var(--text-primary);
    cursor: pointer;
    transition: background-color 0.15s ease-out;

    &:hover {
      background: var(--bg-hover);
    }

    &.selected {
      background: var(--bg-active);
      color: var(--text-on-active);
    }

    &.indent {
      padding-left: 24px;
    }
  `,
};
