import { signal } from '@preact/signals';

export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme';
const DEFAULT_THEME: Theme = 'light';

// Get initial theme from localStorage or default to light
const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return DEFAULT_THEME;

  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') {
    return stored;
  }

  return DEFAULT_THEME;
};

// Global state for theme
export const theme = signal<Theme>(getInitialTheme());

// Toggle theme between light and dark
export const toggleTheme = () => {
  const newTheme: Theme = theme.value === 'light' ? 'dark' : 'light';
  theme.value = newTheme;

  // Save to localStorage
  localStorage.setItem(THEME_STORAGE_KEY, newTheme);

  // Update document class
  updateDocumentTheme(newTheme);
};

// Set specific theme
export const setTheme = (newTheme: Theme) => {
  theme.value = newTheme;
  localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  updateDocumentTheme(newTheme);
};

// Update document class for theme
const updateDocumentTheme = (currentTheme: Theme) => {
  if (typeof document === 'undefined') return;

  if (currentTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

// Initialize theme on app load
export const initializeTheme = () => {
  const currentTheme = getInitialTheme();
  theme.value = currentTheme;
  updateDocumentTheme(currentTheme);
};
