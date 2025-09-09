import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNotificationUtils } from './notificationUtils';
import { useNotification } from './NotificationContext';

// Mock the NotificationContext
vi.mock('./NotificationContext', () => ({
  useNotification: vi.fn(),
}));

const mockNotify = vi.fn();
const mockUseNotification = useNotification as any;

describe('useNotificationUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseNotification.mockReturnValue({
      notify: mockNotify,
    });
  });

  describe('toast notifications', () => {
    it('should create success toast with default duration', () => {
      const { result } = renderHook(() => useNotificationUtils());
      const message = 'Success message';

      result.current.toast.success(message);

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'success',
        message,
        duration: 5000,
      });
    });

    it('should create error toast with extended duration', () => {
      const { result } = renderHook(() => useNotificationUtils());
      const message = 'Error message';

      result.current.toast.error(message);

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'error',
        message,
        duration: 8000,
      });
    });

    it('should create info toast with default duration', () => {
      const { result } = renderHook(() => useNotificationUtils());
      const message = 'Info message';

      result.current.toast.info(message);

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'info',
        message,
        duration: 5000,
      });
    });

    it('should create warning toast with medium duration', () => {
      const { result } = renderHook(() => useNotificationUtils());
      const message = 'Warning message';

      result.current.toast.warning(message);

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'warning',
        message,
        duration: 6000,
      });
    });

    it('should allow custom options to override defaults', () => {
      const { result } = renderHook(() => useNotificationUtils());
      const message = 'Custom success';
      const customOptions = {
        duration: 10000,
        persistent: true,
        icon: 'custom-icon',
      };

      result.current.toast.success(message, customOptions);

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'success',
        message,
        duration: 10000,
        persistent: true,
        icon: 'custom-icon',
      });
    });
  });

  describe('banner notifications', () => {
    it('should create success banner with persistent flag', () => {
      const { result } = renderHook(() => useNotificationUtils());
      const message = 'Banner success';

      result.current.banner.success(message);

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'success',
        message,
        persistent: true,
      });
    });

    it('should create error banner with persistent flag', () => {
      const { result } = renderHook(() => useNotificationUtils());
      const message = 'Banner error';

      result.current.banner.error(message);

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'error',
        message,
        persistent: true,
      });
    });

    it('should create info banner with persistent flag', () => {
      const { result } = renderHook(() => useNotificationUtils());
      const message = 'Banner info';

      result.current.banner.info(message);

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'info',
        message,
        persistent: true,
      });
    });

    it('should create warning banner with persistent flag', () => {
      const { result } = renderHook(() => useNotificationUtils());
      const message = 'Banner warning';

      result.current.banner.warning(message);

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'warning',
        message,
        persistent: true,
      });
    });

    it('should allow custom options to override persistent flag', () => {
      const { result } = renderHook(() => useNotificationUtils());
      const message = 'Non-persistent banner';

      result.current.banner.success(message, { persistent: false, duration: 3000 });

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'success',
        message,
        persistent: false,
        duration: 3000,
      });
    });
  });

  describe('form submission helpers', () => {
    it('should create success notification with default message', () => {
      const { result } = renderHook(() => useNotificationUtils());

      result.current.formSubmission.success();

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'success',
        message: 'Form submitted successfully',
        duration: 5000,
      });
    });

    it('should create success notification with custom message', () => {
      const { result } = renderHook(() => useNotificationUtils());
      const customMessage = 'Custom form success message';

      result.current.formSubmission.success(customMessage);

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'success',
        message: customMessage,
        duration: 5000,
      });
    });

    it('should create error notification from error object with message', () => {
      const { result } = renderHook(() => useNotificationUtils());
      const error = new Error('Validation failed');

      result.current.formSubmission.error(error);

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'error',
        message: 'Validation failed',
        duration: 8000,
      });
    });

    it('should create error notification from error object without message', () => {
      const { result } = renderHook(() => useNotificationUtils());
      const error = { code: 500 }; // Error without message property

      result.current.formSubmission.error(error);

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'error',
        message: 'An error occurred while submitting the form',
        duration: 8000,
      });
    });

    it('should create error notification from string error', () => {
      const { result } = renderHook(() => useNotificationUtils());
      const errorMessage = 'Network connection failed';

      result.current.formSubmission.error(errorMessage);

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'error',
        message: 'An error occurred while submitting the form',
        duration: 8000,
      });
    });

    it('should create error notification from null/undefined error', () => {
      const { result } = renderHook(() => useNotificationUtils());

      result.current.formSubmission.error(null);

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'error',
        message: 'An error occurred while submitting the form',
        duration: 8000,
      });
    });
  });

  describe('return value structure', () => {
    it('should return object with toast, banner, and formSubmission properties', () => {
      const { result } = renderHook(() => useNotificationUtils());
      const utils = result.current;

      expect(utils).toHaveProperty('toast');
      expect(utils).toHaveProperty('banner');
      expect(utils).toHaveProperty('formSubmission');

      // Check toast methods
      expect(utils.toast).toHaveProperty('success');
      expect(utils.toast).toHaveProperty('error');
      expect(utils.toast).toHaveProperty('info');
      expect(utils.toast).toHaveProperty('warning');

      // Check banner methods
      expect(utils.banner).toHaveProperty('success');
      expect(utils.banner).toHaveProperty('error');
      expect(utils.banner).toHaveProperty('info');
      expect(utils.banner).toHaveProperty('warning');

      // Check form submission methods
      expect(utils.formSubmission).toHaveProperty('success');
      expect(utils.formSubmission).toHaveProperty('error');
    });

    it('should return functions for all methods', () => {
      const { result } = renderHook(() => useNotificationUtils());
      const utils = result.current;

      expect(typeof utils.toast.success).toBe('function');
      expect(typeof utils.toast.error).toBe('function');
      expect(typeof utils.toast.info).toBe('function');
      expect(typeof utils.toast.warning).toBe('function');

      expect(typeof utils.banner.success).toBe('function');
      expect(typeof utils.banner.error).toBe('function');
      expect(typeof utils.banner.info).toBe('function');
      expect(typeof utils.banner.warning).toBe('function');

      expect(typeof utils.formSubmission.success).toBe('function');
      expect(typeof utils.formSubmission.error).toBe('function');
    });
  });
});