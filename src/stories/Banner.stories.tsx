import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import Banner from '../components/notifications/Banner';
import { NotificationProvider } from '../contexts/notifications/NotificationContext';
import { SuccessIcon, ErrorIcon, WarningIcon, InfoIcon } from '../components/notifications/NotificationStyles';

// Wrapper component to provide notification context
const BannerWrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationProvider>
    <div style={{ padding: '20px', minHeight: '200px' }}>
      {children}
    </div>
  </NotificationProvider>
);

const meta: Meta<typeof Banner> = {
  title: 'Notifications/Banner',
  component: Banner,
  decorators: [
    (Story) => (
      <BannerWrapper>
        <Story />
      </BannerWrapper>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Banner notifications appear at the top of content areas for persistent, system-wide messages.',
      },
    },
  },
  argTypes: {
    notification: {
      control: 'object',
      description: 'The notification object containing all banner data',
    },
    onDismiss: {
      action: 'dismissed',
      description: 'Callback fired when banner is dismissed (if dismissible)',
    },
    position: {
      control: 'select',
      options: ['top', 'bottom'],
      description: 'Position of the banner relative to content',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Mock notification object helper
const createMockNotification = (overrides: Partial<any> = {}) => ({
  id: 'story-banner-id',
  timestamp: Date.now(),
  type: 'info',
  message: 'Default banner message',
  persistent: true,
  ...overrides,
});

// Basic Stories
export const Success: Story = {
  args: {
    notification: createMockNotification({
      type: 'success',
      message: 'Data synchronization completed successfully',
      icon: <SuccessIcon />,
    }),
    onDismiss: () => console.log('Success banner dismissed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'A success banner notification with green styling. Typically used for system-wide success messages.',
      },
    },
  },
};

export const Error: Story = {
  args: {
    notification: createMockNotification({
      type: 'error',
      message: 'Unable to connect to server. Working in offline mode.',
      icon: <ErrorIcon />,
    }),
    onDismiss: () => console.log('Error banner dismissed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'An error banner notification with red styling. Used for critical system errors.',
      },
    },
  },
};

export const Warning: Story = {
  args: {
    notification: createMockNotification({
      type: 'warning',
      message: 'System maintenance scheduled for tonight at 10 PM',
      icon: <WarningIcon />,
    }),
    onDismiss: () => console.log('Warning banner dismissed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'A warning banner notification with amber styling. Used for important system announcements.',
      },
    },
  },
};

export const Info: Story = {
  args: {
    notification: createMockNotification({
      type: 'info',
      message: 'New attendance features are now available in the dashboard',
      icon: <InfoIcon />,
    }),
    onDismiss: () => console.log('Info banner dismissed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'An info banner notification with blue styling. Used for general information and updates.',
      },
    },
  },
};

// With Actions
export const WithSingleAction: Story = {
  args: {
    notification: createMockNotification({
      type: 'warning',
      message: 'Your session will expire soon',
      icon: <WarningIcon />,
      actions: [
        { label: 'Extend Session', onClick: () => console.log('Session extended') },
      ],
    }),
    onDismiss: () => console.log('Single action banner dismissed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'A banner with a single action button. Actions are displayed prominently in the banner.',
      },
    },
  },
};

export const WithMultipleActions: Story = {
  args: {
    notification: createMockNotification({
      type: 'info',
      message: 'App update available with new features and bug fixes',
      icon: <InfoIcon />,
      actions: [
        { label: 'Update Now', onClick: () => console.log('Update started') },
        { label: 'View Changes', onClick: () => console.log('Changelog opened') },
        { label: 'Later', onClick: () => console.log('Update postponed') },
      ],
    }),
    onDismiss: () => console.log('Multi-action banner dismissed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'A banner with multiple action buttons for complex user choices.',
      },
    },
  },
};

// Dismissible vs Persistent
export const Dismissible: Story = {
  args: {
    notification: createMockNotification({
      type: 'success',
      message: 'Event registration completed successfully',
      icon: <SuccessIcon />,
      persistent: false,
    }),
    onDismiss: () => console.log('Dismissible banner dismissed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'A dismissible banner with a close button. User can manually dismiss the notification.',
      },
    },
  },
};

