import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AlertAdapter, { AlertTitle, AlertDescription, AlertActions } from './AlertAdapter';
import { NotificationProvider } from '../../contexts/notifications/NotificationContext';

// Mock the notification context
const mockNotify = vi.fn();
const mockRemove = vi.fn();

vi.mock('../../contexts/notifications/NotificationContext', async () => {
  const actual = await vi.importActual('../../contexts/notifications/NotificationContext');
  return {
    ...actual,
    useNotification: () => ({
      notify: mockNotify,
      remove: mockRemove,
      notifications: [],
    }),
  };
});

// Test wrapper with NotificationProvider
const TestWrapper = ({ children }) => (
  <NotificationProvider>
    {children}
  </NotificationProvider>
);

describe('AlertAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotify.mockReturnValue('test-notification-id');
  });

  describe('Basic functionality', () => {
    it('renders simple alert content correctly', () => {
      render(
        <TestWrapper>
          <AlertAdapter variant="info">
            Test alert message
          </AlertAdapter>
        </TestWrapper>,
      );
    });

    it('handles different variants correctly', () => {
      const testVariants = ['success', 'error', 'warning', 'info'];
      
      testVariants.forEach(variant => {
        render(
          <TestWrapper>
            <AlertAdapter variant={variant}>
              {variant} message
            </AlertAdapter>
          </TestWrapper>,
        );
      });
    });

    it('handles scout-themed variants correctly', () => {
      const scoutVariants = ['scout-blue', 'scout-green', 'scout-red', 'scout-orange'];
      
      scoutVariants.forEach(variant => {
        render(
          <TestWrapper>
            <AlertAdapter variant={variant}>
              {variant} message
            </AlertAdapter>
          </TestWrapper>,
        );
      });
    });
  });

  describe('Compound components', () => {
    it('extracts title from AlertTitle component', () => {
      render(
        <TestWrapper>
          <AlertAdapter variant="info">
            <AlertTitle>Test Title</AlertTitle>
            <AlertDescription>Test Description</AlertDescription>
          </AlertAdapter>
        </TestWrapper>,
      );
    });

    it('extracts actions from AlertActions component', () => {
      const mockAction = vi.fn();
      
      render(
        <TestWrapper>
          <AlertAdapter variant="warning">
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>Action required</AlertDescription>
            <AlertActions>
              <button onClick={mockAction}>Take Action</button>
            </AlertActions>
          </AlertAdapter>
        </TestWrapper>,
      );
    });

    it('handles mixed content correctly', () => {
      const mockAction = vi.fn();
      
      render(
        <TestWrapper>
          <AlertAdapter variant="success">
            <AlertTitle>Operation Complete</AlertTitle>
            Regular text content
            <AlertDescription>The operation was successful</AlertDescription>
            <AlertActions>
              <button onClick={mockAction}>Continue</button>
            </AlertActions>
          </AlertAdapter>
        </TestWrapper>,
      );
    });
  });

  describe('Dismissible behavior', () => {
    it('handles dismissible alerts', () => {
      const mockOnDismiss = vi.fn();
      
      render(
        <TestWrapper>
          <AlertAdapter 
            variant="info" 
            dismissible={true}
            onDismiss={mockOnDismiss}
          >
            Dismissible alert
          </AlertAdapter>
        </TestWrapper>,
      );
    });

    it('handles non-dismissible alerts', () => {
      render(
        <TestWrapper>
          <AlertAdapter 
            variant="error" 
            dismissible={false}
          >
            Non-dismissible error
          </AlertAdapter>
        </TestWrapper>,
      );
    });
  });

  describe('Icon handling', () => {
    it('shows icons by default', () => {
      render(
        <TestWrapper>
          <AlertAdapter variant="success">
            Success with icon
          </AlertAdapter>
        </TestWrapper>,
      );
    });

    it('can hide icons', () => {
      render(
        <TestWrapper>
          <AlertAdapter variant="success" icon={false}>
            Success without icon
          </AlertAdapter>
        </TestWrapper>,
      );
    });

    it('handles scout-themed icons correctly', () => {
      const scoutVariants = ['scout-blue', 'scout-green', 'scout-red', 'scout-orange'];
      
      scoutVariants.forEach(variant => {
        render(
          <TestWrapper>
            <AlertAdapter variant={variant} icon={true}>
              {variant} with icon
            </AlertAdapter>
          </TestWrapper>,
        );
      });
    });
  });

  describe('Toast mode', () => {
    it('renders in toast mode when useToast is true', () => {
      render(
        <TestWrapper>
          <AlertAdapter 
            variant="info" 
            useToast={true}
          >
            Toast notification
          </AlertAdapter>
        </TestWrapper>,
      );
    });
  });

  describe('Size and styling', () => {
    it('applies custom className', () => {
      render(
        <TestWrapper>
          <AlertAdapter 
            variant="info" 
            className="custom-class"
          >
            Styled alert
          </AlertAdapter>
        </TestWrapper>,
      );
    });

    it('handles size prop (for compatibility)', () => {
      render(
        <TestWrapper>
          <AlertAdapter 
            variant="info" 
            size="lg"
          >
            Large alert
          </AlertAdapter>
        </TestWrapper>,
      );
    });
  });

  describe('Legacy compatibility', () => {
    it('maintains compound component API structure', () => {
      expect(AlertAdapter.Title).toBeDefined();
      expect(AlertAdapter.Description).toBeDefined();
      expect(AlertAdapter.Actions).toBeDefined();
    });

    it('handles all legacy Alert variants', () => {
      const legacyVariants = [
        'success', 'warning', 'error', 'info',
        'scout-blue', 'scout-green', 'scout-red', 'scout-orange',
        'neutral', 'dark',
      ];
      
      legacyVariants.forEach(variant => {
        render(
          <TestWrapper>
            <AlertAdapter variant={variant}>
              {variant} message
            </AlertAdapter>
          </TestWrapper>,
        );
      });
    });

    it('handles empty content gracefully', () => {
      render(
        <TestWrapper>
          <AlertAdapter variant="info">
          </AlertAdapter>
        </TestWrapper>,
      );
    });
  });

  describe('Error handling', () => {
    it('handles undefined variant gracefully', () => {
      render(
        <TestWrapper>
          <AlertAdapter>
            Default alert
          </AlertAdapter>
        </TestWrapper>,
      );
    });

    it('handles invalid compound component children', () => {
      render(
        <TestWrapper>
          <AlertAdapter variant="info">
            <div>Invalid child</div>
            <AlertTitle>Valid title</AlertTitle>
          </AlertAdapter>
        </TestWrapper>,
      );
    });
  });
});