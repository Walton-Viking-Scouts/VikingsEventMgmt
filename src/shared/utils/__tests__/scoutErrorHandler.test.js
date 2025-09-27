import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getScoutFriendlyMessage, isOfflineError, commonErrorHandlers } from '../scoutErrorHandler.js';

// Mock the notifications
vi.mock('../notifications.js', () => ({
  notifyError: vi.fn(),
  notifyWarning: vi.fn(),
}));

// Mock the logger
vi.mock('../../services/utils/logger.js', () => ({
  default: {
    error: vi.fn(),
  },
  LOG_CATEGORIES: {
    ERROR: 'error',
  },
}));

describe('scoutErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getScoutFriendlyMessage', () => {
    it('converts network errors to Scout-friendly messages', () => {
      const networkError = new Error('fetch failed');
      const message = getScoutFriendlyMessage(networkError);
      expect(message).toBe('Unable to connect to OSM. Check your internet connection and try again.');
    });

    it('converts 401 errors to authentication messages', () => {
      const authError = new Error('401 Unauthorized');
      const message = getScoutFriendlyMessage(authError);
      expect(message).toBe('You don\'t have permission for this action. Contact your section admin.');
    });

    it('converts 403 errors to permission messages', () => {
      const permissionError = new Error('403 Forbidden');
      const message = getScoutFriendlyMessage(permissionError);
      expect(message).toBe('You don\'t have permission for this action. Contact your section admin.');
    });

    it('converts 500 errors to server messages', () => {
      const serverError = new Error('500 Internal Server Error');
      const message = getScoutFriendlyMessage(serverError);
      expect(message).toBe('OSM server is having problems. Please try again in a few minutes.');
    });

    it('adds context to error messages', () => {
      const error = new Error('fetch failed');
      const message = getScoutFriendlyMessage(error, 'loading member data');
      expect(message).toBe('Unable to loading member data. Unable to connect to OSM. Check your internet connection and try again.');
    });

    it('handles string errors', () => {
      const message = getScoutFriendlyMessage('Something went wrong');
      expect(message).toBe('Something went wrong. Please try again or contact support if this continues.');
    });

    it('handles error objects without message', () => {
      const errorObj = { status: 404 };
      const message = getScoutFriendlyMessage(errorObj);
      expect(message).toBe('The requested information wasn\'t found.');
    });
  });

  describe('isOfflineError', () => {
    it('detects fetch failures as offline errors', () => {
      const fetchError = new Error('fetch failed');
      expect(isOfflineError(fetchError)).toBe(true);
    });

    it('detects network errors as offline errors', () => {
      const networkError = new Error('Network request failed');
      expect(isOfflineError(networkError)).toBe(true);
    });

    it('does not detect server errors as offline errors', () => {
      const serverError = new Error('500 Internal Server Error');
      expect(isOfflineError(serverError)).toBe(false);
    });
  });

  describe('commonErrorHandlers', () => {
    it('provides pre-configured error handlers', () => {
      expect(commonErrorHandlers.sync).toBeDefined();
      expect(commonErrorHandlers.load).toBeDefined();
      expect(commonErrorHandlers.save).toBeDefined();
      expect(typeof commonErrorHandlers.sync).toBe('function');
    });
  });

  describe('error message patterns', () => {
    const testCases = [
      {
        error: 'Connection refused',
        expected: 'Unable to connect to OSM. Check your internet connection and try again.',
      },
      {
        error: 'Authentication failed',
        expected: 'Your session has expired. Please log in again to continue.',
      },
      {
        error: 'Permission denied',
        expected: 'You don\'t have permission for this action. Contact your section admin.',
      },
      {
        error: 'JSON parse error',
        expected: 'Some data couldn\'t be loaded. Try refreshing to reload from OSM.',
      },
      {
        error: 'Storage quota exceeded',
        expected: 'Device storage is full. Free up space and try again.',
      },
      {
        error: 'Unknown error type',
        expected: 'Something went wrong. Please try again or contact support if this continues.',
      },
    ];

    testCases.forEach(({ error, expected }) => {
      it(`converts "${error}" to Scout-friendly message`, () => {
        const message = getScoutFriendlyMessage(error);
        expect(message).toBe(expected);
      });
    });
  });
});