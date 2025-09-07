import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import AlertAdapter, { AlertTitle, AlertDescription, AlertActions } from '../components/ui/AlertAdapter';
import { Button } from '../components/ui';
import { NotificationProvider } from '../../../shared/contexts/notifications/NotificationContext';

// Wrapper component to provide notification context
const AlertWrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationProvider>
    <div style={{ padding: '20px', maxWidth: '800px' }}>
      {children}
    </div>
  </NotificationProvider>
);

const meta: Meta<typeof AlertAdapter> = {
  title: 'Migration/AlertAdapter',
  component: AlertAdapter,
  decorators: [
    (Story) => (
      <AlertWrapper>
        <Story />
      </AlertWrapper>
    ),
  ],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
AlertAdapter is a drop-in replacement for the legacy Alert component that bridges old Alert patterns with the new notification system.

**Key Features:**
- Maintains exact same API as legacy Alert component
- Compound components: AlertAdapter.Title, AlertAdapter.Description, AlertAdapter.Actions
- Supports all legacy variant names including Scout-themed variants
- Automatically converts to appropriate notification types (Toast or Banner)
- Full backward compatibility with existing code

**Migration is as simple as changing the import:**
\`\`\`tsx
// Before
import { Alert } from './ui';

// After
import { AlertAdapter } from '../adapters';
\`\`\`
        `,
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['success', 'error', 'warning', 'info', 'scout-blue', 'scout-green', 'scout-red', 'scout-orange', 'neutral', 'dark'],
      description: 'The alert variant - supports legacy Alert variants including Scout themes',
    },
    dismissible: {
      control: 'boolean',
      description: 'Whether the alert can be dismissed by the user',
    },
    useToast: {
      control: 'boolean',
      description: 'Use Toast rendering instead of Banner (useful for temporary feedback)',
    },
    persistent: {
      control: 'boolean',
      description: 'Override auto-dismiss behavior (for critical alerts)',
    },
    icon: {
      control: 'boolean',
      description: 'Whether to show the default icon for the variant',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Basic Alert Patterns
export const Success: Story = {
  args: {
    variant: 'success',
    children: 'Operation completed successfully!',
  },
  parameters: {
    docs: {
      description: {
        story: 'A simple success alert - equivalent to the legacy Alert success pattern.',
      },
    },
  },
};

export const Error: Story = {
  args: {
    variant: 'error',
    children: 'An error occurred while processing your request.',
  },
  parameters: {
    docs: {
      description: {
        story: 'A simple error alert. Note: variant="danger" is automatically converted to variant="error".',
      },
    },
  },
};

export const Warning: Story = {
  args: {
    variant: 'warning',
    children: 'Please review your input before submitting.',
  },
  parameters: {
    docs: {
      description: {
        story: 'A warning alert for user attention.',
      },
    },
  },
};

export const Info: Story = {
  args: {
    variant: 'info',
    children: 'Additional information is available in the help section.',
  },
  parameters: {
    docs: {
      description: {
        story: 'An info alert for general information.',
      },
    },
  },
};

// Compound Component Patterns
export const WithTitle: Story = {
  args: {
    variant: 'warning',
    children: (
      <>
        <AlertTitle>Session Expiring</AlertTitle>
        <AlertDescription>
          Your session will expire in 5 minutes. Please save your work.
        </AlertDescription>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Alert with title and description using compound components - maintains exact legacy API.',
      },
    },
  },
};

export const WithActions: Story = {
  args: {
    variant: 'error',
    children: (
      <>
        <AlertTitle>Connection Failed</AlertTitle>
        <AlertDescription>
          Unable to connect to the server. Please check your internet connection.
        </AlertDescription>
        <AlertActions>
          <Button variant="scout-blue" size="sm" onClick={() => console.log('Retry clicked')}>
            Retry
          </Button>
          <Button variant="outline" size="sm" onClick={() => console.log('Go offline clicked')}>
            Go Offline
          </Button>
        </AlertActions>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Alert with title, description, and action buttons - complete legacy Alert replacement.',
      },
    },
  },
};

export const FormValidation: Story = {
  args: {
    variant: 'error',
    dismissible: true,
    useToast: true,
    children: (
      <>
        <AlertTitle>Validation Error</AlertTitle>
        <AlertDescription>
          Please fix the following errors before submitting the form.
        </AlertDescription>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Form validation error using toast mode - temporary feedback that can be dismissed.',
      },
    },
  },
};

// Scout-themed variants
export const ScoutBlue: Story = {
  args: {
    variant: 'scout-blue',
    children: (
      <>
        <AlertTitle>Scout Information</AlertTitle>
        <AlertDescription>
          Next meeting is scheduled for Saturday at 2 PM.
        </AlertDescription>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Scout-themed blue variant for general Scout information.',
      },
    },
  },
};

