import { signal } from '@preact/signals';
import type { ClientConfig } from '../api';
import { DEFAULT_CONFIG } from '../api';

// Global state for client config
export const clientConfig = signal<ClientConfig>({ ...DEFAULT_CONFIG });
