import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { NotificationProvider, useNotification } from '../contexts/notifications/NotificationContext';
import { useNotificationUtils } from '../contexts/notifications/notificationUtils';
import ToastContainer from '../components/notifications/ToastContainer';
import BannerContainer from '../components/notifications/BannerContainer';
import { Button } from '../components/ui';

// Complex scenarios demonstration component
const ComplexScenariosDemo = () => {
  const { notifications, removeAll, removeNotification } = useNotification();
  const { toast, banner } = useNotificationUtils();
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('online');

  // Data synchronization scenario
  const triggerSyncScenario = async () => {
    setIsLoadingData(true);
    banner.info('Starting data synchronization...');
    
    // Simulate progress updates
    setTimeout(() => toast.info('Fetching user data...'), 500);
    setTimeout(() => toast.info('Downloading events...'), 1500);
    setTimeout(() => toast.warning('Large file detected - this may take longer'), 2500);
    setTimeout(() => toast.success('Attendance data synchronized'), 3500);
    
    // Final status
    setTimeout(() => {
      banner.success('Data synchronization completed', {
        actions: [
          { label: 'View Changes', onClick: () => console.log('Viewing changes') }
        ]
      });
      setIsLoadingData(false);
    }, 4500);
  };

  // Connection error scenario
  const triggerConnectionScenario = () => {
    setConnectionStatus('disconnected');
    
    // Initial connection failure
    toast.error('Connection lost - switching to offline mode');
    
    setTimeout(() => {
      banner.error('Unable to sync data. Working in offline mode.', {
        persistent: true,
        actions: [
          { label: 'Retry Connection', onClick: () => {
            setConnectionStatus('reconnecting');
            banner.warning('Attempting to reconnect...', { persistent: true });
            
            setTimeout(() => {
              setConnectionStatus('online');
              banner.success('Connection restored! Syncing changes...', {
                actions: [
                  { label: 'View Sync Status', onClick: () => console.log('Sync status') }
                ]
              });
            }, 2000);
          }},
          { label: 'Continue Offline', onClick: () => {
            removeNotification(notifications.find(n => n.message.includes('Unable to sync'))?.id!);
            toast.info('Continuing in offline mode');
          }}
        ]
      });
    }, 1000);
  };

  // Form validation scenario
  const triggerValidationScenario = () => {
    // Multiple validation errors
    toast.error('Please fix the following errors:');
    
    setTimeout(() => toast.error('Event name is required'), 200);
    setTimeout(() => toast.error('Event date must be in the future'), 400);
    setTimeout(() => toast.error('At least one activity must be selected'), 600);
    
    // User fixes some errors
    setTimeout(() => {
      toast.success('Event name updated');
      // Still have remaining errors
      setTimeout(() => toast.warning('2 validation errors remaining'), 500);
    }, 3000);
  };

  // Bulk operation scenario
  const triggerBulkOperationScenario = () => {
    banner.info('Processing 25 member updates...', { persistent: true });
    
    let processed = 0;
    const total = 25;
    
    const processNext = () => {
      processed++;
      if (processed <= total) {
        if (processed % 5 === 0) {
          toast.info(`Processed ${processed}/${total} members`);
        }
        
        // Simulate occasional errors
        if (processed === 12) {
          toast.warning('Member #12 - Invalid phone number, skipping');
        }
        if (processed === 18) {
          toast.warning('Member #18 - Duplicate email detected, merging records');
        }
        
        if (processed < total) {
          setTimeout(processNext, 200);
        } else {
          // Complete
          banner.success(`Successfully processed ${total} member updates`, {
            actions: [
              { label: 'View Report', onClick: () => console.log('View report') },
              { label: 'Export Changes', onClick: () => console.log('Export changes') }
            ]
          });
        }
      }
    };
    
    processNext();
  };

  // Multi-step workflow scenario
  const triggerWorkflowScenario = () => {
    // Step 1: Initialize
    banner.info('Starting event creation workflow...', { persistent: true });
    
    setTimeout(() => {
      toast.info('Step 1: Validating event details');
      
      setTimeout(() => {
        toast.success('Event details validated');
        toast.info('Step 2: Creating event record');
        
        setTimeout(() => {
          toast.success('Event record created');
          toast.info('Step 3: Setting up activities');
          
          setTimeout(() => {
            toast.warning('Some activities require additional permissions', {
              actions: [
                { label: 'Request Permissions', onClick: () => {
                  toast.info('Permission request sent to admin');
                  setTimeout(() => {
                    toast.success('Permissions approved');
                    toast.info('Step 4: Finalizing event setup');
                    
                    setTimeout(() => {
                      banner.success('Event "Summer Camp 2024" created successfully!', {
                        actions: [
                          { label: 'View Event', onClick: () => console.log('View event') },
                          { label: 'Add Members', onClick: () => console.log('Add members') }
                        ]
                      });
                    }, 1000);
                  }, 2000);
                }}
              ]
            });
          }, 1000);
        }, 1000);
      }, 1000);
    }, 500);
  };

  // System status scenario
  const triggerSystemScenario = () => {
    // Multiple system components reporting
    banner.warning('System maintenance window starting in 5 minutes', { persistent: true });
    
    setTimeout(() => toast.info('Database backup initiated'), 1000);
    setTimeout(() => toast.info('Notification service: Online'), 1500);
    setTimeout(() => toast.warning('Background sync: Delayed'), 2000);
    setTimeout(() => toast.error('SMS service: Temporarily unavailable'), 2500);
    
    setTimeout(() => {
      banner.info('Maintenance window active - some features may be limited', {
        persistent: true,
        actions: [
          { label: 'System Status', onClick: () => console.log('System status') }
        ]
      });
    }, 3000);
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'online': return '#22c55e';
      case 'disconnected': return '#ef4444';
      case 'reconnecting': return '#f59e0b';
      default: return '#64748b';
    }
  };

  return (
    <div style={{ padding: '20px', minHeight: '700px', position: 'relative' }}>
      {/* Status Panel */}
      <div style={{ 
        marginBottom: '24px', 
        padding: '16px', 
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px'
      }}>
        <h3 style={{ marginBottom: '12px', fontSize: '18px', fontWeight: 'bold' }}>
          🔄 Complex Notification Scenarios
        </h3>
        <div style={{ fontSize: '14px', color: '#475569', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div 
              style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                backgroundColor: getStatusColor() 
              }} 
            />
            <span><strong>Status:</strong> {connectionStatus}</span>
            {isLoadingData && <span style={{ marginLeft: '16px' }}>📊 Syncing data...</span>}
          </div>
          <div style={{ marginTop: '8px' }}>
            <strong>Active Notifications:</strong> {notifications.length} total 
            ({notifications.filter(n => n.persistent).length} persistent, {notifications.filter(n => !n.persistent).length} temporary)
          </div>
        </div>
      </div>

      {/* Scenario Triggers */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>
          📚 Real-World Scenarios
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
          <Button 
            onClick={triggerSyncScenario}
            disabled={isLoadingData}
            variant="outline"
          >
            📊 Data Synchronization Flow
          </Button>
          <Button 
            onClick={triggerConnectionScenario}
            variant="outline"
          >
            🌐 Connection Error Recovery
          </Button>
          <Button 
            onClick={triggerValidationScenario}
            variant="outline"
          >
            ⚠️ Form Validation Errors
          </Button>
          <Button 
            onClick={triggerBulkOperationScenario}
            variant="outline"
          >
            🗂️ Bulk Operation Progress
          </Button>
          <Button 
            onClick={triggerWorkflowScenario}
            variant="outline"
          >
            🔄 Multi-Step Workflow
          </Button>
          <Button 
            onClick={triggerSystemScenario}
            variant="outline"
          >
            🖥️ System Status Updates
          </Button>
        </div>
      </div>

      {/* Scenario Descriptions */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>
          📋 Scenario Details
        </h4>
        <div style={{ display: 'grid', gap: '8px', fontSize: '12px' }}>
          <div style={{ padding: '8px', backgroundColor: '#f0f9ff', border: '1px solid #0ea5e9', borderRadius: '4px' }}>
            <strong>Data Sync:</strong> Progress tracking, error handling, completion confirmation with actions
          </div>
          <div style={{ padding: '8px', backgroundColor: '#fef2f2', border: '1px solid #f87171', borderRadius: '4px' }}>
            <strong>Connection Error:</strong> Offline mode transition, retry mechanisms, automatic recovery
          </div>
          <div style={{ padding: '8px', backgroundColor: '#fffbeb', border: '1px solid #fbbf24', borderRadius: '4px' }}>
            <strong>Form Validation:</strong> Multiple errors, progressive fixing, real-time feedback
          </div>
          <div style={{ padding: '8px', backgroundColor: '#f0fdf4', border: '1px solid #4ade80', borderRadius: '4px' }}>
            <strong>Bulk Operations:</strong> Progress indicators, partial failures, completion summary
          </div>
          <div style={{ padding: '8px', backgroundColor: '#faf5ff', border: '1px solid #c084fc', borderRadius: '4px' }}>
            <strong>Workflows:</strong> Multi-step processes, conditional steps, user intervention points
          </div>
          <div style={{ padding: '8px', backgroundColor: '#f1f5f9', border: '1px solid #64748b', borderRadius: '4px' }}>
            <strong>System Status:</strong> Service monitoring, maintenance windows, component health
          </div>
        </div>
      </div>

      {/* Management Controls */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>
          🎛️ Notification Management
        </h4>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button 
            size="sm" 
            variant="outline"
            onClick={removeAll}
            disabled={notifications.length === 0}
          >
            Clear All ({notifications.length})
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => {
              notifications.filter(n => n.persistent).forEach(n => removeNotification(n.id));
            }}
            disabled={notifications.filter(n => n.persistent).length === 0}
          >
            Clear Persistent ({notifications.filter(n => n.persistent).length})
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => {
              // Simulate system reset
              removeAll();
              setTimeout(() => {
                setConnectionStatus('online');
                setIsLoadingData(false);
                banner.success('System reset completed');
              }, 500);
            }}
          >
            Reset Demo State
          </Button>
        </div>
      </div>

      {/* Notification Display Area */}
      <div style={{ 
        border: '2px dashed #cbd5e1', 
        borderRadius: '8px', 
        minHeight: '350px',
        position: 'relative',
        backgroundColor: '#ffffff',
        overflow: 'hidden'
      }}>
        <BannerContainer maxBanners={4} position="top" />
        
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
          <h4 style={{ marginBottom: '8px' }}>Complex Scenario Playground</h4>
          <p>Click scenario buttons to simulate real-world notification patterns</p>
          
          {notifications.length === 0 ? (
            <div style={{ marginTop: '20px', fontSize: '14px', opacity: 0.7 }}>
              <p>🎭 Each scenario demonstrates different notification strategies:</p>
              <p>• Progress tracking with multiple updates</p>
              <p>• Error recovery with user actions</p>
              <p>• Multi-step workflows with conditional branching</p>
              <p>• System status monitoring and alerts</p>
            </div>
          ) : (
            <div style={{ marginTop: '20px', fontSize: '12px' }}>
              <p>Watch how different notification types coordinate together</p>
              <p>Notice the timing, persistence, and interaction patterns</p>
            </div>
          )}
        </div>
        
        <ToastContainer maxToasts={6} position="bottom-right" />
      </div>
    </div>
  );
};

