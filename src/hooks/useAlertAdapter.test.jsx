import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useAlertAdapter from './useAlertAdapter';

// Mock the notification context
const mockNotify = vi.fn();
const mockNotifySuccess = vi.fn();
const mockNotifyError = vi.fn();
const mockNotifyWarning = vi.fn();
const mockNotifyInfo = vi.fn();
const mockRemove = vi.fn();

vi.mock('../contexts/notifications/NotificationContext', () => ({
  useNotification: () => ({
    notify: mockNotify,
    notifySuccess: mockNotifySuccess,
    notifyError: mockNotifyError,
    notifyWarning: mockNotifyWarning,
    notifyInfo: mockNotifyInfo,
    remove: mockRemove,
  }),
}));

describe('useAlertAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotify.mockReturnValue('test-id');
    mockNotifySuccess.mockReturnValue('success-id');
    mockNotifyError.mockReturnValue('error-id');
    mockNotifyWarning.mockReturnValue('warning-id');
    mockNotifyInfo.mockReturnValue('info-id');
  });

  describe('showAlert function', () => {
    it('shows basic alert with message', () => {
      const { result } = renderHook(() => useAlertAdapter());
      
      act(() => {
        result.current.showAlert({ 
          variant: 'info',
          message: 'Test message',
        });
      });
      
      expect(mockNotifyInfo).toHaveBeenCalledWith(
        'Test message', 
        expect.objectContaining({
          message: 'Test message',
        }),
      );
    });

    it('handles title and description composition', () => {
      const { result } = renderHook(() => useAlertAdapter());
      
      act(() => {
        result.current.showAlert({ 
          variant: 'success',
          title: 'Success',
          description: 'Operation completed',
        });
      });
      
      expect(mockNotifySuccess).toHaveBeenCalledWith(
        'Success: Operation completed',
        expect.any(Object),
      );
    });

    it('handles actions correctly', () => {
      const { result } = renderHook(() => useAlertAdapter());
      const mockAction1 = vi.fn();
      const mockAction2 = vi.fn();
      
      act(() => {
        result.current.showAlert({ 
          variant: 'warning',
          message: 'Warning message',
          actions: [
            { label: 'Action 1', onClick: mockAction1 },
            { label: 'Action 2', onClick: mockAction2 },
          ],
        });
      });
      
      expect(mockNotifyWarning).toHaveBeenCalledWith(
        'Warning message',
        expect.objectContaining({
          actions: [
            { label: 'Action 1', onClick: mockAction1 },
            { label: 'Action 2', onClick: mockAction2 },
          ],
        }),
      );
    });

    it('handles dismissible behavior', () => {
      const { result } = renderHook(() => useAlertAdapter());
      
      act(() => {
        result.current.showAlert({ 
          variant: 'error',
          message: 'Error message',
          dismissible: true,
        });
      });
      
      expect(mockNotifyError).toHaveBeenCalledWith(
        'Error message',
        expect.objectContaining({
          persistent: false,
          duration: 5000,
        }),
      );
    });

    it('handles non-dismissible behavior', () => {
      const { result } = renderHook(() => useAlertAdapter());
      
      act(() => {
        result.current.showAlert({ 
          variant: 'error',
          message: 'Critical error',
          dismissible: false,
        });
      });
      
      expect(mockNotifyError).toHaveBeenCalledWith(
        'Critical error',
        expect.objectContaining({
          persistent: true,
        }),
      );
    });

    it('handles custom duration', () => {
      const { result } = renderHook(() => useAlertAdapter());
      
      act(() => {
        result.current.showAlert({ 
          variant: 'info',
          message: 'Custom duration',
          duration: 10000,
        });
      });
      
      expect(mockNotifyInfo).toHaveBeenCalledWith(
        'Custom duration',
        expect.objectContaining({
          duration: 10000,
        }),
      );
    });
  });

  describe('Convenience methods', () => {
    it('provides showSuccessAlert method', () => {
      const { result } = renderHook(() => useAlertAdapter());
      
      act(() => {
        result.current.showSuccessAlert('Success message');
      });
      
      expect(mockNotifySuccess).toHaveBeenCalledWith(
        'Success message',
        expect.any(Object),
      );
    });

    it('provides showErrorAlert method', () => {
      const { result } = renderHook(() => useAlertAdapter());
      
      act(() => {
        result.current.showErrorAlert('Error message');
      });
      
      expect(mockNotifyError).toHaveBeenCalledWith(
        'Error message',
        expect.any(Object),
      );
    });

    it('provides showWarningAlert method', () => {
      const { result } = renderHook(() => useAlertAdapter());
      
      act(() => {
        result.current.showWarningAlert('Warning message');
      });
      
      expect(mockNotifyWarning).toHaveBeenCalledWith(
        'Warning message',
        expect.any(Object),
      );
    });

    it('provides showInfoAlert method', () => {
      const { result } = renderHook(() => useAlertAdapter());
      
      act(() => {
        result.current.showInfoAlert('Info message');
      });
      
      expect(mockNotifyInfo).toHaveBeenCalledWith(
        'Info message',
        expect.any(Object),
      );
    });
  });

  describe('Scout-themed convenience methods', () => {
    it('provides showScoutBlueAlert method', () => {
      const { result } = renderHook(() => useAlertAdapter());
      
      act(() => {
        result.current.showScoutBlueAlert('Scout blue message');
      });
      
      expect(mockNotifyInfo).toHaveBeenCalledWith(
        'Scout blue message',
        expect.objectContaining({
          icon: expect.any(Object),
        }),
      );
    });

    it('provides showScoutGreenAlert method', () => {
      const { result } = renderHook(() => useAlertAdapter());
      
      act(() => {
        result.current.showScoutGreenAlert('Scout green message');
      });
      
      expect(mockNotifySuccess).toHaveBeenCalledWith(
        'Scout green message',
        expect.objectContaining({
          icon: expect.any(Object),
        }),
      );
    });

    it('provides showScoutRedAlert method', () => {
      const { result } = renderHook(() => useAlertAdapter());
      
      act(() => {
        result.current.showScoutRedAlert('Scout red message');
      });
      
      expect(mockNotifyError).toHaveBeenCalledWith(
        'Scout red message',
        expect.objectContaining({
          icon: expect.any(Object),
        }),
      );
    });

    it('provides showScoutOrangeAlert method', () => {
      const { result } = renderHook(() => useAlertAdapter());
      
      act(() => {
        result.current.showScoutOrangeAlert('Scout orange message');
      });
      
      expect(mockNotifyWarning).toHaveBeenCalledWith(
        'Scout orange message',
        expect.objectContaining({
          icon: expect.any(Object),
        }),
      );
    });
  });

  describe('Dismiss functionality', () => {
    it('provides dismissAlert method', () => {
      const { result } = renderHook(() => useAlertAdapter());
      
      act(() => {
        result.current.dismissAlert('test-id');
      });
      
      expect(mockRemove).toHaveBeenCalledWith('test-id');
    });
  });

  describe('Legacy alias', () => {
    it('provides alert method as legacy alias', () => {
      const { result } = renderHook(() => useAlertAdapter());
      
      expect(result.current.alert).toBe(result.current.showAlert);
    });
  });

  describe('Icon handling', () => {
    it('generates scout-themed icons correctly', () => {
      const { result } = renderHook(() => useAlertAdapter());
      
      act(() => {
        result.current.showAlert({ 
          variant: 'scout-blue',
          message: 'Test',
          icon: true,
        });
      });
      
      expect(mockNotifyInfo).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining({
          icon: expect.any(Object),
        }),
      );
    });

    it('handles icon disabled', () => {
      const { result } = renderHook(() => useAlertAdapter());
      
      act(() => {
        result.current.showAlert({ 
          variant: 'success',
          message: 'Test',
          icon: false,
        });
      });
      
      expect(mockNotifySuccess).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining({
          icon: null,
        }),
      );
    });
  });

  describe('Variant mapping', () => {
    it('maps scout variants to correct notification types', () => {
      const { result } = renderHook(() => useAlertAdapter());
      
      const variantTests = [
        { variant: 'scout-blue', expectedMethod: mockNotifyInfo },
        { variant: 'scout-green', expectedMethod: mockNotifySuccess },
        { variant: 'scout-red', expectedMethod: mockNotifyError },
        { variant: 'scout-orange', expectedMethod: mockNotifyWarning },
      ];
      
      variantTests.forEach(({ variant, expectedMethod }) => {
        act(() => {
          result.current.showAlert({ 
            variant,
            message: `Test ${variant}`,
          });
        });
        
        expect(expectedMethod).toHaveBeenCalledWith(
          `Test ${variant}`,
          expect.any(Object),
        );
      });
    });

    it('handles neutral and dark variants', () => {
      const { result } = renderHook(() => useAlertAdapter());
      
      act(() => {
        result.current.showAlert({ 
          variant: 'neutral',
          message: 'Neutral test',
        });
      });
      
      expect(mockNotifyInfo).toHaveBeenCalledWith(
        'Neutral test',
        expect.any(Object),
      );
      
      act(() => {
        result.current.showAlert({ 
          variant: 'dark',
          message: 'Dark test',
        });
      });
      
      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'custom',
        }),
      );
    });
  });

  describe('Error handling', () => {
    it('handles invalid variant gracefully', () => {
      const { result } = renderHook(() => useAlertAdapter());
      
      act(() => {
        result.current.showAlert({ 
          variant: 'invalid-variant',
          message: 'Test message',
        });
      });
      
      expect(mockNotifyInfo).toHaveBeenCalled();
    });

    it('handles missing message gracefully', () => {
      const { result } = renderHook(() => useAlertAdapter());
      
      act(() => {
        result.current.showAlert({ 
          variant: 'info',
        });
      });
      
      expect(mockNotifyInfo).toHaveBeenCalledWith(
        'Alert',
        expect.any(Object),
      );
    });
  });
});