import { styled } from 'goober';
import { forwardRef } from 'preact/compat';

export const postCreationModalStyles = {
  header: styled('div')`
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-primary);
    background: var(--bg-secondary);
    margin: -1.5rem -1.5rem 0 -1.5rem;
    border-radius: 8px 8px 0 0;
    transition: border-color 0.2s ease-in-out, background-color 0.2s ease-in-out;
    display: flex;
    align-items: center;
    gap: 1rem;
  `,

  spaceSelectorWrapper: styled('div')`
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;

    label {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
      transition: color 0.2s ease-in-out;
    }

    & > div {
      flex: 1;
      min-width: 0;
    }
  `,

  contentArea: styled('div', forwardRef)`
    /* Will be dynamically managed for scrolling */
    transition: all 0.3s ease;
    position: relative;
  `,

  container: styled('div', forwardRef)`
    display: flex;
    flex-direction: column;
    gap: 1rem;
    position: relative;
    padding-top: 1rem;
    transition: all 0.2s ease-in-out;

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      border: 2px dashed transparent;
      border-radius: 8px;
      pointer-events: none;
      transition: all 0.2s ease-in-out;
    }

    &::after {
      content: 'Drop files here';
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-hover);
      border-radius: 8px;
      font-size: 18px;
      font-weight: 600;
      color: var(--link-color);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease-in-out;
      z-index: 10;
    }

    &.dragging {
      &::before {
        border-color: var(--link-color);
      }

      &::after {
        opacity: 1;
      }

      > * {
        opacity: 0.3;
      }
    }
  `,

  textarea: styled('textarea', forwardRef)`
    width: 100%;
    min-height: 100px;
    padding: 0;
    font-size: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.5;
    color: var(--text-primary);
    background: transparent;
    border: none;
    resize: none;
    overflow: hidden;
    transition: all 0.2s ease-in-out;

    &:focus {
      outline: none;
    }

    &::placeholder {
      color: var(--text-placeholder);
    }
  `,

  attachmentsGrid: styled('div', forwardRef)`
    display: grid;
    gap: 0.75rem;
    max-height: 400px;
    overflow-y: auto;

    /* Consistent responsive grid - always use auto-fit for flexibility */
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));

    /* Custom scrollbar */
    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--bg-tertiary);
      border-radius: 3px;
      transition: background-color 0.2s ease-in-out;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: var(--border-secondary);
    }
  `,

  attachmentItem: styled('div')`
    position: relative;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border-primary);
    background: var(--bg-secondary);
    transition: all 0.2s ease-in-out;
    display: flex;
    flex-direction: column;

    &:hover {
      border-color: var(--border-secondary);
    }

    .file-info {
      padding: 0.625rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      background: var(--bg-secondary);

      .filename {
        font-size: 12px;
        font-weight: 500;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.3;
      }

      .filesize {
        font-size: 11px;
        color: var(--text-secondary);
        line-height: 1.3;
      }
    }
  `,

  attachmentPreview: styled('div')`
    width: 100%;
    aspect-ratio: 4 / 3;
    background: var(--bg-tertiary);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .file-icon {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      width: 100%;
      height: 100%;
      padding: 0.5rem;

      i {
        font-size: clamp(1.75rem, 8cqw, 3rem);
        color: var(--text-secondary);
        transition: color 0.2s ease-in-out;
      }

      span {
        font-size: clamp(9px, 2.5cqw, 12px);
        font-weight: 700;
        color: var(--text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        transition: color 0.2s ease-in-out;
      }
    }
  `,

  removeButton: styled('button')`
    position: absolute;
    top: 0.375rem;
    right: 0.375rem;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    background: rgba(0, 0, 0, 0.75);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
    backdrop-filter: blur(4px);
    z-index: 1;

    &:hover {
      background: rgba(0, 0, 0, 0.9);
      transform: scale(1.1);
    }

    i {
      font-size: 12px;
    }
  `,

  previewPanel: styled('div')`
    padding-top: 1rem;
  `,

  previewContent: styled('div')`
    background: var(--bg-primary);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    padding: 1.5rem;
    min-height: 300px;
    max-height: 600px;
    overflow-y: auto;
    transition: border-color 0.2s ease-in-out, background-color 0.2s ease-in-out;

    .preview-text {
      font-size: 14px;
      line-height: 1.6;
      color: var(--text-primary);
      margin-bottom: 1rem;
      white-space: pre-wrap;
      word-wrap: break-word;
      transition: color 0.2s ease-in-out;

      a {
        color: var(--link-color);
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }
    }

    .empty-preview {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 3rem;
      min-height: 300px;

      i {
        font-size: 3rem;
        color: var(--text-tertiary);
        transition: color 0.2s ease-in-out;
      }

      p {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--text-secondary);
        transition: color 0.2s ease-in-out;
      }

      span {
        font-size: 13px;
        color: var(--text-tertiary);
        text-align: center;
        max-width: 300px;
        transition: color 0.2s ease-in-out;
      }
    }

    /* Custom scrollbar */
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

  toolbarButton: styled('button')`
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    background: transparent;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease-in-out;

    &:hover {
      background: var(--bg-hover);
      color: var(--link-color);
    }

    &.active {
      color: var(--link-color);
      background: var(--bg-hover);
    }

    i {
      font-size: 18px;
    }
  `,

  button: styled('button')`
    padding: 6px 16px;
    font-size: 14px;
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
    border: 1px solid transparent;
    font-family: inherit;

    &.publish {
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
  `,

  errorMessage: styled('div')`
    padding: 12px;
    background: rgba(244, 67, 54, 0.1);
    border: 1px solid rgba(244, 67, 54, 0.3);
    border-radius: 8px;
    color: #f44336;
    font-size: 14px;
    transition: all 0.2s ease-in-out;

    @media (prefers-color-scheme: dark) {
      background: rgba(244, 67, 54, 0.15);
      border-color: rgba(244, 67, 54, 0.4);
      color: #ff5252;
    }
  `,
};