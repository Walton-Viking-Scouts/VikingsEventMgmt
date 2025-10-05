// Async utilities tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sleep } from '../asyncUtils.js';

// Mock logger and sentry
vi.mock('../../services/utils/logger.js', () => ({
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

vi.mock('../../services/utils/sentry.js', () => ({
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
    logger = (await import('../../services/utils/logger.js')).default;
    sentryUtils = (await import('../../services/utils/sentry.js')).sentryUtils;
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
        'ERROR',
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
        },
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
        'ERROR',
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
        'ERROR',
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
        'ERROR',
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
        'ERROR',
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
        'ERROR',
      );
    });
  });
});