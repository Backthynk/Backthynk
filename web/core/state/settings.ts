import { signal } from '@preact/signals';
import type { AppSettings } from '../api';
import { DEFAULT_SETTINGS, loadAppSettings as loadSettingsAPI } from '../api';

// Global state for app settings
export const appSettings = signal<AppSettings>({ ...DEFAULT_SETTINGS });
export const isLoadingSettings = signal<boolean>(false);

// Re-export the loadAppSettings function from API
export { loadSettingsAPI as loadAppSettings };
