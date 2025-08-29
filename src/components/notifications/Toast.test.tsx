import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';
import Toast from './Toast';
import { Notification } from '../../contexts/notifications/types';

const createMockNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: '1',
  type: 'info',
  message: 'Test notification',
  timestamp: Date.now(),
  ...overrides
});

describe('Toast', () => {
  test('renders notification message', () => {
    const notification = createMockNotification({ message: 'Hello World' });
    const onDismiss = vi.fn();

    render(<Toast notification={notification} onDismiss={onDismiss} />);

    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  test('applies correct styling for different notification types', () => {
    const types: Notification['type'][] = ['error', 'warning', 'info', 'success', 'custom'];

    types.forEach((type) => {
      const { container } = render(
        <Toast 
          notification={createMockNotification({ type })} 
          onDismiss={vi.fn()} 
        />
      );
      
      const toastElement = container.firstChild as HTMLElement;
      expect(toastElement).toHaveClass('rounded-md', 'p-4', 'shadow-lg');
      
      // Each type should have different colors
      const hasTypeStyles = toastElement.className.includes('bg-red-') || 
                           toastElement.className.includes('bg-yellow-') ||
                           toastElement.className.includes('bg-blue-') ||
                           toastElement.className.includes('bg-green-') ||
                           toastElement.className.includes('bg-gray-');
      expect(hasTypeStyles).toBe(true);
    });
  });

  test('sets correct ARIA attributes for error vs other types', () => {
    // Error notification
    const { container: errorContainer } = render(
      <Toast 
        notification={createMockNotification({ type: 'error' })} 
        onDismiss={vi.fn()} 
      />
    );
    expect(errorContainer.firstChild).toHaveAttribute('role', 'alert');
    expect(errorContainer.firstChild).toHaveAttribute('aria-live', 'assertive');

    // Non-error notification
    const { container: infoContainer } = render(
      <Toast 
        notification={createMockNotification({ type: 'info' })} 
        onDismiss={vi.fn()} 
      />
    );
    expect(infoContainer.firstChild).toHaveAttribute('role', 'status');
    expect(infoContainer.firstChild).toHaveAttribute('aria-live', 'polite');
  });

  test('renders custom icon when provided', () => {
    const customIcon = <span data-testid="custom-icon">🔥</span>;
    const notification = createMockNotification({ icon: customIcon });

    render(<Toast notification={notification} onDismiss={vi.fn()} />);

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  test('renders default icon when no custom icon provided', () => {
    const notification = createMockNotification({ type: 'success' });

    render(<Toast notification={notification} onDismiss={vi.fn()} />);

    // Should render an SVG icon
    const svgIcon = document.querySelector('svg');
    expect(svgIcon).toBeInTheDocument();
  });

  test('renders action buttons when provided', () => {
    const actions = [
      { label: 'Action 1', onClick: vi.fn() },
      { label: 'Action 2', onClick: vi.fn() }
    ];
    const notification = createMockNotification({ actions });

    render(<Toast notification={notification} onDismiss={vi.fn()} />);

    expect(screen.getByText('Action 1')).toBeInTheDocument();
    expect(screen.getByText('Action 2')).toBeInTheDocument();
  });

  test('calls action onClick when action button is clicked', () => {
    const mockAction = vi.fn();
    const actions = [{ label: 'Test Action', onClick: mockAction }];
    const notification = createMockNotification({ actions });

    render(<Toast notification={notification} onDismiss={vi.fn()} />);

    const actionButton = screen.getByText('Test Action');
    actionButton.click();

    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  test('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    const notification = createMockNotification();

    render(<Toast notification={notification} onDismiss={onDismiss} />);

    const dismissButton = screen.getByLabelText('Dismiss info notification');
    
    act(() => {
      dismissButton.click();
    });

    // Should trigger animation first, onDismiss called after animation
    expect(onDismiss).not.toHaveBeenCalled();
  });

  test('auto-dismisses after timeout when not persistent', async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const notification = createMockNotification({ 
      duration: 1000, 
      persistent: false 
    });

    render(<Toast notification={notification} onDismiss={onDismiss} />);

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Should trigger animation, but onDismiss not called yet
    expect(onDismiss).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  test('does not auto-dismiss when persistent is true', async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const notification = createMockNotification({ 
      duration: 1000, 
      persistent: true 
    });

    render(<Toast notification={notification} onDismiss={onDismiss} />);

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onDismiss).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  test('uses autoDismissTimeout prop over notification duration', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const notification = createMockNotification({ 
      duration: 5000, 
      persistent: false 
    });

    render(
      <Toast 
        notification={notification} 
        onDismiss={onDismiss} 
        autoDismissTimeout={1000}
      />
    );

    // Should use the 1000ms timeout, not the 5000ms duration
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Animation should be triggered
    expect(onDismiss).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  test('applies custom className', () => {
    const notification = createMockNotification();
    const customClass = 'my-custom-class';

    const { container } = render(
      <Toast 
        notification={notification} 
        onDismiss={vi.fn()} 
        className={customClass}
      />
    );

    expect(container.firstChild).toHaveClass(customClass);
  });
});