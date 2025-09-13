// Enhanced Rate Limit Queue with intelligent retry and user feedback
import { sleep } from './asyncUtils.js';
import logger, { LOG_CATEGORIES } from '../services/utils/logger.js';
import { sentryUtils } from '../services/utils/sentry.js';

/**
 * Intelligent rate limit queue that handles 429 responses with exponential backoff
 * Provides user feedback and queuing for rate-limited requests
 */
export class RateLimitQueue {
  /**
   * Creates a new rate limit queue
   * @param {object} options - Configuration options for the queue
   */
  constructor(options = {}) {
    this.queue = [];
    this.processing = false;
    this.requestCount = 0;
    this.retryCount = 0;
    this.rateLimitedUntil = null;
    this.listeners = new Set();
    
    // Configuration
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000; // 1 second base delay
    this.maxDelay = options.maxDelay || 30000; // 30 seconds max delay
    this.queueTimeout = options.queueTimeout || 300000; // 5 minutes max queue time
  }

  /**
   * Add a listener for queue status updates
   * @param {Function} listener - Callback function for status updates
   */
  addStatusListener(listener) {
    this.listeners.add(listener);
    // Send current status immediately
    try {
      listener(this.getStatus());
    } catch (error) {
      logger.error('Error in rate limit queue listener (initial emit)', { error }, LOG_CATEGORIES.ERROR);
    }
  }

