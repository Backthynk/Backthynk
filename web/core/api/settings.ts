import { apiRequest } from './client';

export interface AppSettings {
  // File upload settings
  fileUploadEnabled: boolean;
  maxFileSizeMB: number;
  maxFilesPerPost: number;
  allowedFileExtensions: string[];

  // Content settings
  maxContentLength: number;
  retroactivePostingEnabled: boolean;
  retroactivePostingTimeFormat: '24h' | '12h';

  // Metadata
  siteTitle: string;
  siteDescription: string;

  // Performance
  activityEnabled: boolean;
  fileStatsEnabled: boolean;
  activityPeriodMonths: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  fileUploadEnabled: true,
  maxFileSizeMB: 50,
  maxFilesPerPost: 10,
  allowedFileExtensions: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'txt', 'zip'],
  maxContentLength: 15000,
  retroactivePostingEnabled: false,
  retroactivePostingTimeFormat: '24h',
  siteTitle: 'Personal Micro Blog',
  siteDescription: 'Personal micro blog platform',
  activityEnabled: true,
  fileStatsEnabled: true,
  activityPeriodMonths: 4,
};

let cachedSettings: AppSettings | null = null;
let settingsPromise: Promise<AppSettings> | null = null;

async function loadSettingsInternal(): Promise<AppSettings> {
  try {
    const response = await apiRequest<AppSettings>('/settings');
    return response || { ...DEFAULT_SETTINGS };
  } catch (error) {
    console.error('Failed to load settings, using defaults:', error);
    return { ...DEFAULT_SETTINGS };
  }
}

export async function loadAppSettings(forceRefresh = false): Promise<AppSettings> {
  if (cachedSettings && !forceRefresh) {
    return cachedSettings;
  }

  if (settingsPromise && !forceRefresh) {
    return await settingsPromise;
  }

  settingsPromise = loadSettingsInternal();

  try {
    cachedSettings = await settingsPromise;
    return cachedSettings;
  } finally {
    settingsPromise = null;
  }
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const saved = await apiRequest<AppSettings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });

  if (saved) {
    cachedSettings = saved;
    return saved;
  }

  throw new Error('Failed to save settings');
}

export function clearSettingsCache(): void {
  cachedSettings = null;
  settingsPromise = null;
}
