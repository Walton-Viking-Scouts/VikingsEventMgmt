import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { NotificationProvider, useNotification } from '../contexts/notifications/NotificationContext';
import { useNotificationUtils } from '../contexts/notifications/notificationUtils';
import ToastContainer from '../components/notifications/ToastContainer';
import BannerContainer from '../components/notifications/BannerContainer';
import { Button } from '../components/ui';

// Demo component that shows notification containers in action
const NotificationDemo = ({ maxToasts = 5, maxBanners = 3 }) => {
  const { notifications, removeAll } = useNotification();
  const { toast, banner } = useNotificationUtils();

  const toastNotifications = notifications.filter(n => !n.persistent);
  const bannerNotifications = notifications.filter(n => n.persistent);

  return (
    <div style={{ padding: '20px', minHeight: '600px', position: 'relative' }}>
      {/* Control Panel */}
      <div style={{ 
        marginBottom: '20px', 
        padding: '20px', 
        border: '1px solid #e2e8f0', 
        borderRadius: '8px',
        backgroundColor: '#f8fafc'
      }}>
        <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
          Notification System Demo
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          {/* Toast Controls */}
          <div>
            <h4 style={{ marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Toast Notifications</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => toast.success('Operation completed!')}
              >
                Success Toast
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => toast.error('Something went wrong')}
              >
                Error Toast
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => toast.warning('Warning message')}
              >
                Warning Toast
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => toast.info('Information available')}
              >
                Info Toast
              </Button>
            </div>
          </div>

          {/* Banner Controls */}
          <div>
            <h4 style={{ marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Banner Notifications</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => banner.success('Sync completed')}
              >
                Success Banner
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => banner.error('Connection failed')}
              >
                Error Banner
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => banner.warning('Maintenance scheduled')}
              >
                Warning Banner
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => banner.info('New features available')}
              >
                Info Banner
              </Button>
            </div>
          </div>

          {/* Advanced Controls */}
          <div>
            <h4 style={{ marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Advanced</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => toast.error('Error with action', {
                  actions: [
                    { label: 'Retry', onClick: () => console.log('Retry clicked') }
                  ]
                })}
              >
                Toast + Action
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => banner.warning('Session expiring', {
                  actions: [
                    { label: 'Extend', onClick: () => console.log('Extended') }
                  ]
                })}
              >
                Banner + Action
              </Button>
              <Button 
                size="sm" 
                variant="scout-red"
                onClick={removeAll}
              >
                Clear All
              </Button>
            </div>
          </div>
        </div>

        {/* Status Display */}
        <div style={{ 
          fontSize: '12px', 
          color: '#64748b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>Active: {toastNotifications.length} toasts, {bannerNotifications.length} banners</span>
          <span>Limits: {maxToasts} toasts max, {maxBanners} banners max</span>
        </div>
      </div>

      {/* Notification Display Area */}
      <div style={{ 
        border: '2px dashed #cbd5e1', 
        borderRadius: '8px', 
        minHeight: '400px',
        position: 'relative',
        backgroundColor: '#ffffff'
      }}>
        {/* Banner Container at top */}
        <BannerContainer maxBanners={maxBanners} position="top" />
        
        {/* Content area */}
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
          <h4 style={{ marginBottom: '8px' }}>Main Content Area</h4>
          <p>Banners appear above this content, toasts appear at corners</p>
          {notifications.length === 0 && (
            <p style={{ marginTop: '16px', fontStyle: 'italic' }}>
              Click the buttons above to see notifications in action
            </p>
          )}
        </div>
        
        {/* Toast Container at corner */}
        <ToastContainer maxToasts={maxToasts} position="bottom-right" />
      </div>
    </div>
  );
};

// Wrapper with NotificationProvider
const ContainerWrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationProvider>
    {children}
  </NotificationProvider>
);

