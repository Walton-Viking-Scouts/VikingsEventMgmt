import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';
import { ToastProvider, useToast } from './ToastProvider';

// Test component that uses the toast context
const TestComponent = () => {
  const { toasts, success, error, warning, info, addToast, removeToast, removeAllToasts } = useToast();

  return (
    <div>
      <div data-testid="toast-count">{toasts.length}</div>
      
      <button onClick={() => success('Success message')}>Add Success</button>
      <button onClick={() => error('Error message')}>Add Error</button>
      <button onClick={() => warning('Warning message')}>Add Warning</button>
      <button onClick={() => info('Info message')}>Add Info</button>
      
      <button onClick={() => addToast({
        type: 'custom',
        message: 'Custom message',
        actions: [{ label: 'Test Action', onClick: vi.fn() }]
      })}>Add Custom</button>
      
      <button onClick={() => removeAllToasts()}>Remove All</button>
      
      <div data-testid="toasts">
        {toasts.map(toast => (
          <div key={toast.id} data-testid={`toast-${toast.id}`}>
            <span>{toast.message}</span>
            <span data-testid={`type-${toast.id}`}>{toast.type}</span>
            <button onClick={() => removeToast(toast.id)}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
};

// Component without provider for error testing
const TestWithoutProvider = () => {
  const { toasts } = useToast();
  return <div>{toasts.length}</div>;
};

describe('ToastProvider', () => {
  test('throws error when useToast is used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestWithoutProvider />);
    }).toThrow('useToast must be used within a ToastProvider');
    
    consoleSpy.mockRestore();
  });

  test('provides toast context values', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    expect(screen.getByTestId('toast-count')).toHaveTextContent('0');
    expect(screen.getByText('Add Success')).toBeInTheDocument();
    expect(screen.getByText('Add Error')).toBeInTheDocument();
  });

  test('shorthand methods add toasts with correct types and defaults', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    // Add different types of toasts
    act(() => {
      screen.getByText('Add Success').click();
      screen.getByText('Add Error').click();
      screen.getByText('Add Warning').click();
      screen.getByText('Add Info').click();
    });

    expect(screen.getByTestId('toast-count')).toHaveTextContent('4');
    
    // Check messages are displayed (using getAllByText since ToastContainer renders duplicates)
    expect(screen.getAllByText('Success message')).toHaveLength(2); // Test component + ToastContainer
    expect(screen.getAllByText('Error message')).toHaveLength(2);
    expect(screen.getAllByText('Warning message')).toHaveLength(2);
    expect(screen.getAllByText('Info message')).toHaveLength(2);

    // Check types are correct
    const typeElements = screen.getAllByTestId(/^type-/);
    const types = typeElements.map(el => el.textContent);
    expect(types).toContain('success');
    expect(types).toContain('error');
    expect(types).toContain('warning');
    expect(types).toContain('info');
  });

  test('addToast creates toast with generated ID and timestamp', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    act(() => {
      screen.getByText('Add Custom').click();
    });

    expect(screen.getByTestId('toast-count')).toHaveTextContent('1');
    expect(screen.getAllByText('Custom message')).toHaveLength(2); // Test component + ToastContainer
    expect(screen.getByText('Test Action')).toBeInTheDocument(); // Action only in ToastContainer

    // Check that toast has a unique ID (only count test component toasts)
    const toastElements = screen.getAllByTestId(/^toast-/).filter(el => 
      el.parentElement?.getAttribute('data-testid') === 'toasts'
    );
    expect(toastElements).toHaveLength(1);
    
    const toastId = toastElements[0].getAttribute('data-testid')?.replace('toast-', '');
    expect(toastId).toBeTruthy();
    expect(toastId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
  });

  test('removeToast removes specific toast', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    // Add multiple toasts
    act(() => {
      screen.getByText('Add Success').click();
      screen.getByText('Add Error').click();
    });

    expect(screen.getByTestId('toast-count')).toHaveTextContent('2');

    // Remove one toast
    const removeButton = screen.getAllByText('Remove')[0];
    act(() => {
      removeButton.click();
    });

    expect(screen.getByTestId('toast-count')).toHaveTextContent('1');
  });

  test('removeAllToasts clears all toasts', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    // Add multiple toasts
    act(() => {
      screen.getByText('Add Success').click();
      screen.getByText('Add Error').click();
      screen.getByText('Add Warning').click();
    });

    expect(screen.getByTestId('toast-count')).toHaveTextContent('3');

    // Remove all
    act(() => {
      screen.getByText('Remove All').click();
    });

    expect(screen.getByTestId('toast-count')).toHaveTextContent('0');
  });

  test('renders ToastContainer with toasts', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    // Add a toast
    act(() => {
      screen.getByText('Add Success').click();
    });

    // ToastContainer should render the toast
    expect(screen.getAllByText('Success message')).toHaveLength(2); // Test component + ToastContainer
    
    // Should have dismiss button from Toast component
    expect(screen.getByLabelText('Dismiss success notification')).toBeInTheDocument();
  });

  test('shorthand methods use correct default durations', () => {
    vi.useFakeTimers();
    
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    act(() => {
      screen.getByText('Add Success').click(); // 4000ms default
    });

    expect(screen.getByTestId('toast-count')).toHaveTextContent('1');

    // Success should auto-dismiss after 4000ms
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    // Toast should start exit animation but still be in DOM
    expect(screen.getByTestId('toast-count')).toHaveTextContent('1');

    vi.useRealTimers();
  });

  test('toasts have unique IDs when added rapidly', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    // Add multiple toasts quickly
    act(() => {
      screen.getByText('Add Info').click();
      screen.getByText('Add Info').click();
      screen.getByText('Add Info').click();
    });

    expect(screen.getByTestId('toast-count')).toHaveTextContent('3');

    // All should have unique IDs (only count test component toasts, not ToastContainer duplicates)
    const toastElements = screen.getAllByTestId(/^toast-/).filter(el => 
      el.parentElement?.getAttribute('data-testid') === 'toasts'
    );
    const toastIds = toastElements.map(el => 
      el.getAttribute('data-testid')?.replace('toast-', '')
    );
    
    const uniqueIds = new Set(toastIds);
    expect(uniqueIds.size).toBe(3);
  });
});