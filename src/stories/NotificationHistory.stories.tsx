import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { NotificationProvider } from '../contexts/notifications/NotificationContext';
import { useNotificationUtils } from '../contexts/notifications/notificationUtils';
import NotificationButton, { CompactNotificationButton, MobileNotificationButton } from '../components/notifications/NotificationButton';
import ToastContainer from '../components/notifications/ToastContainer';
import BannerContainer from '../components/notifications/BannerContainer';
import { Button } from '../components/ui';

// Demo component showing the notification history system in action
const NotificationHistoryDemo = () => {
  const { toast, banner } = useNotificationUtils();
  const [demoScenario, setDemoScenario] = useState<string>('');

  // Simulate Scout Leader Dashboard scenarios
  const simulateScoutLeaderWorkflow = () => {
    setDemoScenario('Scout Leader managing events and members');
    
    // Event creation workflow
    setTimeout(() => {
      banner.info('Creating new summer camp event...', { persistent: true });
    }, 500);

    setTimeout(() => {
      toast.success('Event "Summer Camp 2024" created successfully!', {
        actions: [
          { label: 'View Event', onClick: () => console.log('View event') },
          { label: 'Add Activities', onClick: () => console.log('Add activities') }
        ]
      });
    }, 2000);

    // Member management
    setTimeout(() => {
      toast.warning('3 members missing emergency contact information', {
        actions: [
          { label: 'Send Reminders', onClick: () => console.log('Reminders sent') },
          { label: 'View List', onClick: () => console.log('View missing contacts') }
        ]
      });
    }, 3500);

    // Error scenario
    setTimeout(() => {
      toast.error('Failed to send email reminders to 2 parents', {
        actions: [
          { label: 'Retry', onClick: () => console.log('Retrying email send') },
          { label: 'Manual Contact', onClick: () => console.log('Manual contact needed') }
        ]
      });
    }, 5000);
  };

  const simulateParentWorkflow = () => {
    setDemoScenario('Parent receiving updates and completing forms');
    
    setTimeout(() => {
      banner.success('Registration confirmed for Jake Smith');
    }, 500);

    setTimeout(() => {
      toast.warning('Medical form expires in 7 days', {
        actions: [
          { label: 'Renew Now', onClick: () => console.log('Renew medical form') }
        ]
      });
    }, 2000);

    setTimeout(() => {
      toast.info('New activity badge available: Digital Maker', {
        actions: [
          { label: 'Learn More', onClick: () => console.log('Badge details') }
        ]
      });
    }, 3500);
  };

  const simulateSystemNotifications = () => {
    setDemoScenario('System maintenance and status updates');
    
    setTimeout(() => {
      banner.warning('Scheduled maintenance: Sunday 2 AM - 4 AM', { persistent: true });
    }, 500);

    setTimeout(() => {
      toast.info('Data sync completed - 45 records updated');
    }, 2000);

    setTimeout(() => {
      toast.warning('Low storage space - consider archiving old events', {
        actions: [
          { label: 'Archive', onClick: () => console.log('Archive old events') },
          { label: 'Upgrade', onClick: () => console.log('Storage upgrade') }
        ]
      });
    }, 3500);

    setTimeout(() => {
      toast.error('Background sync failed - working offline', {
        persistent: true,
        actions: [
          { label: 'Retry', onClick: () => console.log('Retry sync') },
          { label: 'Check Connection', onClick: () => console.log('Network check') }
        ]
      });
    }, 5000);
  };

  const simulateHighVolumeDay = () => {
    setDemoScenario('Busy event day with multiple notifications');
    
    const notifications = [
      { type: 'success', message: 'Check-in: Emma Johnson arrived', delay: 500 },
      { type: 'success', message: 'Check-in: Tom Wilson arrived', delay: 800 },
      { type: 'warning', message: 'Weather alert: Rain expected at 3 PM', delay: 1200 },
      { type: 'info', message: 'Activity rotation: Group A to archery', delay: 1800 },
      { type: 'error', message: 'First aid kit missing from Group B', delay: 2500 },
      { type: 'success', message: 'Badge completed: Sarah Connor - Navigator', delay: 3000 },
      { type: 'warning', message: 'Late arrival: Michael Brown (20 mins)', delay: 3500 },
      { type: 'info', message: 'Photo consent forms - 3 pending', delay: 4000 }
    ];

    notifications.forEach(({ type, message, delay }) => {
      setTimeout(() => {
        if (type === 'error' || (type === 'warning' && Math.random() > 0.5)) {
          toast[type as 'error' | 'warning'](message, {
            actions: [{ label: 'Handle', onClick: () => console.log(`Handling: ${message}`) }]
          });
        } else {
          toast[type as 'success' | 'info'](message);
        }
      }, delay);
    });
  };

  const clearAllNotifications = () => {
    setDemoScenario('');
    // Clear active notifications - history will remain
    window.location.reload(); // Simple way to reset for demo
  };

  return (
    <div style={{ padding: '20px', minHeight: '800px', position: 'relative' }}>
      {/* Header with Notification Button Integration */}
      <div style={{ 
        marginBottom: '32px',
        padding: '16px',
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h2 style={{ marginBottom: '8px', fontSize: '20px', fontWeight: 'bold' }}>
            🏕️ Viking Event Management - Dashboard
          </h2>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Notification History System Demo
          </p>
          {demoScenario && (
            <p style={{ fontSize: '12px', color: '#059669', fontWeight: '500', margin: '4px 0 0 0' }}>
              Scenario: {demoScenario}
            </p>
          )}
        </div>
        
        {/* Navigation with Notification Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>Scout Leader Dashboard</span>
          <NotificationButton />
        </div>
      </div>

      {/* Demo Scenarios */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>
          📋 Demo Scenarios
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
          <Button 
            variant="outline" 
            onClick={simulateScoutLeaderWorkflow}
          >
            🏕️ Scout Leader Workflow
          </Button>
          <Button 
            variant="outline" 
            onClick={simulateParentWorkflow}
          >
            👨‍👩‍👧‍👦 Parent Experience
          </Button>
          <Button 
            variant="outline" 
            onClick={simulateSystemNotifications}
          >
            🖥️ System Notifications
          </Button>
          <Button 
            variant="outline" 
            onClick={simulateHighVolumeDay}
          >
            📊 High Volume Day
          </Button>
          <Button 
            variant="scout-red" 
            onClick={clearAllNotifications}
          >
            🗑️ Reset Demo
          </Button>
        </div>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
          💡 Click scenarios above, then check the notification bell to see history
        </p>
      </div>

      {/* Different Button Variants */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>
          🔔 Notification Button Variants
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          {/* Standard Button */}
          <div style={{ 
            padding: '16px', 
            border: '1px solid #e2e8f0', 
            borderRadius: '8px',
            backgroundColor: '#ffffff',
            textAlign: 'center'
          }}>
            <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '600' }}>Standard</h4>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
              <NotificationButton />
            </div>
            <p style={{ fontSize: '11px', color: '#6b7280' }}>
              Default notification button for headers and navigation
            </p>
          </div>

          {/* Compact Button */}
          <div style={{ 
            padding: '16px', 
            border: '1px solid #e2e8f0', 
            borderRadius: '8px',
            backgroundColor: '#ffffff',
            textAlign: 'center'
          }}>
            <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '600' }}>Compact</h4>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
              <CompactNotificationButton />
            </div>
            <p style={{ fontSize: '11px', color: '#6b7280' }}>
              Button with text label for toolbars and forms
            </p>
          </div>

          {/* Mobile Button */}
          <div style={{ 
            padding: '16px', 
            border: '1px solid #e2e8f0', 
            borderRadius: '8px',
            backgroundColor: '#ffffff',
            textAlign: 'center'
          }}>
            <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '600' }}>Mobile</h4>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
              <MobileNotificationButton />
            </div>
            <p style={{ fontSize: '11px', color: '#6b7280' }}>
              Touch-optimized floating action button
            </p>
          </div>
        </div>
      </div>

      {/* Integration Examples */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>
          🔧 Integration Examples
        </h3>
        
        {/* Header Integration */}
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Header Integration</h4>
          <div style={{ 
            padding: '12px 20px', 
            backgroundColor: '#1f2937', 
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <h3 style={{ color: '#ffffff', margin: 0, fontSize: '18px' }}>Viking Scouts</h3>
              <nav style={{ display: 'flex', gap: '16px' }}>
                <a href="#" style={{ color: '#d1d5db', fontSize: '14px', textDecoration: 'none' }}>Dashboard</a>
                <a href="#" style={{ color: '#d1d5db', fontSize: '14px', textDecoration: 'none' }}>Events</a>
                <a href="#" style={{ color: '#d1d5db', fontSize: '14px', textDecoration: 'none' }}>Members</a>
              </nav>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <NotificationButton className="text-gray-400 hover:text-white" />
              <div style={{ width: '32px', height: '32px', backgroundColor: '#4b5563', borderRadius: '50%' }} />
            </div>
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Mobile Bottom Navigation</h4>
          <div style={{ 
            padding: '12px', 
            backgroundColor: '#ffffff', 
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center'
          }}>
            {['Home', 'Events', 'Members', 'Reports'].map(item => (
              <div key={item} style={{ textAlign: 'center', padding: '8px' }}>
                <div style={{ width: '24px', height: '24px', backgroundColor: '#e5e7eb', borderRadius: '4px', margin: '0 auto 4px' }} />
                <span style={{ fontSize: '11px', color: '#6b7280' }}>{item}</span>
              </div>
            ))}
            <div style={{ textAlign: 'center', padding: '8px' }}>
              <NotificationButton showCount={true} />
              <span style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginTop: '4px' }}>Alerts</span>
            </div>
          </div>
        </div>

        {/* Sidebar Integration */}
        <div>
          <h4 style={{ marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Sidebar Integration</h4>
          <div style={{ 
            display: 'flex',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            overflow: 'hidden',
            minHeight: '200px'
          }}>
            {/* Sidebar */}
            <div style={{ width: '240px', backgroundColor: '#f8fafc', padding: '16px', borderRight: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', margin: 0 }}>Navigation</h4>
                <NotificationButton />
              </div>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['Dashboard', 'Events', 'Members', 'Activities', 'Reports', 'Settings'].map(item => (
                  <a 
                    key={item}
                    href="#" 
                    style={{ 
                      padding: '8px 12px', 
                      borderRadius: '6px', 
                      fontSize: '14px', 
                      color: '#374151',
                      textDecoration: 'none',
                      backgroundColor: item === 'Dashboard' ? '#dbeafe' : 'transparent'
                    }}
                  >
                    {item}
                  </a>
                ))}
              </nav>
            </div>
            
            {/* Main Content */}
            <div style={{ flex: 1, padding: '16px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>Main Content Area</h4>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>
                Notification history is accessible from the sidebar notification button
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Overview */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>
          ✨ Notification History Features
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          {[
            {
              title: '🏷️ Smart Categorization',
              description: 'Notifications are automatically categorized by type and importance',
              features: ['Error tracking', 'System notifications', 'User actions', 'Priority levels']
            },
            {
              title: '🔍 Search & Filter',
              description: 'Find specific notifications quickly with search and filters',
              features: ['Text search', 'Filter by type', 'Filter by date', 'Unread filter']
            },
            {
              title: '💾 Persistent Storage',
              description: 'Important notifications are saved for future reference',
              features: ['30-day retention', '50 notification limit', 'Offline storage', 'Auto-cleanup']
            },
            {
              title: '♿ Accessibility',
              description: 'Full keyboard navigation and screen reader support',
              features: ['Keyboard shortcuts', 'ARIA labels', 'Focus management', 'Screen reader friendly']
            }
          ].map(({ title, description, features }) => (
            <div 
              key={title}
              style={{ 
                padding: '16px', 
                border: '1px solid #e2e8f0', 
                borderRadius: '8px',
                backgroundColor: '#ffffff'
              }}
            >
              <h4 style={{ marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>{title}</h4>
              <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>{description}</p>
              <ul style={{ fontSize: '11px', color: '#9ca3af', margin: 0, paddingLeft: '16px' }}>
                {features.map(feature => (
                  <li key={feature} style={{ marginBottom: '2px' }}>{feature}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Display Area for Active Notifications */}
      <div style={{ 
        border: '2px dashed #cbd5e1', 
        borderRadius: '8px', 
        minHeight: '300px',
        position: 'relative',
        backgroundColor: '#ffffff'
      }}>
        <BannerContainer maxBanners={3} position="top" />
        
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
          <h4 style={{ marginBottom: '8px' }}>Active Notifications Display</h4>
          <p>Notifications triggered by scenarios will appear here</p>
          <p style={{ fontSize: '12px', marginTop: '16px' }}>
            💡 Important notifications are automatically saved to history
          </p>
        </div>
        
        <ToastContainer maxToasts={5} position="bottom-right" />
      </div>
    </div>
  );
};

// Wrapper with NotificationProvider
const HistoryWrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationProvider>
    {children}
  </NotificationProvider>
);

const meta: Meta<typeof NotificationHistoryDemo> = {
  title: 'Notifications/History System',
  component: NotificationHistoryDemo,
  decorators: [
    (Story) => (
      <HistoryWrapper>
        <Story />
      </HistoryWrapper>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
The Notification History System provides a comprehensive inbox-like experience for managing and reviewing important notifications in the Viking Event Management application.

**System Overview:**

The notification history system extends the base notification framework with persistent storage, smart categorization, and user-friendly management tools. It automatically captures important notifications and makes them available for later review, ensuring users never miss critical information.

**Key Components:**

🔔 **NotificationButton**
- Displays unread count badge
- Opens notification history center
- Available in multiple variants (standard, compact, mobile)
- Integrates seamlessly with existing layouts

📋 **NotificationCenter**
- Slide-in panel showing notification history
- Search and filter capabilities
- Mark as read/unread functionality
- Individual notification management

🎯 **Smart Filtering**
- Automatically determines which notifications to save
- Role-based importance configuration
- Priority-based categorization
- Context-aware source tracking

**Automatic History Capture:**

The system automatically saves notifications that meet importance criteria:
- ❌ **Error notifications** - For debugging and retry actions
- ⚠️ **Warning notifications** - For safety and compliance
- 🔄 **Persistent notifications** - Important system status
- 🎯 **Action-required notifications** - User interventions needed
- ✅ **Success with actions** - Confirmations with follow-ups

**Use Cases in Viking Event Management:**

🏕️ **Scout Leaders:**
- Track event creation and management activities
- Review error notifications for troubleshooting
- Monitor system status and maintenance alerts
- Access confirmation receipts for important actions

👨‍👩‍👧‍👦 **Parents:**
- Review registration confirmations
- Check medical form expiration reminders
- Access badge achievement notifications
- Track communication from scout leaders

🖥️ **System Administrators:**
- Monitor system health and errors
- Track data sync and backup operations
- Review maintenance and upgrade notifications
- Access audit trail of system activities

**Technical Features:**

💾 **Persistent Storage**
- 30-day retention period with auto-cleanup
- localStorage-based with error handling
- 50 notification limit to prevent storage issues
- Offline-capable with sync on reconnection

🔍 **Advanced Filtering**
- Text search across messages and sources
- Filter by type (all, unread, errors, today)
- Sort by timestamp with relative time display
- Role-based importance configuration

♿ **Accessibility**
- Full keyboard navigation support
- Screen reader compatibility with proper ARIA
- Focus management for modal interactions
- High contrast mode support

📱 **Mobile Optimization**
- Touch-friendly interface with large tap targets
- Swipe gestures for mobile interactions
- Responsive design adapting to screen size
- Optimized loading for mobile networks

This system transforms the notification experience from temporary alerts to a comprehensive communication and task management tool.
        `,
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const InteractiveDemo: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Complete interactive demonstration of the notification history system with real-world scenarios.',
      },
    },
  },
};

// Integration-focused stories
export const HeaderIntegration: Story = {
  render: () => {
    const HeaderDemo = () => {
      const { toast } = useNotificationUtils();
      
      return (
        <div>
          {/* App Header */}
          <header style={{ 
            padding: '16px 24px', 
            backgroundColor: '#1f2937', 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h1 style={{ color: '#ffffff', fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
              Viking Scouts Dashboard
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <NotificationButton className="text-gray-400 hover:text-white" />
              <div style={{ 
                width: '36px', 
                height: '36px', 
                backgroundColor: '#4b5563', 
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 'bold'
              }}>
                JD
              </div>
            </div>
          </header>
          
          {/* Demo Content */}
          <div style={{ padding: '24px' }}>
            <h2>App Content</h2>
            <Button onClick={() => toast.error('Example error for history')}>
              Trigger Error
            </Button>
          </div>
        </div>
      );
    };
    
    return (
      <NotificationProvider>
        <HeaderDemo />
      </NotificationProvider>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates notification button integration in application headers.',
      },
    },
  },
};

export const MobileIntegration: Story = {
  render: () => {
    const MobileDemo = () => {
      const { toast } = useNotificationUtils();
      
      return (
        <div style={{ maxWidth: '375px', margin: '0 auto', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
          {/* Mobile Header */}
          <header style={{ 
            padding: '12px 16px', 
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h1 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Vikings</h1>
            <NotificationButton />
          </header>
          
          {/* Mobile Content */}
          <main style={{ padding: '16px', minHeight: '300px' }}>
            <h2 style={{ fontSize: '16px', marginBottom: '12px' }}>Dashboard</h2>
            <Button 
              onClick={() => toast.warning('Mobile notification example')}
              style={{ width: '100%' }}
            >
              Test Mobile Notification
            </Button>
          </main>
          
          {/* Mobile Bottom Nav */}
          <nav style={{ 
            padding: '8px 0', 
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-around'
          }}>
            {['Home', 'Events', 'Members', 'More'].map(item => (
              <div key={item} style={{ textAlign: 'center', padding: '8px' }}>
                <div style={{ width: '20px', height: '20px', backgroundColor: '#d1d5db', borderRadius: '3px', margin: '0 auto 4px' }} />
                <span style={{ fontSize: '10px', color: '#6b7280' }}>{item}</span>
              </div>
            ))}
          </nav>
        </div>
      );
    };
    
    return (
      <NotificationProvider>
        <MobileDemo />
      </NotificationProvider>
    );
  },
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
    docs: {
      description: {
        story: 'Mobile-optimized notification integration example.',
      },
    },
  },
};