// Async utility functions for Vikings Event Management Mobile
import { sentryUtils } from '../services/utils/sentry.js';
import logger, { LOG_CATEGORIES } from '../services/utils/logger.js';

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
/**
 * Sleep for a specified number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>} Promise that resolves after the delay
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
 * @param {object} [signal] - Optional abort signal to cancel the sleep
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

/**
 * Parse a timestamp to epoch milliseconds with robust handling
 * Handles various timestamp formats consistently across the application
 * 
 * @param {string|number|Date} timestamp - Timestamp in various formats
 * @returns {number|null} Epoch milliseconds or null if invalid
 * 
 * @example
 * // String epoch timestamp
 * parseTimestamp('1640995200000') // → 1640995200000
 * 
 * // ISO string
 * parseTimestamp('2022-01-01T00:00:00.000Z') // → 1640995200000
 * 
 * // Number epoch
 * parseTimestamp(1640995200000) // → 1640995200000
 * 
 * // Date object
 * parseTimestamp(new Date('2022-01-01')) // → 1640995200000
 * 
 * // Invalid timestamp
 * parseTimestamp('invalid') // → null
 */
export const parseTimestamp = (timestamp) => {
    if (!timestamp) return null;

    const now = Date.now();
    let syncTimeMs;

    try {
    // Handle different timestamp formats
      if (typeof timestamp === 'string') {
        if (/^\d+$/.test(timestamp)) {
        // Epoch timestamp as string (standard format)
          syncTimeMs = parseInt(timestamp, 10);
        } else {
        // ISO string (legacy format) 
          syncTimeMs = new Date(timestamp).getTime();
        }
      } else if (typeof timestamp === 'number') {
      // Epoch timestamp as number
        syncTimeMs = timestamp;
      } else {
      // Date object or other types
        syncTimeMs = new Date(timestamp).getTime();
      }
    
      // Validate the parsed timestamp
      if (Number.isNaN(syncTimeMs) || syncTimeMs <= 0) {
        logger.debug('Invalid timestamp parsed to NaN or non-positive', {
          originalTimestamp: timestamp,
          originalType: typeof timestamp,
          parsedValue: syncTimeMs,
        }, LOG_CATEGORIES.APP);
        return null;
      }
    
      // Sanity check: reject timestamps too far in the future (more than 1 day)
      if (syncTimeMs > now + 24 * 60 * 60 * 1000) {
        logger.warn('Timestamp parsing: far future timestamp rejected', {
          originalTimestamp: timestamp,
          parsedDate: new Date(syncTimeMs).toISOString(),
          futureByMs: syncTimeMs - now,
        }, LOG_CATEGORIES.APP);
        return null;
      }
    
      return syncTimeMs;
    
    } catch (error) {
      logger.error('Error parsing timestamp', {
        originalTimestamp: timestamp,
        originalType: typeof timestamp,
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
    
      sentryUtils.captureException(error, {
        tags: {
          operation: 'parse_timestamp',
        },
        contexts: {
          input: {
            timestamp,
            type: typeof timestamp,
          },
        },
      });
    
      return null;
    }
  };