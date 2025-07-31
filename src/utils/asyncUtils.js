// Async utility functions

/**
 * Sleep for a specified number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after the delay
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Sleep with timeout abort capability
 * @param {number} ms - Milliseconds to sleep
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise} Promise that resolves after delay or rejects if aborted
 */
export const sleepWithAbort = (ms, signal) => {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Sleep aborted'));
      return;
    }
    
    const timeoutId = setTimeout(resolve, ms);
    
    signal?.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      reject(new Error('Sleep aborted'));
    });
  });
};