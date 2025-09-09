import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import Toast from '../components/notifications/Toast';
import { NotificationProvider } from '../../../shared/contexts/notifications/NotificationContext';
import { SuccessIcon, ErrorIcon, WarningIcon, InfoIcon } from '../components/notifications/NotificationStyles';

// Wrapper component to provide notification context
const ToastWrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationProvider>
    <div style={{ padding: '20px', minHeight: '200px' }}>
      {children}
    </div>
  </NotificationProvider>
);

const meta: Meta<typeof Toast> = {
  title: 'Notifications/Toast',
  component: Toast,
  decorators: [
    (Story) => (
      <ToastWrapper>
        <Story />
      </ToastWrapper>
    ),
  ],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Toast notifications appear at the corner of the screen for temporary feedback and status updates.',
      },
    },
  },
  argTypes: {
    type: {
      control: 'select',
      options: ['success', 'error', 'warning', 'info', 'custom'],
      description: 'The type of notification, affects color and default icon',
    },
    message: {
      control: 'text',
      description: 'The main message text to display',
    },
    onDismiss: {
      action: 'dismissed',
      description: 'Callback fired when toast is dismissed',
    },
    actions: {
      control: 'object',
      description: 'Array of action buttons to display',
    },
    icon: {
      control: 'boolean',
      description: 'Whether to show an icon (true) or provide custom icon',
    },
    position: {
      control: 'select',
      options: ['top-right', 'top-left', 'bottom-right', 'bottom-left'],
      description: 'Position of the toast on screen',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Mock notification object helper
const createMockNotification = (overrides: Partial<any> = {}) => ({
  id: 'story-toast-id',
  timestamp: Date.now(),
  type: 'info',
  message: 'Default toast message',
  duration: 5000,
  persistent: false,
  ...overrides,
});

// Basic Stories
export const Success: Story = {
  args: {
    notification: createMockNotification({
      type: 'success',
      message: 'Operation completed successfully!',
      icon: <SuccessIcon />,
    }),
    onDismiss: () => console.log('Success toast dismissed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'A success toast notification with default green styling and checkmark icon.',
      },
    },
  },
};

export const Error: Story = {
  args: {
    notification: createMockNotification({
      type: 'error',
      message: 'Failed to save changes. Please try again.',
      icon: <ErrorIcon />,
    }),
    onDismiss: () => console.log('Error toast dismissed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'An error toast notification with red styling and error icon.',
      },
    },
  },
};

export const Warning: Story = {
  args: {
    notification: createMockNotification({
      type: 'warning',
      message: 'Your session will expire in 5 minutes.',
      icon: <WarningIcon />,
    }),
    onDismiss: () => console.log('Warning toast dismissed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'A warning toast notification with yellow/amber styling and warning icon.',
      },
    },
  },
};

export const Info: Story = {
  args: {
    notification: createMockNotification({
      type: 'info',
      message: 'New features are available in settings.',
      icon: <InfoIcon />,
    }),
    onDismiss: () => console.log('Info toast dismissed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'An info toast notification with blue styling and info icon.',
      },
    },
  },
};

// With Actions
export const WithSingleAction: Story = {
  args: {
    notification: createMockNotification({
      type: 'error',
      message: 'Connection failed',
      icon: <ErrorIcon />,
      actions: [
        { label: 'Retry', onClick: () => console.log('Retry clicked') },
      ],
    }),
    onDismiss: () => console.log('Toast with action dismissed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'A toast with a single action button. Actions appear below the message.',
      },
    },
  },
};

export const WithMultipleActions: Story = {
  args: {
    notification: createMockNotification({
      type: 'warning',
      message: 'You have unsaved changes',
      icon: <WarningIcon />,
      actions: [
        { label: 'Save', onClick: () => console.log('Save clicked') },
        { label: 'Discard', onClick: () => console.log('Discard clicked') },
      ],
    }),
    onDismiss: () => console.log('Multi-action toast dismissed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'A toast with multiple action buttons for more complex user choices.',
      },
    },
  },
};

// Custom Configurations
export const CustomDuration: Story = {
  args: {
    notification: createMockNotification({
      type: 'info',
      message: 'This toast stays longer than usual',
      icon: <InfoIcon />,
      duration: 10000, // 10 seconds
    }),
    onDismiss: () => console.log('Long duration toast dismissed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'A toast with custom duration (10 seconds instead of default 5 seconds).',
      },
    },
  },
};

export const Persistent: Story = {
  args: {
    notification: createMockNotification({
      type: 'error',
      message: 'Critical error - requires immediate attention',
      icon: <ErrorIcon />,
      persistent: true,
      actions: [
        { label: 'Acknowledge', onClick: () => console.log('Acknowledged') },
      ],
    }),
    onDismiss: () => console.log('Persistent toast dismissed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'A persistent toast that won\'t auto-dismiss. User must manually dismiss or take action.',
      },
    },
  },
};

export const NoIcon: Story = {
  args: {
    notification: createMockNotification({
      type: 'success',
      message: 'Simple message without icon',
      icon: null,
    }),
    onDismiss: () => console.log('No icon toast dismissed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'A toast without an icon for simpler, text-only notifications.',
      },
    },
  },
};

export const CustomIcon: Story = {
  args: {
    notification: createMockNotification({
      type: 'custom',
      message: 'Notification with custom icon',
      icon: <span style={{ fontSize: '20px' }}>🚀</span>,
    }),
    onDismiss: () => console.log('Custom icon toast dismissed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'A toast with a custom icon (emoji or custom component).',
      },
    },
  },
};

export const LongMessage: Story = {
  args: {
    notification: createMockNotification({
      type: 'info',
      message: 'This is a longer message that demonstrates how the toast handles more text content and wraps appropriately within the toast container boundaries.',
      icon: <InfoIcon />,
    }),
    onDismiss: () => console.log('Long message toast dismissed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'A toast with a longer message to show text wrapping behavior.',
      },
    },
  },
};

// Scout-themed variants
export const ScoutSuccess: Story = {
  args: {
    notification: createMockNotification({
      type: 'success',
      message: 'Scout achievement unlocked!',
      icon: <span style={{ fontSize: '20px' }}>🏆</span>,
    }),
    onDismiss: () => console.log('Scout success toast dismissed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Success notification with Scout-themed content and achievement icon.',
      },
    },
  },
};

export const ScoutInfo: Story = {
  args: {
    notification: createMockNotification({
      type: 'info',
      message: 'Remember to bring your neckerchief to the next meeting',
      icon: <span style={{ fontSize: '20px' }}>⚜️</span>,
    }),
    onDismiss: () => console.log('Scout info toast dismissed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Info notification with Scout-themed content and Scout symbol.',
      },
    },
  },
};