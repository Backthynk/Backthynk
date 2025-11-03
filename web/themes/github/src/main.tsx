import { render } from 'preact';
import { App } from './App';
import './styles/global';
import { MIN_LOADING_TIME, MAX_LOADING_TIME } from '@core/constants';
import { spaces, clientConfig } from '@core/state';

if (window.__INITIAL_DATA__?.spaces) {
  spaces.value = window.__INITIAL_DATA__.spaces;
}

// Load client config from injected data
if (window.__INITIAL_DATA__?.config) {
  clientConfig.value = window.__INITIAL_DATA__.config;
}

// Clean up the initial data after hydration
if (window.__INITIAL_DATA__) {
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
