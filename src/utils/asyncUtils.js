// Async utility functions for Vikings Event Management Mobile
import { sentryUtils } from '../services/sentry.js';
import logger, { LOG_CATEGORIES } from '../services/logger.js';

/**
 * Sleep for a specified number of milliseconds
 * Provides a simple delay mechanism commonly used for rate limiting and timing control
 * 
 * @param {number} ms - Milliseconds to sleep (must be positive number)
 * @returns {Promise<void>} Promise that resolves after the delay
 * @throws {Error} If ms is not a valid positive number
 * 
 * @example
 * // Simple delay for rate limiting
 * await sleep(1000); // Wait 1 second
 * 
 * // Progressive delays in retry logic
 * for (let i = 0; i < 3; i++) {
 *   try {
 *     await apiCall();
 *     break;
 *   } catch (error) {
 *     await sleep(1000 * Math.pow(2, i)); // Exponential backoff
 *   }
 * }
 */
export const sleep = (ms) => {
  // Input validation
  if (typeof ms !== 'number' || ms < 0 || !isFinite(ms)) {
    const error = new Error(`Invalid sleep duration: ${ms}. Must be a positive finite number.`);
    
    logger.error('Invalid sleep duration', {
      providedValue: ms,
      providedType: typeof ms,
      isFinite: isFinite(ms),
    }, LOG_CATEGORIES.ERROR);
    
    sentryUtils.captureException(error, {
      tags: {
        operation: 'async_utils_sleep',
        validation_error: true,
      },
      contexts: {
        input: {
          value: ms,
          type: typeof ms,
          isFinite: isFinite(ms),
        },
      },
    });
    
    throw error;
  }

  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
};

/**
 * Sleep with timeout abort capability for cancellable operations
 * Useful for operations that need to be cancelled mid-flight
 * 
 * @param {number} ms - Milliseconds to sleep (must be positive number)
 * @param {AbortSignal} [signal] - Optional abort signal to cancel the sleep
 * @returns {Promise<void>} Promise that resolves after delay or rejects if aborted
 * @throws {Error} If ms is invalid or if operation is aborted
 * 
 * @example
 * // Cancellable delay with timeout
 * const controller = new AbortController();
 * 
 * try {
 *   // Cancel after 5 seconds
 *   setTimeout(() => controller.abort(), 5000);
 *   await sleepWithAbort(10000, controller.signal); // Will be cancelled
 * } catch (error) {
 *   console.log('Sleep was cancelled');
 * }
 */
export const sleepWithAbort = (ms, signal) => {
  // Input validation
  if (typeof ms !== 'number' || ms < 0 || !isFinite(ms)) {
    const error = new Error(`Invalid sleep duration: ${ms}. Must be a positive finite number.`);
    
    logger.error('Invalid sleepWithAbort duration', {
      providedValue: ms,
      providedType: typeof ms,
      isFinite: isFinite(ms),
      hasSignal: !!signal,
    }, LOG_CATEGORIES.ERROR);
    
    throw error;
  }

  return new Promise((resolve, reject) => {
    // Check if already aborted
    if (signal?.aborted) {
      const abortError = new Error('Sleep aborted before starting');
      
      logger.debug('Sleep aborted before starting', {
        duration: ms,
        abortReason: signal.reason || 'Unknown',
      }, LOG_CATEGORIES.APP);
      
      reject(abortError);
      return;
    }
    
    const timeoutId = setTimeout(() => {
      logger.debug('Sleep completed successfully', { duration: ms }, LOG_CATEGORIES.APP);
      resolve();
    }, ms);
    
    // Set up abort listener
    const abortHandler = () => {
      clearTimeout(timeoutId);
      
      const abortError = new Error('Sleep aborted');
      abortError.cause = signal?.reason;
      
      logger.debug('Sleep aborted mid-flight', {
        duration: ms,
        abortReason: signal?.reason || 'Unknown',
      }, LOG_CATEGORIES.APP);
      
      reject(abortError);
    };
    
    signal?.addEventListener('abort', abortHandler, { once: true });
  });
};