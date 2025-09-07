import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { NotificationProvider } from '../../../shared/contexts/notifications/NotificationContext';
import { useNotificationUtils } from '../contexts/notifications/notificationUtils';
import ToastContainer from '../components/notifications/ToastContainer';
import BannerContainer from '../components/notifications/BannerContainer';
import { Button } from '../components/ui';

// Responsive behavior demonstration component
const ResponsiveDemo = () => {
  const { toast, banner } = useNotificationUtils();

  const triggerMobileScenario = () => {
    banner.info('Mobile layout: Banners stack at top');
    setTimeout(() => {
      toast.success('Mobile layout: Toasts appear at bottom');
    }, 500);
    setTimeout(() => {
      toast.warning('Touch-optimized dismiss areas');
    }, 1000);
  };

  const triggerDesktopScenario = () => {
    toast.info('Desktop layout: Toasts at top-right corner');
    setTimeout(() => {
      banner.warning('Desktop layout: Banners span full width');
    }, 500);
    setTimeout(() => {
      toast.error('Hover interactions available');
    }, 1000);
  };

  const triggerTabletScenario = () => {
    banner.success('Tablet layout: Hybrid positioning');
    setTimeout(() => {
      toast.info('Optimized for both touch and mouse');
    }, 500);
  };

  return (
    <div style={{ padding: '20px', minHeight: '600px', position: 'relative' }}>
      {/* Viewport Information */}
      <div style={{ 
        marginBottom: '24px', 
        padding: '16px', 
        backgroundColor: '#f1f5f9',
        border: '1px solid #cbd5e1',
        borderRadius: '8px'
      }}>
        <h3 style={{ marginBottom: '12px', fontSize: '18px', fontWeight: 'bold' }}>
          📱 Responsive Behavior Demo
        </h3>
        <div style={{ fontSize: '14px', color: '#475569' }}>
          <p style={{ marginBottom: '8px' }}>
            <strong>Current Viewport:</strong> Switch between mobile, tablet, and desktop viewports using Storybook's viewport toolbar
          </p>
          <p style={{ marginBottom: '8px' }}>
            <strong>Mobile (≤768px):</strong> Toasts at bottom, banners at top, touch-optimized spacing
          </p>
          <p style={{ marginBottom: '8px' }}>
            <strong>Tablet (769-1024px):</strong> Hybrid layout with optimized positioning
          </p>
          <p style={{ marginBottom: '0' }}>
            <strong>Desktop (≥1025px):</strong> Toasts at corners, banners full-width, hover states
          </p>
        </div>
      </div>

      {/* Responsive Test Scenarios */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>
          🎯 Test Scenarios
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <Button onClick={triggerMobileScenario}>
            📱 Mobile Layout Test
          </Button>
          <Button onClick={triggerDesktopScenario}>
            🖥️ Desktop Layout Test
          </Button>
          <Button onClick={triggerTabletScenario}>
            📟 Tablet Layout Test
          </Button>
        </div>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
          💡 Use Storybook's viewport controls to see how notifications adapt to different screen sizes
        </p>
      </div>

      {/* Breakpoint Information */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>
          📐 Responsive Breakpoints
        </h4>
        <div style={{ display: 'grid', gap: '8px', fontSize: '14px' }}>
          <div style={{ padding: '8px', backgroundColor: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '4px' }}>
            <strong>Mobile (≤768px):</strong> Single column, bottom toasts, full-width banners, larger touch targets
          </div>
          <div style={{ padding: '8px', backgroundColor: '#dbeafe', border: '1px solid #60a5fa', borderRadius: '4px' }}>
            <strong>Tablet (769-1024px):</strong> Flexible layout, corner toasts, responsive banner width
          </div>
          <div style={{ padding: '8px', backgroundColor: '#dcfce7', border: '1px solid #4ade80', borderRadius: '4px' }}>
            <strong>Desktop (≥1025px):</strong> Corner positioning, hover states, compact layout, multiple columns
          </div>
        </div>
      </div>

      {/* Interactive Features by Viewport */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>
          🎮 Viewport-Specific Features
        </h4>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => toast.success('Touch dismiss: Swipe gesture support')}
          >
            Touch Gestures
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => toast.info('Hover: Desktop mouse interactions')}
          >
            Hover States  
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => banner.warning('Responsive: Adapts to viewport width')}
          >
            Auto-sizing
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => {
              // Simulate multiple notifications for stacking demo
              for(let i = 0; i < 4; i++) {
                setTimeout(() => {
                  toast.info(`Stacking demo ${i + 1}/4`);
                }, i * 300);
              }
            }}
          >
            Stacking Behavior
          </Button>
        </div>
      </div>

      {/* Safe Area Considerations */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>
          📱 Mobile Safe Area Handling
        </h4>
        <div style={{ marginBottom: '12px' }}>
          <Button 
            onClick={() => {
              toast.info('Safe area: Avoids notch/home indicator');
              banner.warning('Safe area: Respects status bar height');
            }}
          >
            Test Safe Area Positioning
          </Button>
        </div>
        <p style={{ fontSize: '12px', color: '#64748b' }}>
          💡 On mobile devices, notifications respect safe areas to avoid hardware interference
        </p>
      </div>

      {/* Notification Display Area */}
      <div style={{ 
        border: '2px dashed #cbd5e1', 
        borderRadius: '8px', 
        minHeight: '300px',
        position: 'relative',
        backgroundColor: '#ffffff',
        overflow: 'hidden'
      }}>
        <BannerContainer maxBanners={3} position="top" />
        
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
          <h4 style={{ marginBottom: '8px' }}>Responsive Content Area</h4>
          <p>Watch how notifications position themselves based on your viewport</p>
          <div style={{ marginTop: '16px', fontSize: '12px', opacity: 0.7 }}>
            <p>📱 Mobile: Notifications stack vertically for thumb navigation</p>
            <p>📟 Tablet: Optimized for both touch and mouse interaction</p>
            <p>🖥️ Desktop: Compact corner positioning with hover effects</p>
          </div>
        </div>
        
        <ToastContainer maxToasts={5} position="bottom-right" />
      </div>
    </div>
  );
};

