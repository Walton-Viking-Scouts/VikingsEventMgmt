import type { Meta, StoryObj } from '@storybook/react';
import React, { useState, useRef, useEffect } from 'react';
import { NotificationProvider, useNotification } from '../contexts/notifications/NotificationContext';
import { useNotificationUtils } from '../contexts/notifications/notificationUtils';
import ToastContainer from '../components/notifications/ToastContainer';
import BannerContainer from '../components/notifications/BannerContainer';
import { Button } from '../components/ui';

// Accessibility demonstration component
const AccessibilityDemo = () => {
  const { notifications, removeAll } = useNotification();
  const { toast, banner } = useNotificationUtils();
  const [screenReaderText, setScreenReaderText] = useState('');
  const [focusedElement, setFocusedElement] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Screen reader simulation
  useEffect(() => {
    const latestNotification = notifications[notifications.length - 1];
    if (latestNotification) {
      setScreenReaderText(`${latestNotification.type} notification: ${latestNotification.message}`);
    }
  }, [notifications]);

  // Focus management demonstration
  const handleFocusDemo = () => {
    toast.info('Focus will return to this button after dismissal');
    setTimeout(() => {
      buttonRef.current?.focus();
      setFocusedElement('Button is focused');
    }, 100);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px' }}>
      {/* Accessibility Info Panel */}
      <div style={{ 
        marginBottom: '24px', 
        padding: '16px', 
        backgroundColor: '#f1f5f9',
        border: '1px solid #cbd5e1',
        borderRadius: '8px'
      }}>
        <h3 style={{ marginBottom: '12px', fontSize: '18px', fontWeight: 'bold' }}>
          🔍 Accessibility Features Demo
        </h3>
        <div style={{ fontSize: '14px', color: '#475569' }}>
          <p style={{ marginBottom: '8px' }}>
            <strong>Screen Reader Simulation:</strong> <span style={{ fontStyle: 'italic' }}>{screenReaderText || 'No recent announcements'}</span>
          </p>
          <p style={{ marginBottom: '8px' }}>
            <strong>Focus Status:</strong> <span style={{ fontStyle: 'italic' }}>{focusedElement || 'No focus changes'}</span>
          </p>
          <p style={{ marginBottom: '0' }}>
            <strong>Instructions:</strong> Use Tab key to navigate, Enter/Space to activate buttons, Escape to dismiss notifications
          </p>
        </div>
      </div>

      {/* Keyboard Navigation Demo */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>
          ⌨️ Keyboard Navigation
        </h4>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <Button 
            onClick={() => toast.success('Navigate with Tab key, dismiss with Escape')}
            onFocus={() => setFocusedElement('Success button focused')}
          >
            Keyboard Accessible Success
          </Button>
          <Button 
            onClick={() => toast.error('Error with keyboard navigation', {
              actions: [
                { label: 'Retry', onClick: () => console.log('Retry via keyboard') }
              ]
            })}
            onFocus={() => setFocusedElement('Error button focused')}
          >
            Error + Actions
          </Button>
          <Button 
            ref={buttonRef}
            onClick={handleFocusDemo}
            onFocus={() => setFocusedElement('Focus demo button focused')}
          >
            Focus Management Demo
          </Button>
        </div>
        <p style={{ fontSize: '12px', color: '#64748b' }}>
          💡 Try navigating with Tab, activating with Enter/Space, and dismissing with Escape
        </p>
      </div>

      {/* Screen Reader Support */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>
          🎧 Screen Reader Support
        </h4>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <Button 
            onClick={() => banner.info('Screen readers announce this as "info notification: Screen readers announce this message"')}
          >
            Screen Reader Test
          </Button>
          <Button 
            onClick={() => toast.warning('High priority announcement with role="alert"', {
              persistent: true
            })}
          >
            Alert Role Demo
          </Button>
          <Button 
            onClick={() => banner.success('Live region polite announcement', {
              actions: [
                { label: 'Accessible Action', onClick: () => console.log('Action announced') }
              ]
            })}
          >
            Live Region Demo
          </Button>
        </div>
        <p style={{ fontSize: '12px', color: '#64748b' }}>
          💡 Enable screen reader to hear ARIA announcements and navigation cues
        </p>
      </div>

      {/* High Contrast Support */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>
          🌗 High Contrast & Visual Accessibility
        </h4>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <Button onClick={() => toast.success('High contrast colors support')}>
            High Contrast Success
          </Button>
          <Button onClick={() => toast.error('Clear visual hierarchy')}>
            High Contrast Error
          </Button>
          <Button onClick={() => toast.warning('Icons + text for accessibility')}>
            Icon + Text Demo
          </Button>
        </div>
        <p style={{ fontSize: '12px', color: '#64748b' }}>
          💡 Enable high contrast mode in your OS to test visual accessibility
        </p>
      </div>

      {/* Motion Preferences */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>
          🎭 Animation & Motion Preferences
        </h4>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <Button onClick={() => toast.info('Respects prefers-reduced-motion settings')}>
            Motion Sensitive
          </Button>
          <Button onClick={() => {
            // Simulate multiple rapid notifications
            for(let i = 0; i < 3; i++) {
              setTimeout(() => toast.success(`Animation ${i + 1}`), i * 200);
            }
          }}>
            Multiple Animations
          </Button>
        </div>
        <p style={{ fontSize: '12px', color: '#64748b' }}>
          💡 Set prefers-reduced-motion in browser dev tools or OS settings to test
        </p>
      </div>

      {/* Clear All */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button variant="outline" onClick={removeAll}>
          Clear All Notifications
        </Button>
        <span style={{ fontSize: '12px', color: '#64748b' }}>
          Active notifications: {notifications.length}
        </span>
      </div>

      {/* Notification Display */}
      <div style={{ position: 'relative', marginTop: '24px', minHeight: '200px' }}>
        <BannerContainer maxBanners={3} position="top" />
        <ToastContainer maxToasts={4} position="bottom-right" />
        
        <div style={{ 
          padding: '40px', 
          textAlign: 'center', 
          color: '#64748b',
          border: '2px dashed #cbd5e1',
          borderRadius: '8px'
        }}>
          <p>Notifications will appear above and to the right</p>
          <p style={{ fontSize: '12px', marginTop: '8px' }}>
            All notifications support keyboard navigation and screen readers
          </p>
        </div>
      </div>
    </div>
  );
};

// Wrapper with NotificationProvider
const AccessibilityWrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationProvider>
    {children}
  </NotificationProvider>
);

const meta: Meta<typeof AccessibilityDemo> = {
  title: 'Notifications/Accessibility',
  component: AccessibilityDemo,
  decorators: [
    (Story) => (
      <AccessibilityWrapper>
        <Story />
      </AccessibilityWrapper>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
This demo showcases the comprehensive accessibility features built into the notification system.

**Accessibility Features:**

🎯 **WCAG 2.1 AA Compliance**
- Sufficient color contrast ratios (4.5:1 minimum)
- Non-color-dependent information (icons + text)
- Scalable text and UI elements

⌨️ **Keyboard Navigation**
- Full keyboard accessibility with Tab navigation
- Enter/Space key activation for all interactive elements
- Escape key dismissal for dismissible notifications
- Proper focus management and focus trapping

🎧 **Screen Reader Support**
- ARIA live regions for dynamic announcements
- Appropriate ARIA roles (alert, status, button)
- Descriptive labels and accessible names
- Context-aware announcements

🌗 **Visual Accessibility**
- High contrast mode support
- Icons paired with text for clarity
- Clear visual hierarchy and focus indicators
- Scalable design for zoom/magnification

🎭 **Motion & Animation**
- Respects prefers-reduced-motion setting
- Smooth but not distracting animations
- Optional animation disable for sensitivity

**Testing Instructions:**
1. Enable screen reader (VoiceOver on Mac, NVDA on Windows)
2. Navigate using only keyboard (Tab, Enter, Space, Escape)
3. Test with high contrast mode enabled
4. Set prefers-reduced-motion: reduce in browser dev tools
5. Test with zoom levels up to 200%
        `,
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const AccessibilityDemo: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Interactive demonstration of all accessibility features in the notification system.',
      },
    },
  },
};

// Individual accessibility feature stories
export const ScreenReaderSupport: Story = {
  render: () => {
    const ScreenReaderDemo = () => {
      const { toast, banner } = useNotificationUtils();
      
      return (
        <div style={{ padding: '20px' }}>
          <h3 style={{ marginBottom: '16px' }}>Screen Reader Announcements</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <Button onClick={() => toast.info('Polite announcement - doesn\'t interrupt')}>
              Polite Announcement
            </Button>
            <Button onClick={() => toast.error('Alert announcement - interrupts reading', {
              persistent: true
            })}>
              Alert Announcement
            </Button>
            <Button onClick={() => banner.success('Status update for screen readers')}>
              Status Update
            </Button>
          </div>
          <p style={{ fontSize: '14px', color: '#64748b' }}>
            Enable a screen reader to hear how different notification types are announced
          </p>
          
          <ToastContainer maxToasts={3} position="top-right" />
          <BannerContainer maxBanners={2} position="top" />
        </div>
      );
    };
    
    return (
      <NotificationProvider>
        <ScreenReaderDemo />
      </NotificationProvider>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates screen reader announcements with different ARIA live region politeness levels.',
      },
    },
  },
};

export const KeyboardNavigation: Story = {
  render: () => {
    const KeyboardDemo = () => {
      const { toast } = useNotificationUtils();
      const [focusedButton, setFocusedButton] = useState('');
      
      return (
        <div style={{ padding: '20px' }}>
          <h3 style={{ marginBottom: '16px' }}>Keyboard Navigation Test</h3>
          <div style={{ marginBottom: '16px', fontSize: '14px', color: '#64748b' }}>
            Currently focused: <strong>{focusedButton || 'None'}</strong>
          </div>
          <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <Button 
              onFocus={() => setFocusedButton('Action Required Button')}
              onClick={() => toast.warning('Use Tab to navigate, Enter to activate', {
                actions: [
                  { label: 'Acknowledge', onClick: () => console.log('Acknowledged via keyboard') }
                ]
              })}
            >
              Action Required
            </Button>
            <Button 
              onFocus={() => setFocusedButton('Dismissible Button')}
              onClick={() => toast.info('Press Escape to dismiss this notification')}
            >
              Dismissible Notification
            </Button>
            <Button 
              onFocus={() => setFocusedButton('Persistent Button')}
              onClick={() => toast.error('Persistent error - use actions to resolve', {
                persistent: true,
                actions: [
                  { label: 'Resolve', onClick: () => console.log('Resolved via keyboard') }
                ]
              })}
            >
              Persistent Error
            </Button>
          </div>
          <div style={{ marginTop: '16px', fontSize: '12px', color: '#64748b' }}>
            💡 Instructions: Tab to navigate, Enter/Space to activate, Escape to dismiss
          </div>
          
          <ToastContainer maxToasts={3} position="bottom-right" />
        </div>
      );
    };
    
    return (
      <NotificationProvider>
        <KeyboardDemo />
      </NotificationProvider>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Test keyboard navigation and interaction with notifications and action buttons.',
      },
    },
  },
};

export const HighContrastSupport: Story = {
  render: () => {
    const HighContrastDemo = () => {
      const { toast, banner } = useNotificationUtils();
      
      return (
        <div style={{ padding: '20px' }}>
          <h3 style={{ marginBottom: '16px' }}>High Contrast & Visual Accessibility</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <Button onClick={() => toast.success('✅ Success with clear visual indicators')}>
              Success (✅)
            </Button>
            <Button onClick={() => toast.error('❌ Error with clear visual indicators')}>
              Error (❌)
            </Button>
            <Button onClick={() => toast.warning('⚠️ Warning with clear visual indicators')}>
              Warning (⚠️)
            </Button>
            <Button onClick={() => toast.info('ℹ️ Info with clear visual indicators')}>
              Info (ℹ️)
            </Button>
          </div>
          <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
            <p style={{ fontSize: '14px', margin: '0' }}>
              <strong>High Contrast Testing:</strong> Enable high contrast mode in your operating system 
              (Windows: Alt+Left Shift+Print Screen, Mac: System Preferences → Accessibility → Display)
            </p>
          </div>
          
          <ToastContainer maxToasts={4} position="top-right" />
          <BannerContainer maxBanners={2} position="top" />
        </div>
      );
    };
    
    return (
      <NotificationProvider>
        <HighContrastDemo />
      </NotificationProvider>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Test high contrast mode support and visual accessibility features.',
      },
    },
  },
};