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

  /* Alert System Styles */
  .alert-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    z-index: 9999;
    pointer-events: none;
  }

  .alert-dropdown {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 8px 16px;
    transform: translateY(-100%);
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    opacity: 1;
    visibility: visible;
  }

  .alert-dropdown.success {
    background-color: #75C590;
    min-height: 16px;
  }

  .alert-dropdown.error {
    background-color: #E06E6B;
    min-height: 32px;
  }

  .alert-dropdown.warning {
    background-color: #EFB840;
    min-height: 32px;
  }

  .alert-dropdown.info {
    background-color: #74ACFF;
    min-height: 32px;
  }

  .alert-dropdown.show {
    transform: translateY(0);
  }

  .alert-dropdown.hide {
    transform: translateY(-100%);
    transition: transform 0.25s cubic-bezier(0.55, 0.055, 0.675, 0.19);
  }

  .alert-text {
    color: white;
    font-size: 13px;
    font-weight: 500;
    text-align: center;
    line-height: 1.2;
  }

  /* Post Timeline Styles */
  .post-content {
    font-size: 15px;
    word-wrap: break-word !important;
    overflow-wrap: anywhere !important;
    white-space: pre-wrap !important;
    line-height: 1.6;
  }

  .post-content a {
    color: var(--accent-primary);
    word-break: break-all;
    display: inline;
    transition: color 0.2s ease;
  }

  .post-content a:hover {
    color: var(--accent-hover);
    text-decoration: underline;
  }

  /* Line clamping utilities */
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Transitions */
  .transition-colors {
    transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  }

  .transition-shadow {
    transition: box-shadow 0.2s ease;
  }

  .transition-all {
    transition: all 0.2s ease;
  }

  .transition-opacity {
    transition: opacity 0.2s ease;
  }

  /* Animations */
  @keyframes fadeInDown {
    0% {
      opacity: 0;
      transform: translateY(-4px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fadeIn {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Utility classes */
  .animate-spin {
    animation: spin 1s linear infinite;
  }

  /* Custom scrollbar */
  .timeline-scroll::-webkit-scrollbar {
    width: 8px;
  }

  .timeline-scroll::-webkit-scrollbar-track {
    background: transparent;
  }

  .timeline-scroll::-webkit-scrollbar-thumb {
    background: var(--border-primary);
    border-radius: 4px;
  }

  .timeline-scroll::-webkit-scrollbar-thumb:hover {
    background: var(--border-secondary);
  }

  /* Hide scrollbar but keep functionality */
  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }

  .hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  /* Backdrop blur for modals */
  .backdrop-blur {
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
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

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .post-content {
      font-size: 14px;
    }
  }
`;