// Wrapper with NotificationProvider
const ResponsiveWrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationProvider>
    {children}
  </NotificationProvider>
);

const meta: Meta<typeof ResponsiveDemo> = {
  title: 'Notifications/Responsive Behavior',
  component: ResponsiveDemo,
  decorators: [
    (Story) => (
      <ResponsiveWrapper>
        <Story />
      </ResponsiveWrapper>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
Demonstrates how the notification system adapts to different viewport sizes and devices, providing optimal user experience across mobile, tablet, and desktop platforms.

**Responsive Features:**

📱 **Mobile Optimization (≤768px)**
- Notifications positioned at bottom for thumb accessibility
- Full-width banners with touch-friendly spacing
- Larger tap targets and swipe-to-dismiss gestures
- Safe area awareness for devices with notches/home indicators

📟 **Tablet Layout (769-1024px)**
- Hybrid positioning optimized for both touch and mouse
- Flexible width banners that adapt to content
- Medium-sized interactive elements
- Portrait/landscape orientation support

🖥️ **Desktop Experience (≥1025px)**
- Corner-positioned toasts for non-intrusive display
- Hover states and mouse interaction feedback
- Compact layout maximizing content space
- Multiple notification stacks possible

**Adaptive Behaviors:**
- **Touch vs Mouse:** Different interaction patterns based on device capability
- **Screen Real Estate:** Notification sizing adapts to available space
- **Safe Areas:** Respects device-specific UI elements (status bar, notch, etc.)
- **Stacking Logic:** Smart positioning prevents UI blocking

**Testing Instructions:**
1. Use Storybook's viewport toolbar to switch between device sizes
2. Click the scenario buttons to trigger device-specific notification patterns
3. Observe how positioning, sizing, and interactions change
4. Test with mobile device simulator for touch gesture support
        `,
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const ResponsiveDemo: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Interactive demonstration of responsive notification behavior across different viewport sizes.',
      },
    },
  },
};

// Individual responsive stories
export const MobileLayout: Story = {
  parameters: {
    viewport: { defaultViewport: 'mobile' },
    docs: {
      description: {
        story: 'Mobile-optimized layout with bottom toasts and full-width banners.',
      },
    },
  },
};

export const TabletLayout: Story = {
  parameters: {
    viewport: { defaultViewport: 'tablet' },
    docs: {
      description: {
        story: 'Tablet layout balancing touch accessibility with screen space efficiency.',
      },
    },
  },
};

export const DesktopLayout: Story = {
  parameters: {
    viewport: { defaultViewport: 'desktop' },
    docs: {
      description: {
        story: 'Desktop layout with corner positioning and hover interactions.',
      },
    },
  },
};

// Edge case demonstrations
const EdgeCaseDemo = () => {
  const { toast, banner } = useNotificationUtils();

  return (
    <div style={{ padding: '20px' }}>
      <h3 style={{ marginBottom: '16px' }}>Edge Case Testing</h3>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Button onClick={() => {
          // Simulate very long content
          toast.error('This is an extremely long notification message that tests how the responsive system handles text wrapping and content overflow on smaller screens without breaking the layout or becoming unreadable');
        }}>
          Long Content Test
        </Button>
        <Button onClick={() => {
          // Rapid succession
          for(let i = 0; i < 8; i++) {
            setTimeout(() => toast.info(`Rapid ${i + 1}`), i * 100);
          }
        }}>
          Rapid Fire Test
        </Button>
        <Button onClick={() => {
          // Mixed notification types
          banner.error('Critical system error');
          toast.warning('Memory usage high');
          toast.info('Background sync completed');
          banner.success('All systems operational');
        }}>
          Mixed Types Test
        </Button>
      </div>
      
      <ToastContainer maxToasts={6} position="top-right" />
      <BannerContainer maxBanners={3} position="top" />
    </div>
  );
};

export const EdgeCases: Story = {
  render: () => <EdgeCaseDemo />,
  parameters: {
    docs: {
      description: {
        story: 'Testing edge cases like long content, rapid notifications, and mixed types across viewports.',
      },
    },
  },
};