const meta: Meta<typeof NotificationDemo> = {
  title: 'Notifications/Containers',
  component: NotificationDemo,
  decorators: [
    (Story) => (
      <ContainerWrapper>
        <Story />
      </ContainerWrapper>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
Notification containers manage the positioning and rendering of multiple notifications. This demo shows how ToastContainer and BannerContainer work together to create a complete notification system.

**Key Features:**
- **ToastContainer**: Manages toast notifications at screen corners
- **BannerContainer**: Manages banner notifications at top/bottom of content
- **Automatic Stacking**: Multiple notifications stack appropriately
- **Responsive Positioning**: Adapts to mobile and desktop layouts
- **Maximum Limits**: Prevents notification overflow
- **Animation Support**: Smooth enter/exit transitions

**Positioning:**
- **Mobile**: Toasts at bottom, banners at top
- **Desktop**: Toasts at top-right, banners at top
- **Customizable**: Position prop allows different placements
        `,
      },
    },
  },
  argTypes: {
    maxToasts: {
      control: { type: 'range', min: 1, max: 10 },
      description: 'Maximum number of toast notifications to show simultaneously',
    },
    maxBanners: {
      control: { type: 'range', min: 1, max: 5 },
      description: 'Maximum number of banner notifications to show simultaneously',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  args: {
    maxToasts: 5,
    maxBanners: 3,
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive demo of the notification container system. Click buttons to add notifications and see how they stack and position.',
      },
    },
  },
};

export const HighVolume: Story = {
  args: {
    maxToasts: 8,
    maxBanners: 5,
  },
  parameters: {
    docs: {
      description: {
        story: 'High-volume notification demo with increased limits to show how the system handles many simultaneous notifications.',
      },
    },
  },
};

export const Minimal: Story = {
  args: {
    maxToasts: 2,
    maxBanners: 1,
  },
  parameters: {
    docs: {
      description: {
        story: 'Minimal notification setup with lower limits for cleaner interfaces.',
      },
    },
  },
};

// Individual container stories
const ToastOnlyDemo = () => {
  const { toast } = useNotificationUtils();
  
  return (
    <div style={{ padding: '20px', minHeight: '400px', position: 'relative' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '12px' }}>Toast Container Only</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button size="sm" onClick={() => toast.success('Success!')}>Success</Button>
          <Button size="sm" onClick={() => toast.error('Error!')}>Error</Button>
          <Button size="sm" onClick={() => toast.warning('Warning!')}>Warning</Button>
          <Button size="sm" onClick={() => toast.info('Info!')}>Info</Button>
        </div>
      </div>
      
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', minHeight: '300px', position: 'relative' }}>
        <ToastContainer maxToasts={4} position="top-right" />
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          <p>Toast notifications will appear at the top-right corner</p>
        </div>
      </div>
    </div>
  );
};

export const ToastContainerOnly: Story = {
  render: () => <ToastOnlyDemo />,
  parameters: {
    docs: {
      description: {
        story: 'Demo showing only the ToastContainer for temporary notifications.',
      },
    },
  },
};

const BannerOnlyDemo = () => {
  const { banner } = useNotificationUtils();
  
  return (
    <div style={{ padding: '20px', minHeight: '400px', position: 'relative' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '12px' }}>Banner Container Only</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button size="sm" onClick={() => banner.success('Success banner')}>Success</Button>
          <Button size="sm" onClick={() => banner.error('Error banner')}>Error</Button>
          <Button size="sm" onClick={() => banner.warning('Warning banner')}>Warning</Button>
          <Button size="sm" onClick={() => banner.info('Info banner')}>Info</Button>
        </div>
      </div>
      
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', minHeight: '300px', position: 'relative' }}>
        <BannerContainer maxBanners={3} position="top" />
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          <p>Banner notifications will appear at the top of this content area</p>
        </div>
      </div>
    </div>
  );
};

export const BannerContainerOnly: Story = {
  render: () => <BannerOnlyDemo />,
  parameters: {
    docs: {
      description: {
        story: 'Demo showing only the BannerContainer for persistent notifications.',
      },
    },
  },
};