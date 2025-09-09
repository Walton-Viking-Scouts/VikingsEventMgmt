// Storage utilities tests
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  safeGetItem,
  safeSetItem,
  safeGetSessionItem,
  safeSetSessionItem,
} from '../storageUtils.js';

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

describe('Storage Utilities', () => {
  let logger, sentryUtils;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset storage mocks
    localStorage.getItem.mockClear();
    localStorage.setItem.mockClear();
    sessionStorage.getItem.mockClear();
    sessionStorage.setItem.mockClear();
    
    // Import mocked modules
    logger = (await import('../../services/utils/logger.js')).default;
    sentryUtils = (await import('../../services/utils/sentry.js')).sentryUtils;
  });

  describe('safeGetItem', () => {
    it('should return parsed JSON data when item exists', () => {
      const testData = { theme: 'dark', language: 'en' };
      localStorage.getItem.mockReturnValue(JSON.stringify(testData));

      const result = safeGetItem('user_preferences');

      expect(result).toEqual(testData);
      expect(localStorage.getItem).toHaveBeenCalledWith('user_preferences');
    });

    it('should return default value when item does not exist', () => {
      localStorage.getItem.mockReturnValue(null);
      const defaultValue = { theme: 'light' };

      const result = safeGetItem('user_preferences', defaultValue);

      expect(result).toEqual(defaultValue);
      expect(localStorage.getItem).toHaveBeenCalledWith('user_preferences');
    });

    it('should return null as default when no default value provided', () => {
      localStorage.getItem.mockReturnValue(null);

      const result = safeGetItem('user_preferences');

      expect(result).toBeNull();
    });

    it('should return default value when JSON parsing fails', () => {
      localStorage.getItem.mockReturnValue('invalid json {');
      const defaultValue = { theme: 'light' };

      const result = safeGetItem('user_preferences', defaultValue);

      expect(result).toEqual(defaultValue);
      expect(logger.warn).toHaveBeenCalledWith(
        'Storage retrieval failed',
        expect.objectContaining({
          operation: 'localStorage.getItem',
          key: 'user_preferences',
          error: expect.any(String),
          hasDefaultValue: true,
          stack: expect.any(String),
        }),
        'ERROR',
      );
      expect(sentryUtils.captureException).toHaveBeenCalledWith(
        expect.any(SyntaxError),
        {
          tags: {
            operation: 'storage_get',
            storage_type: 'localStorage',
          },
          contexts: {
            storage: {
              key: 'user_preferences',
              hasDefaultValue: true,
              defaultValueType: 'object',
            },
          },
        },
      );
    });

    it('should handle localStorage.getItem throwing an error', () => {
      const error = new Error('Storage quota exceeded');
      localStorage.getItem.mockImplementation(() => {
        throw error;
      });
      const defaultValue = [];

      const result = safeGetItem('large_data', defaultValue);

      expect(result).toEqual(defaultValue);
      expect(logger.warn).toHaveBeenCalledWith(
        'Storage retrieval failed',
        expect.objectContaining({
          operation: 'localStorage.getItem',
          key: 'large_data',
          error: 'Storage quota exceeded',
          hasDefaultValue: true,
        }),
        'ERROR',
      );
    });

    it('should handle empty string as valid JSON', () => {
      localStorage.getItem.mockReturnValue('""');

      const result = safeGetItem('empty_string');

      expect(result).toBe('');
    });

    it('should handle various JSON data types', () => {
      // Test string
      localStorage.getItem.mockReturnValue('"test string"');
      expect(safeGetItem('string_key')).toBe('test string');

      // Test number
      localStorage.getItem.mockReturnValue('42');
      expect(safeGetItem('number_key')).toBe(42);

      // Test boolean
      localStorage.getItem.mockReturnValue('true');
      expect(safeGetItem('boolean_key')).toBe(true);

      // Test array
      localStorage.getItem.mockReturnValue('[1,2,3]');
      expect(safeGetItem('array_key')).toEqual([1, 2, 3]);
    });

    it('should handle null default value correctly', () => {
      localStorage.getItem.mockReturnValue('invalid json');

      const result = safeGetItem('test_key', null);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        'Storage retrieval failed',
        expect.objectContaining({
          hasDefaultValue: false, // null is falsy, so hasDefaultValue is false
          key: 'test_key',
          operation: 'localStorage.getItem',
        }),
        'ERROR',
      );
    });
  });

  describe('safeSetItem', () => {
    it('should successfully set JSON serialized data', () => {
      const testData = { theme: 'dark', language: 'en' };
      localStorage.setItem.mockImplementation(() => {});

      const result = safeSetItem('user_preferences', testData);

      expect(result).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'user_preferences',
        JSON.stringify(testData),
      );
    });

    it('should handle various data types', () => {
      localStorage.setItem.mockImplementation(() => {});

      // Test string
      expect(safeSetItem('string_key', 'test string')).toBe(true);
      expect(localStorage.setItem).toHaveBeenLastCalledWith('string_key', '"test string"');

      // Test number
      expect(safeSetItem('number_key', 42)).toBe(true);
      expect(localStorage.setItem).toHaveBeenLastCalledWith('number_key', '42');

      // Test boolean
      expect(safeSetItem('boolean_key', true)).toBe(true);
      expect(localStorage.setItem).toHaveBeenLastCalledWith('boolean_key', 'true');

      // Test array
      expect(safeSetItem('array_key', [1, 2, 3])).toBe(true);
      expect(localStorage.setItem).toHaveBeenLastCalledWith('array_key', '[1,2,3]');

      // Test null
      expect(safeSetItem('null_key', null)).toBe(true);
      expect(localStorage.setItem).toHaveBeenLastCalledWith('null_key', 'null');

      // Test undefined (should be converted to 'null' string)
      expect(safeSetItem('undefined_key', undefined)).toBe(true);
      expect(localStorage.setItem).toHaveBeenLastCalledWith('undefined_key', 'null');
    });

    it('should return false when JSON serialization fails', () => {
      const circularRef = {};
      circularRef.self = circularRef;

      const result = safeSetItem('circular_key', circularRef);

      expect(result).toBe(false);
      expect(localStorage.setItem).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'Storage write failed',
        expect.objectContaining({
          operation: 'localStorage.setItem',
          key: 'circular_key',
          valueType: 'object',
          isArray: false,
          error: expect.stringContaining('circular'),
        }),
        'ERROR',
      );
      expect(sentryUtils.captureException).toHaveBeenCalledWith(
        expect.any(TypeError),
        {
          tags: {
            operation: 'storage_set',
            storage_type: 'localStorage',
          },
          contexts: {
            storage: {
              key: 'circular_key',
              valueType: 'object',
              isArray: false,
              estimatedSize: 'N/A (serialization failed)',
            },
          },
        },
      );
    });

    it('should return false when localStorage.setItem throws an error', () => {
      const error = new Error('Storage quota exceeded');
      localStorage.setItem.mockImplementation(() => {
        throw error;
      });
      const testData = { large: 'data' };

      const result = safeSetItem('large_key', testData);

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        'Storage write failed',
        expect.objectContaining({
          operation: 'localStorage.setItem',
          key: 'large_key',
          valueType: 'object',
          isArray: false,
          error: 'Storage quota exceeded',
        }),
        'ERROR',
      );
    });

    it('should correctly identify arrays in logging', () => {
      localStorage.setItem.mockImplementation(() => {
        throw new Error('Test error');
      });
      const arrayData = [1, 2, 3];

      safeSetItem('array_key', arrayData);

      expect(logger.warn).toHaveBeenCalledWith(
        'Storage write failed',
        expect.objectContaining({
          key: 'array_key',
          valueType: 'object',
          isArray: true,
        }),
        'ERROR',
      );
    });
  });

  describe('safeGetSessionItem', () => {
    it('should return parsed JSON data when item exists', () => {
      const testData = { token: 'abc123', expires: '2024-12-31' };
      sessionStorage.getItem.mockReturnValue(JSON.stringify(testData));

      const result = safeGetSessionItem('auth_token');

      expect(result).toEqual(testData);
      expect(sessionStorage.getItem).toHaveBeenCalledWith('auth_token');
    });

    it('should return default value when item does not exist', () => {
      sessionStorage.getItem.mockReturnValue(null);
      const defaultValue = { initialized: false };

      const result = safeGetSessionItem('app_state', defaultValue);

      expect(result).toEqual(defaultValue);
      expect(sessionStorage.getItem).toHaveBeenCalledWith('app_state');
    });

    it('should return null as default when no default value provided', () => {
      sessionStorage.getItem.mockReturnValue(null);

      const result = safeGetSessionItem('temp_data');

      expect(result).toBeNull();
    });

    it('should return default value when JSON parsing fails', () => {
      sessionStorage.getItem.mockReturnValue('invalid json {');
      const defaultValue = { step: 1 };

      const result = safeGetSessionItem('form_state', defaultValue);

      expect(result).toEqual(defaultValue);
      expect(logger.warn).toHaveBeenCalledWith(
        'Session storage retrieval failed',
        expect.objectContaining({
          operation: 'sessionStorage.getItem',
          key: 'form_state',
          error: expect.any(String),
          hasDefaultValue: true,
          stack: expect.any(String),
        }),
        'ERROR',
      );
      expect(sentryUtils.captureException).toHaveBeenCalledWith(
        expect.any(SyntaxError),
        {
          tags: {
            operation: 'storage_get',
            storage_type: 'sessionStorage',
          },
          contexts: {
            storage: {
              key: 'form_state',
              hasDefaultValue: true,
              defaultValueType: 'object',
            },
          },
        },
      );
    });

    it('should handle sessionStorage.getItem throwing an error', () => {
      const error = new Error('Session storage unavailable');
      sessionStorage.getItem.mockImplementation(() => {
        throw error;
      });
      const defaultValue = {};

      const result = safeGetSessionItem('session_data', defaultValue);

      expect(result).toEqual(defaultValue);
      expect(logger.warn).toHaveBeenCalledWith(
        'Session storage retrieval failed',
        expect.objectContaining({
          operation: 'sessionStorage.getItem',
          key: 'session_data',
          error: 'Session storage unavailable',
          hasDefaultValue: true,
        }),
        'ERROR',
      );
    });

    it('should handle various JSON data types', () => {
      // Test string
      sessionStorage.getItem.mockReturnValue('"session string"');
      expect(safeGetSessionItem('string_key')).toBe('session string');

      // Test number
      sessionStorage.getItem.mockReturnValue('99');
      expect(safeGetSessionItem('number_key')).toBe(99);

      // Test boolean
      sessionStorage.getItem.mockReturnValue('false');
      expect(safeGetSessionItem('boolean_key')).toBe(false);

      // Test array
      sessionStorage.getItem.mockReturnValue('["a","b","c"]');
      expect(safeGetSessionItem('array_key')).toEqual(['a', 'b', 'c']);
    });
  });

  describe('safeSetSessionItem', () => {
    it('should successfully set JSON serialized data', () => {
      const testData = { token: 'xyz789', step: 2 };
      sessionStorage.setItem.mockImplementation(() => {});

      const result = safeSetSessionItem('form_data', testData);

      expect(result).toBe(true);
      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        'form_data',
        JSON.stringify(testData),
      );
    });

    it('should handle various data types', () => {
      sessionStorage.setItem.mockImplementation(() => {});

      // Test string
      expect(safeSetSessionItem('string_key', 'session test')).toBe(true);
      expect(sessionStorage.setItem).toHaveBeenLastCalledWith('string_key', '"session test"');

      // Test number
      expect(safeSetSessionItem('number_key', 123)).toBe(true);
      expect(sessionStorage.setItem).toHaveBeenLastCalledWith('number_key', '123');

      // Test boolean
      expect(safeSetSessionItem('boolean_key', false)).toBe(true);
      expect(sessionStorage.setItem).toHaveBeenLastCalledWith('boolean_key', 'false');

      // Test array
      expect(safeSetSessionItem('array_key', ['x', 'y'])).toBe(true);
      expect(sessionStorage.setItem).toHaveBeenLastCalledWith('array_key', '["x","y"]');

      // Test null
      expect(safeSetSessionItem('null_key', null)).toBe(true);
      expect(sessionStorage.setItem).toHaveBeenLastCalledWith('null_key', 'null');

      // Test undefined (should be converted to 'null' string)
      expect(safeSetSessionItem('undefined_key', undefined)).toBe(true);
      expect(sessionStorage.setItem).toHaveBeenLastCalledWith('undefined_key', 'null');
    });

    it('should return false when JSON serialization fails', () => {
      const circularRef = {};
      circularRef.self = circularRef;

      const result = safeSetSessionItem('circular_key', circularRef);

      expect(result).toBe(false);
      expect(sessionStorage.setItem).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'Session storage write failed',
        expect.objectContaining({
          operation: 'sessionStorage.setItem',
          key: 'circular_key',
          valueType: 'object',
          isArray: false,
          error: expect.stringContaining('circular'),
        }),
        'ERROR',
      );
      expect(sentryUtils.captureException).toHaveBeenCalledWith(
        expect.any(TypeError),
        {
          tags: {
            operation: 'storage_set',
            storage_type: 'sessionStorage',
          },
          contexts: {
            storage: {
              key: 'circular_key',
              valueType: 'object',
              isArray: false,
              estimatedSize: 'N/A (serialization failed)',
            },
          },
        },
      );
    });

    it('should return false when sessionStorage.setItem throws an error', () => {
      const error = new Error('Session storage quota exceeded');
      sessionStorage.setItem.mockImplementation(() => {
        throw error;
      });
      const testData = { large: 'session data' };

      const result = safeSetSessionItem('large_key', testData);

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        'Session storage write failed',
        expect.objectContaining({
          operation: 'sessionStorage.setItem',
          key: 'large_key',
          valueType: 'object',
          isArray: false,
          error: 'Session storage quota exceeded',
        }),
        'ERROR',
      );
    });

    it('should correctly identify arrays in logging', () => {
      sessionStorage.setItem.mockImplementation(() => {
        throw new Error('Test error');
      });
      const arrayData = ['session', 'array'];

      safeSetSessionItem('array_key', arrayData);

      expect(logger.warn).toHaveBeenCalledWith(
        'Session storage write failed',
        expect.objectContaining({
          key: 'array_key',
          valueType: 'object',
          isArray: true,
        }),
        'ERROR',
      );
    });
  });

  describe('Cross-function behavior', () => {
    it('should maintain data consistency between get and set operations', () => {
      const testData = { complex: { nested: { data: [1, 2, { inner: true }] } } };
      
      // Mock successful set
      localStorage.setItem.mockImplementation(() => {});
      
      // Set the data
      const setResult = safeSetItem('complex_data', testData);
      expect(setResult).toBe(true);
      
      // Mock the get to return what was set
      const serializedData = JSON.stringify(testData);
      localStorage.getItem.mockReturnValue(serializedData);
      
      // Get the data back
      const getData = safeGetItem('complex_data');
      
      expect(getData).toEqual(testData);
    });

    it('should handle undefined values consistently', () => {
      localStorage.setItem.mockImplementation(() => {});
      localStorage.getItem.mockReturnValue('null');

      // Set undefined (now explicitly converts to 'null' string)
      const setResult = safeSetItem('undefined_key', undefined);
      expect(setResult).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalledWith('undefined_key', 'null');

      // Get returns null (not undefined)
      const getData = safeGetItem('undefined_key');
      expect(getData).toBeNull();
    });
  });
});