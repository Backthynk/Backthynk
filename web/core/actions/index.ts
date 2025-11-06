/**
 * Centralized Action System
 *
 * This module provides a centralized way to handle user actions with:
 * - Automatic confirmation modals
 * - State updates
 * - Success/error notifications
 * - Cascading effects
 */

import { signal } from '@preact/signals';
import { postsCache } from '../cache/postsCache';

export interface ConfirmationConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
}

export type CacheInvalidationStrategy =
  | { type: 'none' }
  | { type: 'all' }
  | { type: 'pattern'; pattern: string | RegExp | ((key: string) => boolean) }
  | { type: 'custom'; invalidate: () => void };

export interface ActionContext<TResult = void> {
  execute: () => Promise<TResult>;
  confirmation?: ConfirmationConfig;
  onSuccess?: (result: TResult) => void | Promise<void>;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
  /** Cache invalidation strategy to apply after successful execution */
  cacheInvalidation?: CacheInvalidationStrategy | CacheInvalidationStrategy[];
}

interface ConfirmationState {
  isOpen: boolean;
  config: ConfirmationConfig | null;
  onConfirm: (() => void) | null;
  onCancel: (() => void) | null;
}

// Global confirmation modal state
export const confirmationState = signal<ConfirmationState>({
  isOpen: false,
  config: null,
  onConfirm: null,
  onCancel: null,
});

/**
 * Show a confirmation modal and return a promise that resolves when confirmed
 * or rejects when cancelled
 */
export function confirm(config: ConfirmationConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    confirmationState.value = {
      isOpen: true,
      config,
      onConfirm: () => {
        confirmationState.value = {
          isOpen: false,
          config: null,
          onConfirm: null,
          onCancel: null,
        };
        resolve();
      },
      onCancel: () => {
        confirmationState.value = {
          isOpen: false,
          config: null,
          onConfirm: null,
          onCancel: null,
        };
        reject(new Error('Action cancelled'));
      },
    };
  });
}

/**
 * Apply cache invalidation strategies
 */
function applyCacheInvalidation(strategies: CacheInvalidationStrategy | CacheInvalidationStrategy[]): void {
  const strategyArray = Array.isArray(strategies) ? strategies : [strategies];

  for (const strategy of strategyArray) {
    switch (strategy.type) {
      case 'none':
        break;
      case 'all':
        postsCache.clear();
        break;
      case 'pattern':
        postsCache.invalidateAll(); // For now, invalidate all; could be more granular
        break;
      case 'custom':
        strategy.invalidate();
        break;
    }
  }
}

/**
 * Execute an action with optional confirmation and automatic state management
 */
export async function executeAction<TResult = void>(
  context: ActionContext<TResult>
): Promise<TResult | undefined> {
  try {
    // Show confirmation if required
    if (context.confirmation) {
      await confirm(context.confirmation);
    }

    // Execute the action
    const result = await context.execute();

    // Execute success callback
    if (context.onSuccess) {
      await context.onSuccess(result);
    }

    // Apply cache invalidation if specified
    if (context.cacheInvalidation) {
      applyCacheInvalidation(context.cacheInvalidation);
    }

    return result;
  } catch (error) {
    // Don't handle error if it's a cancellation
    if (error instanceof Error && error.message === 'Action cancelled') {
      return undefined;
    }

    // Execute error callback and rethrow
    if (context.onError) {
      context.onError(error as Error);
    }
    throw error;
  }
}
