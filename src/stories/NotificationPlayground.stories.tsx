import type { Meta, StoryObj } from '@storybook/react';
import React, { useState, useEffect } from 'react';
import { NotificationProvider, useNotification } from '../contexts/notifications/NotificationContext';
import { useNotificationUtils } from '../contexts/notifications/notificationUtils';
import ToastContainer from '../components/notifications/ToastContainer';
import BannerContainer from '../components/notifications/BannerContainer';
import { Button } from '../components/ui';

// Comprehensive notification playground component
const NotificationPlayground = () => {
  const { notifications, removeAll, removeNotification } = useNotification();
  const { toast, banner } = useNotificationUtils();
  
  // Configuration state
  const [config, setConfig] = useState({
    type: 'toast' as 'toast' | 'banner',
    variant: 'info' as 'success' | 'error' | 'warning' | 'info',
    duration: 5000,
    persistent: false,
    dismissible: true,
    withIcon: true,
    withActions: false,
    position: 'bottom-right' as 'top-right' | 'bottom-right' | 'top' | 'bottom',
    maxCount: 5,
    customMessage: '',
    actionLabel: 'Action',
    secondActionLabel: 'Cancel'
  });

  // Message templates
  const messageTemplates = {
    success: [
      'Operation completed successfully!',
      'Data saved successfully',
      'Member added to event',
      'Badge awarded: Digital Maker',
      'Sync completed - all data up to date'
    ],
    error: [
      'Something went wrong',
      'Failed to save changes',
      'Network connection lost',
      'Permission denied',
      'Invalid data format'
    ],
    warning: [
      'Please review your input',
      'Session expires in 5 minutes',
      'Limited connectivity detected',
      'Some features unavailable offline',
      'Maintenance window starting soon'
    ],
    info: [
      'New features available',
      'Background sync in progress',
      'System update available',
      'Welcome to Viking Event Management',
      'Tip: Use keyboard shortcuts for faster navigation'
    ]
  };

  // Preset configurations
  const presets = {
    'Basic Toast': { type: 'toast', variant: 'info', duration: 3000, persistent: false, withActions: false },
    'Success Banner': { type: 'banner', variant: 'success', persistent: true, withActions: true },
    'Error with Actions': { type: 'toast', variant: 'error', persistent: false, withActions: true, duration: 8000 },
    'Persistent Warning': { type: 'banner', variant: 'warning', persistent: true, withActions: true },
    'Quick Info': { type: 'toast', variant: 'info', duration: 2000, withActions: false },
    'System Alert': { type: 'banner', variant: 'error', persistent: true, withActions: true, dismissible: false }
  };

  // Generate a random message based on variant
  const getRandomMessage = (variant: string) => {
    const templates = messageTemplates[variant as keyof typeof messageTemplates];
    return templates[Math.floor(Math.random() * templates.length)];
  };

  // Create notification with current configuration
  const createNotification = () => {
    const message = config.customMessage || getRandomMessage(config.variant);
    const options: any = {
      duration: config.persistent ? undefined : config.duration,
      persistent: config.persistent,
      dismissible: config.dismissible,
      icon: config.withIcon,
    };

    if (config.withActions) {
      options.actions = [
        { 
          label: config.actionLabel, 
          onClick: () => toast.success(`${config.actionLabel} clicked!`) 
        }
      ];
      
      if (config.secondActionLabel) {
        options.actions.push({
          label: config.secondActionLabel,
          onClick: () => toast.info(`${config.secondActionLabel} clicked!`)
        });
      }
    }

    if (config.type === 'toast') {
      toast[config.variant](message, options);
    } else {
      banner[config.variant](message, options);
    }
  };

  // Bulk create notifications for testing
  const createBulkNotifications = (count: number) => {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const variants = ['success', 'error', 'warning', 'info'] as const;
        const variant = variants[i % variants.length];
        const message = `Bulk test ${i + 1}/${count}: ${getRandomMessage(variant)}`;
        
        if (config.type === 'toast') {
          toast[variant](message, { duration: 6000 });
        } else {
          banner[variant](message);
        }
      }, i * 200);
    }
  };

  // Auto-demo mode
  const [autoDemoActive, setAutoDemoActive] = useState(false);
  
  useEffect(() => {
    if (!autoDemoActive) return;
    
    const interval = setInterval(() => {
      const variants = ['success', 'error', 'warning', 'info'] as const;
      const types = ['toast', 'banner'] as const;
      const variant = variants[Math.floor(Math.random() * variants.length)];
      const type = types[Math.floor(Math.random() * types.length)];
      const message = `Auto-demo: ${getRandomMessage(variant)}`;
      
      if (type === 'toast') {
        toast[variant](message, { duration: 4000 });
      } else {
        banner[variant](message, { persistent: Math.random() > 0.5 });
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [autoDemoActive, toast, banner]);

  return (
    <div style={{ padding: '20px', minHeight: '800px', position: 'relative' }}>
      {/* Header */}
      <div style={{ 
        marginBottom: '24px', 
        padding: '20px', 
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px'
      }}>
        <h2 style={{ marginBottom: '8px', fontSize: '24px', fontWeight: 'bold' }}>
          🎮 Notification Playground
        </h2>
        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '12px' }}>
          Interactive testing environment for the notification system. Configure, create, and test notifications with real-time feedback.
        </p>
        <div style={{ fontSize: '12px', color: '#475569' }}>
          <strong>Active:</strong> {notifications.length} notifications 
          ({notifications.filter(n => n.persistent).length} persistent, {notifications.filter(n => !n.persistent).length} temporary)
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Configuration Panel */}
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px'
        }}>
          <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>
            ⚙️ Configuration
          </h3>
          
          {/* Basic Settings */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '600' }}>
              Notification Type
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button 
                size="sm" 
                variant={config.type === 'toast' ? 'scout-blue' : 'outline'}
                onClick={() => setConfig(prev => ({ ...prev, type: 'toast' }))}
              >
                Toast
              </Button>
              <Button 
                size="sm" 
                variant={config.type === 'banner' ? 'scout-blue' : 'outline'}
                onClick={() => setConfig(prev => ({ ...prev, type: 'banner' }))}
              >
                Banner
              </Button>
            </div>
          </div>

          {/* Variant Selection */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '600' }}>
              Variant
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              {['success', 'error', 'warning', 'info'].map(variant => (
                <Button 
                  key={variant}
                  size="sm" 
                  variant={config.variant === variant ? 'scout-blue' : 'outline'}
                  onClick={() => setConfig(prev => ({ ...prev, variant: variant as any }))}
                >
                  {variant.charAt(0).toUpperCase() + variant.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {/* Duration Settings */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '600' }}>
              Duration (ms)
            </label>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {[2000, 3000, 5000, 8000, 'Persistent'].map(duration => (
                <Button 
                  key={duration}
                  size="sm" 
                  variant={
                    (duration === 'Persistent' && config.persistent) || 
                    (duration !== 'Persistent' && config.duration === duration && !config.persistent) 
                      ? 'scout-blue' : 'outline'
                  }
                  onClick={() => {
                    if (duration === 'Persistent') {
                      setConfig(prev => ({ ...prev, persistent: true }));
                    } else {
                      setConfig(prev => ({ ...prev, duration: duration as number, persistent: false }));
                    }
                  }}
                >
                  {duration}
                </Button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: '600' }}>
              Options
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <input 
                  type="checkbox" 
                  checked={config.dismissible}
                  onChange={e => setConfig(prev => ({ ...prev, dismissible: e.target.checked }))}
                />
                Dismissible
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <input 
                  type="checkbox" 
                  checked={config.withIcon}
                  onChange={e => setConfig(prev => ({ ...prev, withIcon: e.target.checked }))}
                />
                Show Icon
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <input 
                  type="checkbox" 
                  checked={config.withActions}
                  onChange={e => setConfig(prev => ({ ...prev, withActions: e.target.checked }))}
                />
                Include Actions
              </label>
            </div>
          </div>

          {/* Custom Message */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '600' }}>
              Custom Message (optional)
            </label>
            <textarea 
              value={config.customMessage}
              onChange={e => setConfig(prev => ({ ...prev, customMessage: e.target.value }))}
              placeholder="Leave empty for random message"
              style={{ 
                width: '100%', 
                minHeight: '60px', 
                padding: '8px', 
                border: '1px solid #d1d5db', 
                borderRadius: '4px',
                fontSize: '12px',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Action Labels */}
          {config.withActions && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '600' }}>
                Action Button Labels
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text"
                  value={config.actionLabel}
                  onChange={e => setConfig(prev => ({ ...prev, actionLabel: e.target.value }))}
                  placeholder="Action"
                  style={{ flex: 1, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }}
                />
                <input 
                  type="text"
                  value={config.secondActionLabel}
                  onChange={e => setConfig(prev => ({ ...prev, secondActionLabel: e.target.value }))}
                  placeholder="Cancel"
                  style={{ flex: 1, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Controls Panel */}
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px'
        }}>
          <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>
            🎛️ Controls
          </h3>

          {/* Main Actions */}
          <div style={{ marginBottom: '20px' }}>
            <Button 
              onClick={createNotification}
              style={{ width: '100%', marginBottom: '8px' }}
            >
              Create Notification
            </Button>
            <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center' }}>
              Creates a {config.type} notification with current settings
            </div>
          </div>

          {/* Quick Presets */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Quick Presets</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              {Object.entries(presets).map(([name, preset]) => (
                <Button 
                  key={name}
                  size="sm" 
                  variant="outline"
                  onClick={() => setConfig(prev => ({ ...prev, ...preset }))}
                >
                  {name}
                </Button>
              ))}
            </div>
          </div>

          {/* Bulk Testing */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Bulk Testing</h4>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <Button size="sm" variant="outline" onClick={() => createBulkNotifications(3)}>
                3 Random
              </Button>
              <Button size="sm" variant="outline" onClick={() => createBulkNotifications(5)}>
                5 Random
              </Button>
              <Button size="sm" variant="outline" onClick={() => createBulkNotifications(10)}>
                10 Random
              </Button>
            </div>
          </div>

          {/* Auto Demo */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Auto Demo</h4>
            <Button 
              size="sm" 
              variant={autoDemoActive ? 'scout-red' : 'scout-green'}
              onClick={() => setAutoDemoActive(!autoDemoActive)}
              style={{ width: '100%' }}
            >
              {autoDemoActive ? 'Stop Auto Demo' : 'Start Auto Demo'}
            </Button>
            <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', marginTop: '4px' }}>
              {autoDemoActive ? 'Creating random notifications every 2s' : 'Creates notifications automatically'}
            </div>
          </div>

          {/* Management */}
          <div>
            <h4 style={{ marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Management</h4>
            <div style={{ display: 'flex', gap: '4px' }}>
              <Button 
                size="sm" 
                variant="outline"
                onClick={removeAll}
                disabled={notifications.length === 0}
              >
                Clear All
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  notifications.filter(n => n.persistent).forEach(n => removeNotification(n.id));
                }}
                disabled={notifications.filter(n => n.persistent).length === 0}
              >
                Clear Persistent
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Current Configuration Display */}
      <div style={{ 
        marginBottom: '24px', 
        padding: '12px', 
        backgroundColor: '#f1f5f9',
        border: '1px solid #cbd5e1',
        borderRadius: '6px',
        fontSize: '12px'
      }}>
        <strong>Current Config:</strong> {config.type} | {config.variant} | {config.persistent ? 'persistent' : `${config.duration}ms`} | 
        {config.dismissible ? 'dismissible' : 'not-dismissible'} | {config.withIcon ? 'with-icon' : 'no-icon'} | 
        {config.withActions ? `actions: "${config.actionLabel}", "${config.secondActionLabel}"` : 'no-actions'}
      </div>

      {/* Active Notifications List */}
      {notifications.length > 0 && (
        <div style={{ 
          marginBottom: '24px', 
          padding: '16px', 
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px'
        }}>
          <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '600' }}>
            📋 Active Notifications ({notifications.length})
          </h4>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {notifications.map(notification => (
              <div 
                key={notification.id}
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '8px', 
                  marginBottom: '4px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  fontSize: '12px'
                }}
              >
                <span>
                  <strong>{notification.type}</strong> - {notification.message.slice(0, 50)}
                  {notification.message.length > 50 ? '...' : ''}
                  {notification.persistent && <span style={{ color: '#7c2d12' }}> (persistent)</span>}
                </span>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => removeNotification(notification.id)}
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Display Area */}
      <div style={{ 
        border: '2px dashed #cbd5e1', 
        borderRadius: '8px', 
        minHeight: '400px',
        position: 'relative',
        backgroundColor: '#ffffff',
        overflow: 'hidden'
      }}>
        <BannerContainer maxBanners={config.maxCount} position="top" />
        
        <div style={{ padding: '80px 40px', textAlign: 'center', color: '#64748b' }}>
          <h4 style={{ marginBottom: '8px' }}>Notification Display Area</h4>
          <p>Configure and create notifications to see them appear here</p>
          
          {notifications.length === 0 && (
            <div style={{ marginTop: '32px' }}>
              <p style={{ fontSize: '14px', marginBottom: '16px' }}>🎮 Get started:</p>
              <div style={{ fontSize: '12px', textAlign: 'left', maxWidth: '300px', margin: '0 auto' }}>
                <p>1. Choose notification type (Toast/Banner)</p>
                <p>2. Select variant (Success/Error/Warning/Info)</p>
                <p>3. Configure duration and options</p>
                <p>4. Click "Create Notification"</p>
                <p>5. Or try a quick preset!</p>
              </div>
            </div>
          )}
        </div>
        
        <ToastContainer maxToasts={config.maxCount} position={config.position as any} />
      </div>

      {/* Tips */}
      <div style={{ 
        marginTop: '24px', 
        padding: '12px', 
        backgroundColor: '#fef3c7',
        border: '1px solid #f59e0b',
        borderRadius: '6px',
        fontSize: '12px'
      }}>
        <strong>💡 Tips:</strong> Use presets for common patterns | Auto demo shows realistic usage | 
        Test with different durations | Try bulk testing for performance | 
        Persistent notifications stay until dismissed | Actions trigger callback functions
      </div>
    </div>
  );
};

// Wrapper with NotificationProvider
const PlaygroundWrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationProvider>
    {children}
  </NotificationProvider>
);

