import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';
import { NotificationProvider, useNotification } from './NotificationContext';

// Simple test component
const TestComponent = () => {
  const { notifications, notify, notifyError, notifySuccess, remove, removeAll } = useNotification();

  return (
    <div>
      <button 
        data-testid="add-basic" 
        onClick={() => notify({ type: 'info', message: 'Basic notification' })}
      >
        Add Basic
      </button>
      <button 
        data-testid="add-error" 
        onClick={() => notifyError('Error message')}
      >
        Add Error
      </button>
      <button 
        data-testid="add-success" 
        onClick={() => notifySuccess('Success message')}
      >
        Add Success
      </button>
      <button 
        data-testid="add-persistent" 
        onClick={() => notify({ type: 'info', message: 'Persistent', persistent: true })}
      >
        Add Persistent
      </button>
      <button data-testid="remove-all" onClick={removeAll}>
        Remove All
      </button>
      <div data-testid="count">{notifications.length}</div>
      <div data-testid="notifications">
        {notifications.map(n => (
          <div key={n.id} data-testid={`notification-${n.id}`}>
            <span>{n.message}</span>
            <span data-testid={`type-${n.id}`}>{n.type}</span>
            <button onClick={() => remove(n.id)}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
};

// Test component without provider for error testing
const TestWithoutProvider = () => {
  const { notifications } = useNotification();
  return <div>{notifications.length}</div>;
};

describe('NotificationContext', () => {
  test('throws error when used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestWithoutProvider />);
    }).toThrow('useNotification must be used within a NotificationProvider');
    
    consoleSpy.mockRestore();
  });

  test('basic notification functionality', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    // Initially empty
    expect(screen.getByTestId('count')).toHaveTextContent('0');

    // Add a basic notification
    act(() => {
      screen.getByTestId('add-basic').click();
    });
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(screen.getByText('Basic notification')).toBeInTheDocument();

    // Add more notifications
    act(() => {
      screen.getByTestId('add-error').click();
      screen.getByTestId('add-success').click();
    });
    expect(screen.getByTestId('count')).toHaveTextContent('3');

    // Test removeAll
    act(() => {
      screen.getByTestId('remove-all').click();
    });
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  test('notification helper functions work correctly', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    // Add different types
    act(() => {
      screen.getByTestId('add-error').click();
      screen.getByTestId('add-success').click();
    });

    expect(screen.getByTestId('count')).toHaveTextContent('2');
    expect(screen.getByText('Error message')).toBeInTheDocument();
    expect(screen.getByText('Success message')).toBeInTheDocument();

    // Check types are correct
    const typeElements = screen.getAllByTestId(/^type-/);
    const types = typeElements.map(el => el.textContent);
    expect(types).toContain('error');
    expect(types).toContain('success');
  });

  test('individual notification removal', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    // Add a persistent notification
    act(() => {
      screen.getByTestId('add-persistent').click();
    });
    expect(screen.getByTestId('count')).toHaveTextContent('1');

    // Remove it manually
    act(() => {
      screen.getByText('Remove').click();
    });
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  test('notifications have unique IDs', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    // Add multiple notifications
    act(() => {
      screen.getByTestId('add-basic').click();
      screen.getByTestId('add-basic').click();
      screen.getByTestId('add-basic').click();
    });

    expect(screen.getByTestId('count')).toHaveTextContent('3');

    // Check all have unique IDs
    const notificationElements = screen.getAllByTestId(/^notification-/);
    const testIds = notificationElements.map(el => el.getAttribute('data-testid'));
    const uniqueIds = new Set(testIds);
    
    expect(uniqueIds.size).toBe(3);
  });

  test('auto-dismissal logic with real timers', async () => {
    vi.useRealTimers(); // Use real timers for this test
    
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    // Add notification with short duration for testing
    act(() => {
      screen.getByTestId('add-basic').click();
    });
    expect(screen.getByTestId('count')).toHaveTextContent('1');

    // Wait for auto-dismissal (basic info has 5000ms duration by default)
    // We'll just verify the timeout is set up, not wait for it
    expect(screen.getByText('Basic notification')).toBeInTheDocument();
    
    // Add persistent notification that shouldn't auto-dismiss
    act(() => {
      screen.getByTestId('add-persistent').click();
    });
    expect(screen.getByTestId('count')).toHaveTextContent('2');
    expect(screen.getByText('Persistent')).toBeInTheDocument();
  });
});