  /**
   * Remove a status listener
   * @param {Function} listener - Callback function to remove
   */
  removeStatusListener(listener) {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of status changes
   * @param {object} status - Current queue status
   */
  notifyListeners(status) {
    this.listeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        logger.error('Error in rate limit queue listener', { error }, LOG_CATEGORIES.ERROR);
      }
    });
  }

  /**
   * Get current queue status for UI display
   * @returns {object} Queue status information
   */
  getStatus() {
    const now = Date.now();
    const rateLimitRemaining = this.rateLimitedUntil ? Math.max(0, this.rateLimitedUntil - now) : 0;
    
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      totalRequests: this.requestCount,
      retryCount: this.retryCount,
      rateLimited: rateLimitRemaining > 0,
      rateLimitRemaining: Math.ceil(rateLimitRemaining / 1000), // seconds
      estimatedWaitTime: this.rateLimitedUntil ? Math.max(0, Math.ceil((this.rateLimitedUntil - Date.now()) / 1000)) : 0,
    };
  }


  /**
   * Add a request to the queue with intelligent retry handling
   * @param {Function} apiCall - Function that makes the API call
   * @param {object} options - Request options (priority, timeout, etc.)
   * @returns {Promise} Promise that resolves when request completes
   */
  enqueue(apiCall, options = {}) {
    return new Promise((resolve, reject) => {
      const request = {
        apiCall,
        resolve,
        reject,
        priority: options.priority || 0,
        attempts: 0,
        createdAt: Date.now(),
        timeout: options.timeout ?? this.queueTimeout,
        id: Math.random().toString(36).substr(2, 9),
      };

      // Insert based on priority (higher priority first)
      const insertIndex = this.queue.findIndex(item => item.priority < request.priority);
      if (insertIndex === -1) {
        this.queue.push(request);
      } else {
        this.queue.splice(insertIndex, 0, request);
      }

      // Only log when queue is getting large (potential issues)
      if (this.queue.length > 10) {
        logger.warn('Large API queue detected', {
          queueLength: this.queue.length,
          processing: this.processing,
        }, LOG_CATEGORIES.API);
      }

      this.notifyListeners(this.getStatus());
      this.process();

      // Set timeout for request and store timeout ID to prevent memory leaks
      request._timeoutId = setTimeout(() => {
        if (this.queue.includes(request)) {
          this.removeFromQueue(request);
          reject(new Error('Request timeout: queued too long'));
        }
      }, request.timeout);
    });
  }

  /**
   * Clear request timeout to prevent memory leaks
   * @private
   * @param {object} request - Request to clear timeout for
   */
  _clearRequestTimeout(request) {
    if (Object.prototype.hasOwnProperty.call(request, '_timeoutId')) {
      clearTimeout(request._timeoutId);
      delete request._timeoutId;
    }
  }

  /**
   * Remove a request from the queue
   * @param {object} request - Request to remove
   */
  removeFromQueue(request) {
    const index = this.queue.indexOf(request);
    if (index > -1) {
      this.queue.splice(index, 1);
      this.notifyListeners(this.getStatus());
    }
    
    // Clear timeout to prevent memory leak and timer firing for completed requests
    this._clearRequestTimeout(request);
  }

  /**
   * Process the queue with intelligent rate limit handling
   */
  async process() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    // Starting to process queued requests
    this.processing = true;
    this.notifyListeners(this.getStatus());

    try {
      while (this.queue.length > 0) {
        // Check if we're currently rate limited
        if (this.rateLimitedUntil && Date.now() < this.rateLimitedUntil) {
          const waitTime = this.rateLimitedUntil - Date.now();
          // Waiting for rate limit to reset
          logger.info('Waiting for rate limit to reset', {
            waitTimeMs: waitTime,
            waitTimeSeconds: Math.ceil(waitTime / 1000),
          }, LOG_CATEGORIES.API);
          
          await sleep(waitTime);
        }

        const request = this.queue.shift();
        if (!request) continue;

        try {
          this.requestCount++;
          request.attempts++;

          // Only log retry attempts (not every single request)
          if (request.attempts > 1) {
            logger.debug('Retrying API request', {
              attempt: request.attempts,
              maxRetries: this.maxRetries,
            }, LOG_CATEGORIES.API);
          }

          const result = await request.apiCall();
          
          // Clear timeout on successful completion to prevent memory leak
          this._clearRequestTimeout(request);
          
          request.resolve(result);

          // Small delay between successful requests to ensure proper ordering
          if (this.queue.length > 0) {
            const delayMs = 50; // Minimal delay just for request ordering
            await sleep(delayMs);
          }

        } catch (error) {
          const is429 = error.message?.includes('rate limit') || error.status === 429;
          // Request failed, checking if retryable
          
          if (is429 && request.attempts < this.maxRetries) {
            // Handle rate limiting with exponential backoff
            await this.handleRateLimit(request, error);
            // CRITICAL FIX: Break out of processing loop immediately after rate limit
            // The rate limit timeout will be handled at the top of the next process() call
            break;
          } else {
            // Max retries reached or non-rate-limit error
            logger.error('Request failed after retries', {
              requestId: request.id,
              attempts: request.attempts,
              error: error.message,
              is429,
            }, LOG_CATEGORIES.ERROR);
            
            // Clear timeout on final failure to prevent memory leak
            this._clearRequestTimeout(request);
            
            request.reject(error);
          }
        }

        this.notifyListeners(this.getStatus());
      }
    } finally {
      // Queue processing completed
      this.processing = false;
      this.notifyListeners(this.getStatus());
    }
  }

  /**
   * Handle rate limit error with intelligent backoff
   * @param {object} request - The failed request
   * @param {Error} error - The rate limit error
   */
  async handleRateLimit(request, error) {
    this.retryCount++;
    
    // Use backend-provided retry-after time from 429 response
    let retryAfter = this.baseDelay; // Fallback only if no backend time provided
    
    // Check if error contains specific retry-after time from backend response
    if (error.retryAfter && typeof error.retryAfter === 'number') {
      retryAfter = error.retryAfter * 1000; // Convert to milliseconds
    } else {
      // Check if error message contains retry-after time
      const retryAfterMatch = error.message?.match(/wait (\d+) seconds?/);
      if (retryAfterMatch) {
        retryAfter = parseInt(retryAfterMatch[1]) * 1000;
      }
    }
    // Enforce configured bounds
    retryAfter = Math.min(Math.max(retryAfter, this.baseDelay), this.maxDelay);

    // Set global rate limit timeout
    this.rateLimitedUntil = Date.now() + retryAfter;
    this.notifyListeners(this.getStatus());

    logger.warn('Rate limited - queuing for retry', {
      requestId: request.id,
      attempt: request.attempts,
      retryAfterMs: retryAfter,
      retryAfterSeconds: Math.ceil(retryAfter / 1000),
    }, LOG_CATEGORIES.API);

    sentryUtils.addBreadcrumb({
      category: 'rate_limit',
      message: 'Request rate limited, queuing for retry',
      level: 'warning',
      data: {
        requestId: request.id,
        attempt: request.attempts,
        retryAfter: Math.ceil(retryAfter / 1000),
      },
    });

    // Re-queue the request with higher priority
    request.priority += 1;
    const insertIndex = this.queue.findIndex(item => item.priority < request.priority);
    if (insertIndex === -1) {
      this.queue.push(request);
    } else {
      this.queue.splice(insertIndex, 0, request);
    }
    
    // Request re-queued for retry after rate limit timeout
    
    // CRITICAL FIX: Schedule automatic resume of processing after rate limit timeout
    if (this._resumeTimerId) {
      clearTimeout(this._resumeTimerId);
      this._resumeTimerId = null;
    }
    this._resumeTimerId = setTimeout(() => {
      this._resumeTimerId = null;
      if (this.queue.length > 0 && !this.processing) {
        // Auto-resuming processing after rate limit timeout
        this.process();
      }
    }, retryAfter + 100); // Small buffer to ensure rate limit has expired
  }

  /**
   * Clear all queued requests
   * @param {string} reason - Reason for clearing (for logging)
   */
  clear(reason = 'Manual clear') {
    const clearedCount = this.queue.length;
    
    // Reject all pending requests and clear their timeouts
    this.queue.forEach(request => {
      // Clear timeout to prevent memory leak
      this._clearRequestTimeout(request);
      request.reject(new Error(`Queue cleared: ${reason}`));
    });
    
    this.queue = [];
    this.rateLimitedUntil = null;
    
    logger.info('Queue cleared', {
      reason,
      clearedCount,
    }, LOG_CATEGORIES.API);
    
    this.notifyListeners(this.getStatus());
  }

  /**
   * Get statistics for monitoring and debugging
   * @returns {object} Detailed statistics
   */
  getDetailedStats() {
    return {
      ...this.getStatus(),
      oldestRequestAge: this.queue.length > 0
        ? Date.now() - Math.min(...this.queue.map(r => r.createdAt || 0))
        : 0,
      averageRetryCount: this.requestCount > 0 ? this.retryCount / this.requestCount : 0,
      listenerCount: this.listeners.size,
    };
  }
}

// Global instance
export const globalRateLimitQueue = new RateLimitQueue({
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  queueTimeout: 300000,
});

/**
 * Helper function to wrap API calls with rate limit queue
 * @param {Function} apiCall - The API function to call
 * @param {object} options - Options for the queue
 * @returns {Promise} Promise that resolves with API call result
 */
export const withRateLimitQueue = (apiCall, options = {}) => {
  // Rate limit queue wrapping API call
    return globalRateLimitQueue.enqueue(apiCall, options);
  };

/**
 * Export queue stats for dashboard display
 * @returns {object} Current queue status and statistics
 */
export const getRateLimitQueueStats = () => globalRateLimitQueue.getStatus();