const meta: Meta<typeof NotificationPlayground> = {
  title: 'Notifications/Playground',
  component: NotificationPlayground,
  decorators: [
    (Story) => (
      <PlaygroundWrapper>
        <Story />
      </PlaygroundWrapper>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
Interactive testing environment for the Viking Event Management notification system. This comprehensive playground allows developers and designers to experiment with all notification features, configurations, and behaviors in real-time.

**Playground Features:**

🎮 **Interactive Configuration**
- Real-time notification type switching (Toast/Banner)
- All notification variants (Success/Error/Warning/Info)
- Duration controls from 2s to persistent
- Toggle dismissible behavior, icons, and actions
- Custom message input with template fallbacks

⚙️ **Advanced Controls**
- Quick preset configurations for common patterns
- Bulk testing with 3, 5, or 10 random notifications
- Auto-demo mode for continuous testing
- Individual notification management and removal

📊 **Real-time Feedback**
- Active notification counter and type breakdown
- Current configuration display
- Live notification list with individual controls
- Performance monitoring for bulk operations

🎯 **Testing Scenarios**
- **Preset Testing:** Common patterns like "Success Banner", "Error with Actions"
- **Bulk Testing:** Performance testing with multiple rapid notifications
- **Auto Demo:** Continuous random notifications for extended testing
- **Custom Scenarios:** Full control over all notification parameters

**Use Cases:**

👨‍💻 **For Developers:**
- Test API integration patterns
- Verify notification behavior during development
- Performance testing with bulk operations
- Debug timing and persistence issues

🎨 **For Designers:**
- Preview all visual variants and combinations
- Test responsive behavior and positioning
- Verify accessibility and interaction patterns
- Validate animation and transition timing

🧪 **For QA Testing:**
- Systematic testing of all notification features
- Edge case validation (long messages, rapid creation)
- Accessibility testing with keyboard navigation
- Cross-browser and device compatibility testing

**Configuration Options:**
- **Type:** Toast (corner notifications) vs Banner (full-width)
- **Variant:** Success, Error, Warning, Info with appropriate styling
- **Duration:** 2s, 3s, 5s, 8s, or Persistent (manual dismissal)
- **Options:** Dismissible, Icons, Action buttons
- **Actions:** Custom button labels with callback functions
- **Positioning:** Different container positions for toasts

This playground serves as both a development tool and a comprehensive demonstration of the notification system's capabilities.
        `,
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const InteractivePlayground: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Full-featured interactive playground for testing all notification system capabilities.',
      },
    },
  },
};