// Wrapper with NotificationProvider
const ComplexWrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationProvider>
    {children}
  </NotificationProvider>
);

const meta: Meta<typeof ComplexScenariosDemo> = {
  title: 'Notifications/Complex Scenarios',
  component: ComplexScenariosDemo,
  decorators: [
    (Story) => (
      <ComplexWrapper>
        <Story />
      </ComplexWrapper>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
Advanced notification scenarios that demonstrate real-world usage patterns in the Viking Event Management system. These examples show how notifications coordinate to provide comprehensive user feedback during complex operations.

**Complex Scenario Types:**

🔄 **Data Synchronization Flow**
- Progress tracking with multiple status updates
- Error handling during sync operations
- Completion confirmation with actionable next steps
- Background operation status reporting

🌐 **Connection Error Recovery**
- Automatic offline mode transition
- User-initiated retry mechanisms
- Automatic reconnection detection
- Sync resumption after connection restore

⚠️ **Form Validation Patterns**
- Multiple simultaneous validation errors
- Progressive error resolution feedback
- Real-time validation status updates
- Success confirmation for corrected fields

🗂️ **Bulk Operation Management**
- Progress indicators for long-running operations
- Partial failure reporting and handling
- Completion summaries with detailed results
- Export/view options for operation results

🔄 **Multi-Step Workflow Coordination**
- Sequential step completion tracking
- Conditional branching based on user input
- User intervention points with clear actions
- Workflow completion with summary

🖥️ **System Status Monitoring**
- Multiple service component reporting
- Maintenance window notifications
- Service degradation alerts
- System health status updates

**Key Patterns Demonstrated:**

🎯 **Notification Orchestration**
- Temporal coordination of related notifications
- Appropriate persistence levels for different message types
- Action button integration for user control
- Smart notification replacement vs. stacking

🎭 **User Experience Flows**
- Progress indication without overwhelming the user
- Clear error recovery paths
- Contextual help and guidance
- Successful completion acknowledgment

📱 **Mobile-First Considerations**
- Touch-friendly action buttons
- Appropriate notification lifetime for mobile usage
- Screen space optimization for complex flows
- Gesture-based dismissal patterns
        `,
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const ComplexScenariosDemo: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Interactive playground for testing complex real-world notification scenarios.',
      },
    },
  },
};

// Individual scenario stories
export const DataSynchronizationFlow: Story = {
  render: () => {
    const DataSyncDemo = () => {
      const { banner, toast } = useNotificationUtils();
      
      React.useEffect(() => {
        // Auto-trigger sync scenario on load
        const timer = setTimeout(() => {
          banner.info('Data synchronization in progress...');
          setTimeout(() => toast.info('Fetching member data...'), 500);
          setTimeout(() => toast.success('Synchronization completed'), 2000);
        }, 1000);
        
        return () => clearTimeout(timer);
      }, [banner, toast]);
      
      return (
        <div style={{ padding: '20px', minHeight: '300px', position: 'relative' }}>
          <h3>Data Synchronization Flow</h3>
          <p>Demonstrates progress tracking and completion feedback</p>
          <BannerContainer maxBanners={2} position="top" />
          <ToastContainer maxToasts={3} position="bottom-right" />
        </div>
      );
    };
    
    return (
      <NotificationProvider>
        <DataSyncDemo />
      </NotificationProvider>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Focused demo of data synchronization flow with progress tracking.',
      },
    },
  },
};

export const ErrorRecoveryFlow: Story = {
  render: () => {
    const ErrorDemo = () => {
      const { banner, toast } = useNotificationUtils();
      
      React.useEffect(() => {
        const timer = setTimeout(() => {
          toast.error('Connection lost');
          setTimeout(() => {
            banner.error('Operating in offline mode', {
              persistent: true,
              actions: [
                { label: 'Retry', onClick: () => toast.success('Connection restored!') }
              ]
            });
          }, 1000);
        }, 1000);
        
        return () => clearTimeout(timer);
      }, [banner, toast]);
      
      return (
        <div style={{ padding: '20px', minHeight: '300px', position: 'relative' }}>
          <h3>Error Recovery Flow</h3>
          <p>Shows error handling and recovery mechanisms</p>
          <BannerContainer maxBanners={2} position="top" />
          <ToastContainer maxToasts={3} position="bottom-right" />
        </div>
      );
    };
    
    return (
      <NotificationProvider>
        <ErrorDemo />
      </NotificationProvider>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates error handling and user-driven recovery patterns.',
      },
    },
  },
};