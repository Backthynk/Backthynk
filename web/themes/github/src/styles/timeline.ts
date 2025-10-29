import { styled } from 'goober';

export const timelineStyles = {
  timeline: styled('main')`
    min-height: 400px;
  `,

  post: styled('article')`
    background: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 6px;
    padding: 16px;
    margin-bottom: 16px;
    transition: border-color 0.2s;

    &:hover {
      border-color: var(--border-secondary);
    }
  `,

  postContent: styled('div')`
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-primary);
    white-space: pre-wrap;
    word-wrap: break-word;
  `,

  postMeta: styled('div')`
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border-primary);
    font-size: 12px;
    color: var(--text-secondary);
  `,

  empty: styled('div')`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 64px 16px;
    text-align: center;
    color: var(--text-secondary);

    p {
      margin-top: 16px;
      font-size: 14px;
    }
  `,

  loading: styled('div')`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 64px 16px;
    text-align: center;
    color: var(--text-secondary);

    p {
      margin-top: 16px;
      font-size: 14px;
    }
  `,
};
