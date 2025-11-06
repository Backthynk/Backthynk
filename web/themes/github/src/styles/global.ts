import { setup, glob } from 'goober';
import { h } from 'preact';

// Setup goober to use Preact's h function
setup(h);

// Global styles
glob`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :root {
    /* Light mode colors (GitHub Light) */
    --bg-primary: #ffffff;
    --bg-secondary: #ffffff;
    --bg-tertiary: #f6f8fa;
    --bg-hover: #f6f8fa;
    --bg-active: #ddf4ff;
    --bg-active-text: #0969da;

    --border-primary: #d0d7de;
    --border-secondary: #afb8c1;

    --text-primary: #1f2328;
    --text-secondary: #656d76;
    --text-tertiary: #8c959f;
    --text-inverted: #ffffff;
    --text-on-active: #0969da;

    --accent-primary: #0969da;
    --accent-hover: #0550ae;

    /* Recursive mode colors - Purple theme */
    --recursive-primary: #8250df;
    --recursive-hover: #6639ba;
    --recursive-bg: rgba(130, 80, 223, 0.15);
    --recursive-bg-hover: rgba(130, 80, 223, 0.25);
    --recursive-bg-child: rgba(130, 80, 223, 0.06);
    --recursive-text: #8250df;
    --recursive-pulse-start: rgba(130, 80, 223, 0.7);
    --recursive-pulse-mid: rgba(130, 80, 223, 0);
    --recursive-pulse-border: rgba(130, 80, 223, 0.5);

    /* Legacy - kept for compatibility */
    --accent-recursive: var(--recursive-primary);
    --accent-recursive-hover: var(--recursive-bg-hover);

    --count-bg: #e6eaef;
    --count-text: #656d76;

    --shadow-sm: 0 1px 0 rgba(27, 31, 35, 0.04);

    /* Activity Heatmap Colors - Light Mode (Exact GitHub colors) */
    --activity-none: #ebedf0;
    --activity-low: #9be9a8;
    --activity-medium: #40c463;
    --activity-high: #30a14e;
    --activity-very-high: #216e39;

    /* Activity UI Colors */
    --link-primary: #0969da;
    --link-hover: #0550ae;
    --link-color: #0969da;
    --bg-tooltip: #24292f;
    --text-inverse: #ffffff;
    --text-secondary-inverse: #8c959f;
  }

  .dark {
    /* Dark mode colors (GitHub Dark) */
    --bg-primary: #0d1117;
    --bg-secondary: #161b22;
    --bg-tertiary: #21262d;
    --bg-hover: #1c2128;
    --bg-active: #1c2d41;
    --bg-active-text: #539bf5;

    --border-primary: #30363d;
    --border-secondary: #484f58;

    --text-primary: #e6edf3;
    --text-secondary: #8d96a0;
    --text-tertiary: #656d76;
    --text-inverted: #0d1117;
    --text-on-active: #539bf5;

    --accent-primary: #539bf5;
    --accent-hover: #6cb6ff;

    /* Recursive mode colors - Purple theme (Dark mode) */
    --recursive-primary: #a371f7;
    --recursive-hover: #b58aff;
    --recursive-bg: rgba(163, 113, 247, 0.15);
    --recursive-bg-hover: rgba(163, 113, 247, 0.25);
    --recursive-bg-child: rgba(163, 113, 247, 0.06);
    --recursive-text: #a371f7;
    --recursive-pulse-start: rgba(163, 113, 247, 0.7);
    --recursive-pulse-mid: rgba(163, 113, 247, 0);
    --recursive-pulse-border: rgba(163, 113, 247, 0.5);

    /* Legacy - kept for compatibility */
    --accent-recursive: var(--recursive-primary);
    --accent-recursive-hover: var(--recursive-bg-hover);

    --count-bg: #30363d;
    --count-text: #8d96a0;

    --shadow-sm: 0 0 transparent;

    /* Activity Heatmap Colors - Dark Mode (Exact GitHub dark theme colors) */
    --activity-none: #161b22;
    --activity-low: #0e4429;
    --activity-medium: #006d32;
    --activity-high: #26a641;
    --activity-very-high: #39d353;

    /* Activity UI Colors - Dark Mode */
    --link-primary: #539bf5;
    --link-hover: #6cb6ff;
    --link-color: #539bf5;
    --bg-tooltip: #21262d;
    --text-inverse: #e6edf3;
    --text-secondary-inverse: #8d96a0;
  }

  html {
    transition: background-color 0.2s ease-in-out;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji';
    background-color: var(--bg-primary);
    color: var(--text-primary);
    line-height: 1.5;
    font-size: 14px;
    min-height: 100vh;
    transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out;
  }

  a {
    color: var(--accent-primary);
    text-decoration: none;
    transition: color 0.2s ease-in-out;
  }

  a:hover {
    color: var(--accent-hover);
    text-decoration: underline;
  }

  button {
    background: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
  }

  input, textarea, select {
    font-family: inherit;
    font-size: inherit;
  }

  /* Button active state */
  button:active {
    transform: translateY(1px);
  }

  /* Focus states */
  button:focus-visible,
  a:focus-visible {
    outline: 2px solid var(--accent-primary);
    outline-offset: 2px;
  }

  /* Selection colors */
  ::selection {
    background-color: var(--bg-active);
    color: var(--text-primary);
  }

  /* Smooth scroll */
  html {
    scroll-behavior: smooth;
  }

  /* Reduce motion for accessibility */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;