export const ScoutGreen: Story = {
  args: {
    variant: 'scout-green',
    children: (
      <>
        <AlertTitle>Badge Completed!</AlertTitle>
        <AlertDescription>
          Congratulations! You have earned the Digital Maker Activity Badge.
        </AlertDescription>
        <AlertActions>
          <Button variant="scout-blue" size="sm" onClick={() => console.log('View badge clicked')}>
            View Badge
          </Button>
        </AlertActions>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Scout-themed green variant for achievements and success messages.',
      },
    },
  },
};

export const ScoutRed: Story = {
  args: {
    variant: 'scout-red',
    children: (
      <>
        <AlertTitle>Important Notice</AlertTitle>
        <AlertDescription>
          Meeting location has been changed to the Village Hall.
        </AlertDescription>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Scout-themed red variant for important notices and alerts.',
      },
    },
  },
};

export const ScoutOrange: Story = {
  args: {
    variant: 'scout-orange',
    children: (
      <>
        <AlertTitle>Weather Warning</AlertTitle>
        <AlertDescription>
          Outdoor activities may be cancelled due to weather conditions.
        </AlertDescription>
        <AlertActions>
          <Button variant="outline" size="sm" onClick={() => console.log('Check weather clicked')}>
            Check Weather
          </Button>
        </AlertActions>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Scout-themed orange variant for warnings and cautions.',
      },
    },
  },
};

// Migration Examples
export const BeforeAfterExample: Story = {
  parameters: {
    docs: {
      description: {
        story: `
**Migration Example - Before and After:**

\`\`\`tsx
// BEFORE - Legacy Alert
import { Alert } from './ui';

<Alert variant="danger" dismissible onDismiss={handleDismiss}>
  <Alert.Title>Error Loading Data</Alert.Title>
  <Alert.Description>Unable to fetch user information</Alert.Description>
  <Alert.Actions>
    <Button onClick={retry}>Retry</Button>
    <Button onClick={goOffline}>Go Offline</Button>
  </Alert.Actions>
</Alert>

// AFTER - AlertAdapter (drop-in replacement)
import { AlertAdapter } from '../adapters';

<AlertAdapter variant="error" dismissible onDismiss={handleDismiss}>
  <AlertAdapter.Title>Error Loading Data</AlertAdapter.Title>
  <AlertAdapter.Description>Unable to fetch user information</AlertAdapter.Description>
  <AlertAdapter.Actions>
    <Button onClick={retry}>Retry</Button>
    <Button onClick={goOffline}>Go Offline</Button>
  </AlertAdapter.Actions>
</AlertAdapter>
\`\`\`

**Key Changes:**
1. Change import from \`Alert\` to \`AlertAdapter\`
2. Change \`variant="danger"\` to \`variant="error"\` (automatic conversion)
3. Change compound components: \`Alert.Title\` → \`AlertAdapter.Title\`
4. Everything else remains exactly the same!
        `,
      },
    },
  },
  render: () => (
    <div style={{ space: '20px 0' }}>
      <h3 style={{ marginBottom: '10px' }}>Current Implementation (AlertAdapter):</h3>
      <AlertAdapter variant="error" dismissible>
        <AlertTitle>Error Loading Data</AlertTitle>
        <AlertDescription>Unable to fetch user information</AlertDescription>
        <AlertActions>
          <Button variant="scout-blue" size="sm" onClick={() => console.log('Retry clicked')}>
            Retry
          </Button>
          <Button variant="outline" size="sm" onClick={() => console.log('Go offline clicked')}>
            Go Offline
          </Button>
        </AlertActions>
      </AlertAdapter>
    </div>
  ),
};

// Advanced Usage
export const PersistentCritical: Story = {
  args: {
    variant: 'error',
    persistent: true,
    children: (
      <>
        <AlertTitle>Critical System Error</AlertTitle>
        <AlertDescription>
          A critical error has occurred. Please contact system administrator immediately.
        </AlertDescription>
        <AlertActions>
          <Button variant="scout-red" size="sm" onClick={() => console.log('Contact support clicked')}>
            Contact Support
          </Button>
        </AlertActions>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Persistent critical alert that won\'t auto-dismiss - requires manual intervention.',
      },
    },
  },
};

export const ToastMode: Story = {
  args: {
    variant: 'success',
    useToast: true,
    dismissible: true,
    children: 'Form submitted successfully!',
  },
  parameters: {
    docs: {
      description: {
        story: 'Using toast mode for temporary success feedback instead of banner mode.',
      },
    },
  },
};

export const NoIcon: Story = {
  args: {
    variant: 'info',
    icon: false,
    children: (
      <>
        <AlertTitle>Text Only Alert</AlertTitle>
        <AlertDescription>
          This alert doesn't show an icon for a cleaner, text-focused design.
        </AlertDescription>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Alert without icon for minimal, text-focused notifications.',
      },
    },
  },
};