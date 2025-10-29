import { render } from 'preact';
import { App } from './App';
import './styles/global';
import { MIN_LOADING_TIME, MAX_LOADING_TIME } from '@core/constants';
import { spaces } from '@core/state';
import type { Space } from '@core/api';

// Hydrate initial data from SSR if available
declare global {
  interface Window {
    __INITIAL_DATA__?: {
      spaces?: Space[];
    };
  }
}

if (window.__INITIAL_DATA__?.spaces) {
  spaces.value = window.__INITIAL_DATA__.spaces;
  // Clean up the initial data
  delete window.__INITIAL_DATA__;
}

// Start performance tracking
const startTime = performance.now();

// Render the app
render(<App />, document.getElementById('app')!);

// Handle loading animation removal
setTimeout(() => {
  const loadingEl = document.getElementById('loading');
  const appEl = document.getElementById('app');

  if (loadingEl) {
    loadingEl.classList.add('hidden');
    loadingEl.style.display = 'none';
  }

  if (appEl) {
    appEl.classList.remove('hidden');
    appEl.style.opacity = '1';
  }
}, Math.min(MAX_LOADING_TIME - startTime, MIN_LOADING_TIME));
