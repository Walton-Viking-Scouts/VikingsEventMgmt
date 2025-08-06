// Async utilities tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sleep, sleepWithAbort } from '../asyncUtils.js';

// Mock logger and sentry
vi.mock('../../services/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  LOG_CATEGORIES: {
    APP: 'APP',
    API: 'API',
    ERROR: 'ERROR',
  },
}));

vi.mock('../../services/sentry.js', () => ({
  sentryUtils: {
    captureException: vi.fn(),
  },
}));

describe('Async Utilities', () => {
  let logger, sentryUtils;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Import mocked modules
    logger = (await import('../../services/logger.js')).default;
    sentryUtils = (await import('../../services/sentry.js')).sentryUtils;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('sleep', () => {
    it('should resolve after specified milliseconds', async () => {
      const promise = sleep(1000);
      
      // Fast-forward time
      vi.advanceTimersByTime(1000);
      
      await expect(promise).resolves.toBeUndefined();
    });

    it('should resolve immediately for 0 milliseconds', async () => {
      const promise = sleep(0);
      
      vi.advanceTimersByTime(0);
      
      await expect(promise).resolves.toBeUndefined();
    });

    it('should handle fractional milliseconds', async () => {
      const promise = sleep(100.5);
      
      vi.advanceTimersByTime(100.5);
      
      await expect(promise).resolves.toBeUndefined();
    });

    it('should throw error for negative milliseconds', () => {
      expect(() => sleep(-100)).toThrow('Invalid sleep duration: -100. Must be a positive finite number.');
      
      expect(logger.error).toHaveBeenCalledWith(
        'Invalid sleep duration',
        {
          providedValue: -100,
          providedType: 'number',
          isFinite: true,
        },
        'ERROR'
      );
      
      expect(sentryUtils.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        {
          tags: {
            operation: 'async_utils_sleep',
            validation_error: true,
          },
          contexts: {
            input: {
              value: -100,
              type: 'number',
              isFinite: true,
            },
          },
        }
      );
    });

    it('should throw error for non-number input', () => {
      expect(() => sleep('invalid')).toThrow('Invalid sleep duration: invalid. Must be a positive finite number.');
      
      expect(logger.error).toHaveBeenCalledWith(
        'Invalid sleep duration',
        {
          providedValue: 'invalid',
          providedType: 'string',
          isFinite: false,
        },
        'ERROR'
      );
    });

    it('should throw error for null input', () => {
      expect(() => sleep(null)).toThrow('Invalid sleep duration: null. Must be a positive finite number.');
      
      expect(logger.error).toHaveBeenCalledWith(
        'Invalid sleep duration',
        {
          providedValue: null,
          providedType: 'object',
          isFinite: true, // isFinite(null) returns true because null coerces to 0
        },
        'ERROR'
      );
    });

    it('should throw error for undefined input', () => {
      expect(() => sleep(undefined)).toThrow('Invalid sleep duration: undefined. Must be a positive finite number.');
      
      expect(logger.error).toHaveBeenCalledWith(
        'Invalid sleep duration',
        {
          providedValue: undefined,
          providedType: 'undefined',
          isFinite: false,
        },
        'ERROR'
      );
    });

    it('should throw error for Infinity', () => {
      expect(() => sleep(Infinity)).toThrow('Invalid sleep duration: Infinity. Must be a positive finite number.');
      
      expect(logger.error).toHaveBeenCalledWith(
        'Invalid sleep duration',
        {
          providedValue: Infinity,
          providedType: 'number',
          isFinite: false,
        },
        'ERROR'
      );
    });

    it('should throw error for NaN', () => {
      expect(() => sleep(NaN)).toThrow('Invalid sleep duration: NaN. Must be a positive finite number.');
      
      expect(logger.error).toHaveBeenCalledWith(
        'Invalid sleep duration',
        {
          providedValue: NaN,
          providedType: 'number',
          isFinite: false,
        },
        'ERROR'
      );
    });
  });

  describe('sleepWithAbort', () => {
    it('should resolve after specified milliseconds without abort signal', async () => {
      const promise = sleepWithAbort(1000);
      
      vi.advanceTimersByTime(1000);
      
      await expect(promise).resolves.toBeUndefined();
      
      expect(logger.debug).toHaveBeenCalledWith(
        'Sleep completed successfully',
        { duration: 1000 },
        'APP'
      );
    });

    it('should resolve after specified milliseconds with non-aborted signal', async () => {
      const controller = new AbortController();
      const promise = sleepWithAbort(1000, controller.signal);
      
      vi.advanceTimersByTime(1000);
      
      await expect(promise).resolves.toBeUndefined();
      
      expect(logger.debug).toHaveBeenCalledWith(
        'Sleep completed successfully',
        { duration: 1000 },
        'APP'
      );
    });

    it('should reject if signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort('Test abort reason');
      
      const promise = sleepWithAbort(1000, controller.signal);
      
      await expect(promise).rejects.toThrow('Sleep aborted before starting');
      
      expect(logger.debug).toHaveBeenCalledWith(
        'Sleep aborted before starting',
        {
          duration: 1000,
          abortReason: 'Test abort reason',
        },
        'APP'
      );
    });

    it('should reject if signal is aborted during sleep', async () => {
      const controller = new AbortController();
      const promise = sleepWithAbort(2000, controller.signal);
      
      // Advance time halfway
      vi.advanceTimersByTime(1000);
      
      // Abort the operation
      controller.abort('Mid-flight abort');
      
      await expect(promise).rejects.toThrow('Sleep aborted');
      
      expect(logger.debug).toHaveBeenCalledWith(
        'Sleep aborted mid-flight',
        {
          duration: 2000,
          abortReason: 'Mid-flight abort',
        },
        'APP'
      );
    });

    it('should reject with abort error that includes cause', async () => {
      const controller = new AbortController();
      const promise = sleepWithAbort(1000, controller.signal);
      
      controller.abort('Custom abort reason');
      
      try {
        await promise;
        expect.fail('Promise should have been rejected');
      } catch (error) {
        expect(error.message).toBe('Sleep aborted');
        expect(error.cause).toBe('Custom abort reason');
      }
    });

    it('should handle abort without reason', async () => {
      const controller = new AbortController();
      const promise = sleepWithAbort(1000, controller.signal);
      
      controller.abort();
      
      await expect(promise).rejects.toThrow('Sleep aborted');
      
      expect(logger.debug).toHaveBeenCalledWith(
        'Sleep aborted mid-flight',
        {
          duration: 1000,
          abortReason: expect.any(Object), // DOMException object, not 'Unknown'
        },
        'APP'
      );
    });

    it('should handle already aborted signal without reason', async () => {
      const controller = new AbortController();
      controller.abort();
      
      const promise = sleepWithAbort(1000, controller.signal);
      
      await expect(promise).rejects.toThrow('Sleep aborted before starting');
      
      expect(logger.debug).toHaveBeenCalledWith(
        'Sleep aborted before starting',
        {
          duration: 1000,
          abortReason: expect.any(Object), // DOMException object, not 'Unknown'
        },
        'APP'
      );
    });

    it('should throw error for negative milliseconds', () => {
      expect(() => sleepWithAbort(-100)).toThrow('Invalid sleep duration: -100. Must be a positive finite number.');
      
      expect(logger.error).toHaveBeenCalledWith(
        'Invalid sleepWithAbort duration',
        {
          providedValue: -100,
          providedType: 'number',
          isFinite: true,
          hasSignal: false,
        },
        'ERROR'
      );
    });

    it('should throw error for non-number input with signal present', () => {
      const controller = new AbortController();
      
      expect(() => sleepWithAbort('invalid', controller.signal)).toThrow('Invalid sleep duration: invalid. Must be a positive finite number.');
      
      expect(logger.error).toHaveBeenCalledWith(
        'Invalid sleepWithAbort duration',
        {
          providedValue: 'invalid',
          providedType: 'string',
          isFinite: false,
          hasSignal: true,
        },
        'ERROR'
      );
    });

    it('should throw error for null input', () => {
      expect(() => sleepWithAbort(null)).toThrow('Invalid sleep duration: null. Must be a positive finite number.');
    });

    it('should throw error for undefined input', () => {
      expect(() => sleepWithAbort(undefined)).toThrow('Invalid sleep duration: undefined. Must be a positive finite number.');
    });

    it('should throw error for Infinity', () => {
      expect(() => sleepWithAbort(Infinity)).toThrow('Invalid sleep duration: Infinity. Must be a positive finite number.');
    });

    it('should throw error for NaN', () => {
      expect(() => sleepWithAbort(NaN)).toThrow('Invalid sleep duration: NaN. Must be a positive finite number.');
    });

    it('should work with 0 milliseconds', async () => {
      const promise = sleepWithAbort(0);
      
      vi.advanceTimersByTime(0);
      
      await expect(promise).resolves.toBeUndefined();
    });

    it('should work with fractional milliseconds', async () => {
      const promise = sleepWithAbort(100.5);
      
      vi.advanceTimersByTime(100.5);
      
      await expect(promise).resolves.toBeUndefined();
    });

    it('should clean up timeout when aborted', async () => {
      const controller = new AbortController();
      const promise = sleepWithAbort(5000, controller.signal);
      
      // Start the sleep
      vi.advanceTimersByTime(1000);
      
      // Abort it
      controller.abort();
      
      await expect(promise).rejects.toThrow('Sleep aborted');
      
      // Advance time further to ensure timeout was cleared
      vi.advanceTimersByTime(10000);
      
      // The promise should still be rejected, not resolved
      await expect(promise).rejects.toThrow('Sleep aborted');
    });
  });
});