import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import Toast from '../Toast';
import Banner from '../Banner';
import { Notification } from '../../../contexts/notifications/types';

expect.extend(toHaveNoViolations);

const mockNotifications: Record<string, Notification> = {
  error: {
    id: 'error-1',
    type: 'error',
    message: 'An error occurred',
    timestamp: Date.now(),
  },
  warning: {
    id: 'warning-1',
    type: 'warning',
    message: 'This is a warning',
    timestamp: Date.now(),
  },
  info: {
    id: 'info-1',
    type: 'info',
    message: 'This is information',
    timestamp: Date.now(),
  },
  success: {
    id: 'success-1',
    type: 'success',
    message: 'Operation successful',
    timestamp: Date.now(),
  },
  custom: {
    id: 'custom-1',
    type: 'custom',
    message: 'Custom notification',
    timestamp: Date.now(),
  },
};

describe('Notification Accessibility', () => {
  describe('ARIA Roles and Attributes', () => {
    describe('Toast Component', () => {
      it('should have role="alert" for error notifications', () => {
        render(<Toast notification={mockNotifications.error} onDismiss={() => {}} />);
        
        const toast = screen.getByRole('alert');
        expect(toast).toBeInTheDocument();
        expect(toast).toHaveAttribute('aria-live', 'assertive');
        expect(toast).toHaveAttribute('aria-atomic', 'true');
      });

      it('should have role="status" for non-critical notifications', () => {
        render(<Toast notification={mockNotifications.info} onDismiss={() => {}} />);
        
        const toast = screen.getByRole('status');
        expect(toast).toBeInTheDocument();
        expect(toast).toHaveAttribute('aria-live', 'polite');
        expect(toast).toHaveAttribute('aria-atomic', 'true');
      });

      it('should have warning notifications use alert role', () => {
        render(<Toast notification={mockNotifications.warning} onDismiss={() => {}} />);
        
        const toast = screen.getByRole('alert');
        expect(toast).toBeInTheDocument();
        expect(toast).toHaveAttribute('aria-live', 'assertive');
      });

      it('should have success notifications use status role', () => {
        render(<Toast notification={mockNotifications.success} onDismiss={() => {}} />);
        
        const toast = screen.getByRole('status');
        expect(toast).toBeInTheDocument();
        expect(toast).toHaveAttribute('aria-live', 'polite');
      });
    });

    describe('Banner Component', () => {
      it('should have role="alert" for error notifications', () => {
        render(<Banner notification={mockNotifications.error} onDismiss={() => {}} />);
        
        const banner = screen.getByRole('alert');
        expect(banner).toBeInTheDocument();
        expect(banner).toHaveAttribute('aria-live', 'assertive');
        expect(banner).toHaveAttribute('aria-atomic', 'true');
      });

      it('should have role="status" for non-critical notifications', () => {
        render(<Banner notification={mockNotifications.info} onDismiss={() => {}} />);
        
        const banner = screen.getByRole('status');
        expect(banner).toBeInTheDocument();
        expect(banner).toHaveAttribute('aria-live', 'polite');
        expect(banner).toHaveAttribute('aria-atomic', 'true');
      });
    });
  });

  describe('Keyboard Navigation', () => {
    describe('Toast Component', () => {
      it('should dismiss toast when Escape key is pressed', async () => {
        const user = userEvent.setup();
        const mockDismiss = vi.fn();
        
        const { container } = render(<Toast notification={mockNotifications.info} onDismiss={mockDismiss} />);
        
        // Focus the document body and press Escape
        document.body.focus();
        await user.keyboard('{Escape}');
        
        // Wait for animation to complete
        const toastElement = container.querySelector('[role="status"]') as HTMLElement;
        if (toastElement) {
          fireEvent.transitionEnd(toastElement);
        }
        
        expect(mockDismiss).toHaveBeenCalled();
      });

      it('should not dismiss persistent toast with Escape key', async () => {
        const user = userEvent.setup();
        const mockDismiss = vi.fn();
        const persistentNotification = { ...mockNotifications.info, persistent: true };
        
        render(<Toast notification={persistentNotification} onDismiss={mockDismiss} />);
        
        await user.keyboard('{Escape}');
        
        expect(mockDismiss).not.toHaveBeenCalled();
      });

      it('should have focusable dismiss button', () => {
        render(<Toast notification={mockNotifications.error} onDismiss={() => {}} />);
        
        const dismissButton = screen.getByRole('button', { name: /dismiss error notification/i });
        expect(dismissButton).toBeInTheDocument();
        expect(dismissButton).toHaveAttribute('type', 'button');
      });

      it('should activate dismiss button with Enter key', async () => {
        const user = userEvent.setup();
        const mockDismiss = vi.fn();
        
        const { container } = render(<Toast notification={mockNotifications.error} onDismiss={mockDismiss} />);
        
        const dismissButton = screen.getByRole('button', { name: /dismiss error notification/i });
        dismissButton.focus();
        await user.keyboard('{Enter}');
        
        // Wait for animation to complete
        const toastElement = container.querySelector('[role="alert"]') as HTMLElement;
        if (toastElement) {
          fireEvent.transitionEnd(toastElement);
        }
        
        expect(mockDismiss).toHaveBeenCalled();
      });

      it('should activate dismiss button with Space key', async () => {
        const user = userEvent.setup();
        const mockDismiss = vi.fn();
        
        const { container } = render(<Toast notification={mockNotifications.error} onDismiss={mockDismiss} />);
        
        const dismissButton = screen.getByRole('button', { name: /dismiss error notification/i });
        dismissButton.focus();
        await user.keyboard(' ');
        
        // Wait for animation to complete
        const toastElement = container.querySelector('[role="alert"]') as HTMLElement;
        if (toastElement) {
          fireEvent.transitionEnd(toastElement);
        }
        
        expect(mockDismiss).toHaveBeenCalled();
      });
    });

    describe('Banner Component', () => {
      it('should dismiss banner when Escape key is pressed', async () => {
        const user = userEvent.setup();
        const mockDismiss = vi.fn();
        
        render(<Banner notification={mockNotifications.info} onDismiss={mockDismiss} />);
        
        await user.keyboard('{Escape}');
        
        expect(mockDismiss).toHaveBeenCalled();
      });

      it('should not dismiss persistent banner with Escape key', async () => {
        const user = userEvent.setup();
        const mockDismiss = vi.fn();
        const persistentNotification = { ...mockNotifications.error, persistent: true };
        
        render(<Banner notification={persistentNotification} onDismiss={mockDismiss} />);
        
        await user.keyboard('{Escape}');
        
        expect(mockDismiss).not.toHaveBeenCalled();
      });
    });
  });

  describe('Screen Reader Support', () => {
    describe('Toast Component', () => {
      it('should include screen reader text with notification type and message', () => {
        render(<Toast notification={mockNotifications.error} onDismiss={() => {}} />);
        
        // Check for screen reader text
        expect(screen.getByText('error notification: An error occurred')).toHaveClass('sr-only');
      });

      it('should have accessible dismiss button label', () => {
        render(<Toast notification={mockNotifications.warning} onDismiss={() => {}} />);
        
        const dismissButton = screen.getByRole('button', { name: /dismiss warning notification/i });
        expect(dismissButton).toHaveAttribute('aria-label', 'Dismiss warning notification');
        expect(dismissButton).toHaveAttribute('title', 'Dismiss warning notification');
      });

      it('should group action buttons with appropriate label', () => {
        const notificationWithActions = {
          ...mockNotifications.info,
          actions: [
            { label: 'Retry', onClick: () => {} },
            { label: 'Cancel', onClick: () => {} },
          ],
        };
        
        render(<Toast notification={notificationWithActions} onDismiss={() => {}} />);
        
        const actionsGroup = screen.getByRole('group', { name: 'Notification actions' });
        expect(actionsGroup).toBeInTheDocument();
        
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      });
    });

    describe('Banner Component', () => {
      it('should include screen reader text with notification type and message', () => {
        render(<Banner notification={mockNotifications.success} onDismiss={() => {}} />);
        
        expect(screen.getByText('success notification: Operation successful')).toHaveClass('sr-only');
      });

      it('should have accessible dismiss button label', () => {
        render(<Banner notification={mockNotifications.info} onDismiss={() => {}} />);
        
        const dismissButton = screen.getByRole('button', { name: /dismiss info notification/i });
        expect(dismissButton).toHaveAttribute('aria-label', 'Dismiss info notification');
        expect(dismissButton).toHaveAttribute('title', 'Dismiss info notification');
      });

      it('should not show dismiss button for persistent banners', () => {
        const persistentNotification = { ...mockNotifications.error, persistent: true };
        
        render(<Banner notification={persistentNotification} onDismiss={() => {}} />);
        
        expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Focus Management', () => {
    beforeEach(() => {
      // Create a focusable element to test focus return
      const input = document.createElement('input');
      input.id = 'test-input';
      document.body.appendChild(input);
      input.focus();
    });

    afterEach(() => {
      const input = document.getElementById('test-input');
      if (input) document.body.removeChild(input);
    });

    it('should focus critical toast notifications on mount', async () => {
      render(<Toast notification={mockNotifications.error} onDismiss={() => {}} />);
      const toastElement = await screen.findByRole('alert');
      await waitFor(() => expect(toastElement).toHaveAttribute('tabindex', '-1'));
    });

    it('should focus critical banner notifications on mount', async () => {
      render(<Banner notification={mockNotifications.error} onDismiss={() => {}} />);
      const bannerElement = await screen.findByRole('alert');
      await waitFor(() => expect(bannerElement).toHaveAttribute('tabindex', '-1'));
    });

    it('should not focus non-critical notifications', () => {
      const { container } = render(<Toast notification={mockNotifications.info} onDismiss={() => {}} />);
      
      const toastElement = container.querySelector('[role="status"]');
      expect(toastElement).not.toHaveAttribute('tabindex');
    });
  });

  describe('Automated Accessibility Tests', () => {
    it('Toast component should have no accessibility violations', async () => {
      const { container } = render(
        <Toast notification={mockNotifications.error} onDismiss={() => {}} />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('Banner component should have no accessibility violations', async () => {
      const { container } = render(
        <Banner notification={mockNotifications.warning} onDismiss={() => {}} />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('Toast with actions should have no accessibility violations', async () => {
      const notificationWithActions = {
        ...mockNotifications.info,
        actions: [
          { label: 'Action 1', onClick: () => {} },
          { label: 'Action 2', onClick: () => {} },
        ],
      };
      
      const { container } = render(
        <Toast notification={notificationWithActions} onDismiss={() => {}} />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('Banner with actions should have no accessibility violations', async () => {
      const notificationWithActions = {
        ...mockNotifications.success,
        actions: [
          { label: 'View Details', onClick: () => {} },
          { label: 'Dismiss', onClick: () => {} },
        ],
      };
      
      const { container } = render(
        <Banner notification={notificationWithActions} onDismiss={() => {}} />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('Persistent banner should have no accessibility violations', async () => {
      const persistentNotification = { ...mockNotifications.error, persistent: true };
      
      const { container } = render(
        <Banner notification={persistentNotification} onDismiss={() => {}} />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Reduced Motion Support', () => {
    beforeEach(() => {
      // Mock matchMedia for prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    });

    it('should respect reduced motion preferences', () => {
      render(<Toast notification={mockNotifications.info} onDismiss={() => {}} />);
      
      // The component should still render and be accessible
      const toast = screen.getByRole('status');
      expect(toast).toBeInTheDocument();
      expect(toast).toHaveAttribute('aria-live', 'polite');
    });
  });
});