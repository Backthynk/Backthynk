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
  richContent?: boolean;
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
  onConfirm: (() => void | Promise<void>) | null;
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
 * Show a confirmation modal with an action to execute on confirmation
 * Returns a promise that resolves when the action completes or rejects when cancelled
 */
export function confirm(
  config: ConfirmationConfig,
  onConfirmAction?: () => Promise<void>
): Promise<void> {
  return new Promise((resolve, reject) => {
    confirmationState.value = {
      isOpen: true,
      config,
      onConfirm: async () => {
        try {
          // If an action is provided, execute it before closing
          if (onConfirmAction) {
            await onConfirmAction();
          }

          confirmationState.value = {
            isOpen: false,
            config: null,
            onConfirm: null,
            onCancel: null,
          };
          resolve();
        } catch (error) {
          // Don't close modal on error - let the button handle loading state
          reject(error);
          throw error;
        }
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
    // Show confirmation if required, passing the execute function to be called on confirm
    if (context.confirmation) {
      let result: TResult | undefined;

      await confirm(context.confirmation, async () => {
        // Execute the action inside the confirmation callback
        result = await context.execute();

        // Execute success callback
        if (context.onSuccess) {
          await context.onSuccess(result as TResult);
        }

        // Apply cache invalidation if specified
        if (context.cacheInvalidation) {
          applyCacheInvalidation(context.cacheInvalidation);
        }
      });

      return result;
    } else {
      // No confirmation needed - execute directly
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
    }
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