export const Persistent: Story = {
  args: {
    notification: createMockNotification({
      type: 'error',
      message: 'Critical system error - contact administrator',
      icon: <ErrorIcon />,
      persistent: true,
      actions: [
        { label: 'Contact Support', onClick: () => console.log('Support contacted') },
      ],
    }),
  },
  parameters: {
    docs: {
      description: {
        story: 'A persistent banner without dismiss button. Remains visible until resolved programmatically.',
      },
    },
  },
};

// Special Content
export const NoIcon: Story = {
  args: {
    notification: createMockNotification({
      type: 'info',
      message: 'Simple banner message without icon for minimal design',
      icon: null,
    }),
    onDismiss: () => console.log('No icon banner dismissed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'A banner without an icon for cleaner, text-focused notifications.',
      },
    },
  },
};

export const CustomIcon: Story = {
  args: {
    notification: createMockNotification({
      type: 'custom',
      message: 'Special announcement with custom icon',
      icon: <span style={{ fontSize: '24px', marginRight: '8px' }}>📢</span>,
    }),
    onDismiss: () => console.log('Custom icon banner dismissed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'A banner with a custom icon (emoji or custom component) for unique messaging.',
      },
    },
  },
};

export const LongMessage: Story = {
  args: {
    notification: createMockNotification({
      type: 'warning',
      message: 'This is a longer banner message that demonstrates how the banner component handles more extensive text content and maintains proper layout and readability even with multiple lines of text.',
      icon: <WarningIcon />,
    }),
    onDismiss: () => console.log('Long message banner dismissed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'A banner with a longer message showing text wrapping and layout behavior.',
      },
    },
  },
};

// Scout-themed content
export const ScoutAnnouncement: Story = {
  args: {
    notification: createMockNotification({
      type: 'info',
      message: 'Next Scout meeting: Saturday 2 PM at the Village Hall',
      icon: <span style={{ fontSize: '24px', marginRight: '8px' }}>⚜️</span>,
      actions: [
        { label: 'Add to Calendar', onClick: () => console.log('Added to calendar') },
        { label: 'Get Directions', onClick: () => console.log('Directions opened') },
      ],
    }),
    onDismiss: () => console.log('Scout announcement dismissed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'A Scout-themed banner announcement with meeting information and helpful actions.',
      },
    },
  },
};

export const ScoutAchievement: Story = {
  args: {
    notification: createMockNotification({
      type: 'success',
      message: 'Congratulations! You\'ve earned the Digital Maker Activity Badge',
      icon: <span style={{ fontSize: '24px', marginRight: '8px' }}>🏆</span>,
      actions: [
        { label: 'View Badge', onClick: () => console.log('Badge details opened') },
        { label: 'Share Achievement', onClick: () => console.log('Achievement shared') },
      ],
    }),
    onDismiss: () => console.log('Scout achievement dismissed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'A Scout achievement banner celebrating badge completion with action options.',
      },
    },
  },
};

// System Status
export const OfflineMode: Story = {
  args: {
    notification: createMockNotification({
      type: 'warning',
      message: 'Working in offline mode - changes will sync when connection is restored',
      icon: <span style={{ fontSize: '20px', marginRight: '8px' }}>📶</span>,
      actions: [
        { label: 'Retry Connection', onClick: () => console.log('Connection retry') },
      ],
    }),
  },
  parameters: {
    docs: {
      description: {
        story: 'System status banner indicating offline mode with connection retry option.',
      },
    },
  },
};

export const MaintenanceMode: Story = {
  args: {
    notification: createMockNotification({
      type: 'info',
      message: 'System maintenance in progress - some features may be temporarily unavailable',
      icon: <span style={{ fontSize: '20px', marginRight: '8px' }}>🔧</span>,
      persistent: true,
    }),
  },
  parameters: {
    docs: {
      description: {
        story: 'Maintenance mode banner that persists to inform users of ongoing system updates.',
      },
    },
  },
};