import { styled } from 'goober';

// Breakpoint for sidebar visibility (tablet and up)
export const SIDEBAR_BREAKPOINT = 768; // in pixels

export const layoutStyles = {
  root: styled('div')`
    min-height: 100vh;
    background: var(--bg-primary);
    transition: background-color 0.2s ease-in-out;
  `,

  container: styled('div')`
    max-width: 1280px;
    margin: 0 auto;
    padding: 2rem 1rem;
  `,

  grid: styled('div')`
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;

    @media (min-width: ${SIDEBAR_BREAKPOINT}px) {
      grid-template-columns: 2fr 6fr;
    }

    @media (min-width: 1024px) {
      grid-template-columns: 2fr 4fr 2fr;
    }
  `,

  sidebar: styled('aside')`
    display: none;

    @media (min-width: ${SIDEBAR_BREAKPOINT}px) {
      display: block;
    }
  `,

  main: styled('main')`
    min-width: 0;
  `,

  companion: styled('div')`
    display: none;

    @media (min-width: 1024px) {
      display: block;
    }
  `,
};
