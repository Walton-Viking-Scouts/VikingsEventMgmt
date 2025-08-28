import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';
import Banner from './Banner';
import { Notification } from '../../contexts/notifications/types';

const createMockNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: '1',
  type: 'info',
  message: 'Test banner notification',
  timestamp: Date.now(),
  persistent: false,
  ...overrides
});

describe('Banner', () => {
  test('renders notification message', () => {
    const notification = createMockNotification({ message: 'Important system message' });
    const onDismiss = vi.fn();

    render(<Banner notification={notification} onDismiss={onDismiss} />);

    expect(screen.getByText('Important system message')).toBeInTheDocument();
  });

  test('applies correct styling for different notification types', () => {
    const types: Notification['type'][] = ['error', 'warning', 'info', 'success', 'custom'];

    types.forEach((type) => {
      const { container } = render(
        <Banner 
          notification={createMockNotification({ type })} 
          onDismiss={vi.fn()} 
        />
      );
      
      const bannerElement = container.firstChild as HTMLElement;
      expect(bannerElement).toHaveClass('w-full', 'border-l-4', 'p-4');
      
      // Each type should have different colors
      const hasTypeStyles = bannerElement.className.includes('bg-red-') || 
                           bannerElement.className.includes('bg-yellow-') ||
                           bannerElement.className.includes('bg-blue-') ||
                           bannerElement.className.includes('bg-green-') ||
                           bannerElement.className.includes('bg-gray-');
      expect(hasTypeStyles).toBe(true);
    });
  });

  test('sets correct ARIA attributes for error vs other types', () => {
    // Error notification
    const { container: errorContainer } = render(
      <Banner 
        notification={createMockNotification({ type: 'error' })} 
        onDismiss={vi.fn()} 
      />
    );
    expect(errorContainer.firstChild).toHaveAttribute('role', 'alert');
    expect(errorContainer.firstChild).toHaveAttribute('aria-live', 'assertive');

    // Non-error notification
    const { container: infoContainer } = render(
      <Banner 
        notification={createMockNotification({ type: 'info' })} 
        onDismiss={vi.fn()} 
      />
    );
    expect(infoContainer.firstChild).toHaveAttribute('role', 'status');
    expect(infoContainer.firstChild).toHaveAttribute('aria-live', 'polite');
  });

  test('renders custom icon when provided', () => {
    const customIcon = <span data-testid="custom-banner-icon">🚨</span>;
    const notification = createMockNotification({ icon: customIcon });

    render(<Banner notification={notification} onDismiss={vi.fn()} />);

    expect(screen.getByTestId('custom-banner-icon')).toBeInTheDocument();
  });

  test('renders default icon when no custom icon provided', () => {
    const notification = createMockNotification({ type: 'success' });

    render(<Banner notification={notification} onDismiss={vi.fn()} />);

    // Should render an SVG icon
    const svgIcon = document.querySelector('svg');
    expect(svgIcon).toBeInTheDocument();
  });

  test('renders action buttons when provided', () => {
    const actions = [
      { label: 'View Details', onClick: vi.fn() },
      { label: 'Dismiss All', onClick: vi.fn() }
    ];
    const notification = createMockNotification({ actions });

    render(<Banner notification={notification} onDismiss={vi.fn()} />);

    expect(screen.getByText('View Details')).toBeInTheDocument();
    expect(screen.getByText('Dismiss All')).toBeInTheDocument();
  });

  test('calls action onClick when action button is clicked', () => {
    const mockAction = vi.fn();
    const actions = [{ label: 'Test Banner Action', onClick: mockAction }];
    const notification = createMockNotification({ actions });

    render(<Banner notification={notification} onDismiss={vi.fn()} />);

    const actionButton = screen.getByText('Test Banner Action');
    actionButton.click();

    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  test('shows dismiss button when not persistent', () => {
    const notification = createMockNotification({ persistent: false });
    render(<Banner notification={notification} onDismiss={vi.fn()} />);

    expect(screen.getByLabelText('Dismiss info notification')).toBeInTheDocument();
  });

  test('hides dismiss button when persistent', () => {
    const notification = createMockNotification({ persistent: true });
    render(<Banner notification={notification} onDismiss={vi.fn()} />);

    expect(screen.queryByLabelText('Dismiss info notification')).not.toBeInTheDocument();
  });

  test('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    const notification = createMockNotification({ persistent: false });

    render(<Banner notification={notification} onDismiss={onDismiss} />);

    const dismissButton = screen.getByLabelText('Dismiss info notification');
    dismissButton.click();

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('handles Escape key to dismiss non-persistent banners', () => {
    const onDismiss = vi.fn();
    const notification = createMockNotification({ persistent: false });

    render(<Banner notification={notification} onDismiss={onDismiss} />);

    // Simulate Escape key press
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('does not dismiss persistent banners with Escape key', () => {
    const onDismiss = vi.fn();
    const notification = createMockNotification({ persistent: true });

    render(<Banner notification={notification} onDismiss={onDismiss} />);

    // Simulate Escape key press
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);
    });

    expect(onDismiss).not.toHaveBeenCalled();
  });

  test('ignores non-Escape key presses', () => {
    const onDismiss = vi.fn();
    const notification = createMockNotification({ persistent: false });

    render(<Banner notification={notification} onDismiss={onDismiss} />);

    // Simulate Enter key press
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      document.dispatchEvent(event);
    });

    expect(onDismiss).not.toHaveBeenCalled();
  });

  test('applies custom className', () => {
    const notification = createMockNotification();
    const customClass = 'my-custom-banner-class';

    const { container } = render(
      <Banner 
        notification={notification} 
        onDismiss={vi.fn()} 
        className={customClass}
      />
    );

    expect(container.firstChild).toHaveClass(customClass);
  });

  test('cleans up event listeners on unmount', () => {
    const onDismiss = vi.fn();
    const notification = createMockNotification({ persistent: false });
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = render(<Banner notification={notification} onDismiss={onDismiss} />);
    
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    
    removeEventListenerSpy.mockRestore();
  });
});