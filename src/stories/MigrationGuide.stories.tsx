import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { NotificationProvider } from '../../../shared/contexts/notifications/NotificationContext';
import { useNotificationUtils } from '../contexts/notifications/notificationUtils';
import AlertAdapter, { AlertTitle, AlertDescription, AlertActions } from '../components/ui/AlertAdapter';
import ToastContainer from '../components/notifications/ToastContainer';
import BannerContainer from '../components/notifications/BannerContainer';
import { Button } from '../components/ui';

// Migration guide demonstration component
const MigrationGuideDemo = () => {
  const { toast, banner } = useNotificationUtils();

  // Legacy Alert patterns (what it looked like before)
  const LegacyExamples = () => (
    <div style={{ marginBottom: '32px' }}>
      <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
        📜 Legacy Alert Patterns (Before Migration)
      </h3>
      
      <div style={{ 
        padding: '16px', 
        backgroundColor: '#fef2f2', 
        border: '1px solid #fecaca', 
        borderRadius: '8px',
        marginBottom: '16px'
      }}>
        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>❌ Old Code (Don't use)</h4>
        <pre style={{ 
          fontSize: '11px', 
          fontFamily: 'monospace', 
          backgroundColor: '#ffffff', 
          padding: '12px', 
          borderRadius: '4px',
          overflow: 'auto',
          margin: 0
        }}>
{`// Legacy Alert component usage (DEPRECATED)
import { Alert } from './ui';

// Basic alert
<Alert variant="danger" dismissible onDismiss={handleDismiss}>
  Something went wrong!
</Alert>

// Complex alert with compound components
<Alert variant="success" dismissible>
  <Alert.Title>Operation Successful</Alert.Title>
  <Alert.Description>
    Your changes have been saved successfully.
  </Alert.Description>
  <Alert.Actions>
    <Button onClick={handleView}>View Changes</Button>
    <Button variant="outline" onClick={handleClose}>Close</Button>
  </Alert.Actions>
</Alert>

// Scout-themed variants
<Alert variant="scout-blue">Scout meeting reminder</Alert>
<Alert variant="scout-green">Badge awarded!</Alert>`}
        </pre>
      </div>
    </div>
  );

  // Modern AlertAdapter patterns (current approach)
  const ModernExamples = () => (
    <div style={{ marginBottom: '32px' }}>
      <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
        ✅ Modern AlertAdapter Patterns (After Migration)
      </h3>
      
      <div style={{ 
        padding: '16px', 
        backgroundColor: '#f0fdf4', 
        border: '1px solid #bbf7d0', 
        borderRadius: '8px',
        marginBottom: '16px'
      }}>
        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>✅ New Code (Recommended)</h4>
        <pre style={{ 
          fontSize: '11px', 
          fontFamily: 'monospace', 
          backgroundColor: '#ffffff', 
          padding: '12px', 
          borderRadius: '4px',
          overflow: 'auto',
          margin: 0
        }}>
{`// Modern AlertAdapter - Drop-in replacement
import { AlertAdapter, AlertTitle, AlertDescription, AlertActions } from '../adapters';

// Basic alert (auto-converts danger -> error)
<AlertAdapter variant="error" dismissible onDismiss={handleDismiss}>
  Something went wrong!
</AlertAdapter>

// Complex alert with compound components (identical API)
<AlertAdapter variant="success" dismissible>
  <AlertTitle>Operation Successful</AlertTitle>
  <AlertDescription>
    Your changes have been saved successfully.
  </AlertDescription>
  <AlertActions>
    <Button onClick={handleView}>View Changes</Button>
    <Button variant="outline" onClick={handleClose}>Close</Button>
  </AlertActions>
</AlertAdapter>

// Scout-themed variants (preserved)
<AlertAdapter variant="scout-blue">Scout meeting reminder</AlertAdapter>
<AlertAdapter variant="scout-green">Badge awarded!</AlertAdapter>`}
        </pre>
      </div>

      {/* Live Examples */}
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>Live AlertAdapter Examples:</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <AlertAdapter variant="success" dismissible>
            <AlertTitle>Migration Complete!</AlertTitle>
            <AlertDescription>
              All legacy Alert components have been successfully migrated to AlertAdapter.
            </AlertDescription>
          </AlertAdapter>

          <AlertAdapter variant="scout-blue">
            <AlertTitle>Scout Information</AlertTitle>
            <AlertDescription>
              Next meeting is scheduled for Saturday at 2 PM in the Village Hall.
            </AlertDescription>
            <AlertActions>
              <Button variant="scout-blue" size="sm" onClick={() => toast.info('Added to calendar')}>
                Add to Calendar
              </Button>
            </AlertActions>
          </AlertAdapter>

          <AlertAdapter variant="error" dismissible>
            <AlertTitle>Validation Error</AlertTitle>
            <AlertDescription>
              Please fix the highlighted fields before submitting the form.
            </AlertDescription>
            <AlertActions>
              <Button variant="outline" size="sm" onClick={() => toast.info('Scrolled to first error')}>
                Go to Error
              </Button>
            </AlertActions>
          </AlertAdapter>
        </div>
      </div>
    </div>
  );

  // New notification system patterns
  const NewSystemExamples = () => (
    <div style={{ marginBottom: '32px' }}>
      <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
        🚀 New Notification System Patterns
      </h3>
      
      <div style={{ 
        padding: '16px', 
        backgroundColor: '#f0f9ff', 
        border: '1px solid #bae6fd', 
        borderRadius: '8px',
        marginBottom: '16px'
      }}>
        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>🆕 Modern Notification API</h4>
        <pre style={{ 
          fontSize: '11px', 
          fontFamily: 'monospace', 
          backgroundColor: '#ffffff', 
          padding: '12px', 
          borderRadius: '4px',
          overflow: 'auto',
          margin: 0
        }}>
{`// New useNotificationUtils hook
import { useNotificationUtils } from '../contexts/notifications/notificationUtils';

const MyComponent = () => {
  const { toast, banner } = useNotificationUtils();
  
  const handleSave = async () => {
    try {
      // Show progress
      banner.info('Saving changes...');
      
      await saveData();
      
      // Show success with action
      toast.success('Changes saved!', {
        actions: [
          { label: 'Undo', onClick: handleUndo },
          { label: 'View', onClick: handleView }
        ]
      });
    } catch (error) {
      // Show error with retry
      toast.error('Failed to save changes', {
        persistent: true,
        actions: [
          { label: 'Retry', onClick: handleSave }
        ]
      });
    }
  };
  
  return <Button onClick={handleSave}>Save</Button>;
};`}
        </pre>
      </div>

      {/* Live Examples */}
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>Live Notification Examples:</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => toast.success('Data saved successfully!', {
              actions: [{ label: 'View Details', onClick: () => console.log('Details') }]
            })}
          >
            Success Toast
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => banner.warning('Session expires in 5 minutes', {
              persistent: true,
              actions: [{ label: 'Extend Session', onClick: () => toast.info('Session extended') }]
            })}
          >
            Warning Banner
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => toast.error('Connection failed', {
              actions: [
                { label: 'Retry', onClick: () => toast.info('Retrying...') },
                { label: 'Go Offline', onClick: () => toast.info('Offline mode enabled') }
              ]
            })}
          >
            Error with Actions
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => {
              banner.info('Processing bulk operation...');
              setTimeout(() => {
                toast.success('Bulk operation completed');
              }, 2000);
            }}
          >
            Progress Flow
          </Button>
        </div>
      </div>
    </div>
  );

  // Migration steps
  const MigrationSteps = () => (
    <div style={{ marginBottom: '32px' }}>
      <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
        📋 Step-by-Step Migration Guide
      </h3>
      
      <div style={{ display: 'grid', gap: '16px' }}>
        {[
          {
            step: 1,
            title: 'Update Imports',
            description: 'Replace Alert imports with AlertAdapter',
            before: `import { Alert } from './ui';`,
            after: `import { AlertAdapter, AlertTitle, AlertDescription, AlertActions } from '../adapters';`,
            color: '#f0f9ff'
          },
          {
            step: 2,
            title: 'Update Component Names',
            description: 'Change Alert to AlertAdapter in JSX',
            before: `<Alert variant="danger">Error message</Alert>`,
            after: `<AlertAdapter variant="error">Error message</AlertAdapter>`,
            color: '#f0fdf4'
          },
          {
            step: 3,
            title: 'Update Compound Components',
            description: 'Change Alert.* to AlertAdapter components',
            before: `<Alert.Title>Title</Alert.Title>
<Alert.Description>Description</Alert.Description>
<Alert.Actions>Actions</Alert.Actions>`,
            after: `<AlertTitle>Title</AlertTitle>
<AlertDescription>Description</AlertDescription>
<AlertActions>Actions</AlertActions>`,
            color: '#fffbeb'
          },
          {
            step: 4,
            title: 'Update Variant Names',
            description: 'Convert deprecated variant names',
            before: `<Alert variant="danger">Error</Alert>`,
            after: `<AlertAdapter variant="error">Error</AlertAdapter>`,
            color: '#fef2f2'
          },
          {
            step: 5,
            title: 'Consider New Patterns',
            description: 'Evaluate using new notification system for better UX',
            before: `<Alert variant="success">Saved!</Alert>`,
            after: `// Consider toast for temporary feedback
const { toast } = useNotificationUtils();
toast.success('Saved!');`,
            color: '#f3e8ff'
          }
        ].map(({ step, title, description, before, after, color }) => (
          <div 
            key={step}
            style={{ 
              padding: '16px', 
              backgroundColor: color, 
              border: '1px solid #e5e7eb', 
              borderRadius: '8px' 
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ 
                width: '24px', 
                height: '24px', 
                borderRadius: '50%', 
                backgroundColor: '#3b82f6', 
                color: 'white', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontSize: '12px', 
                fontWeight: 'bold',
                marginRight: '12px'
              }}>
                {step}
              </div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: '600', margin: 0 }}>{title}</h4>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{description}</p>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
              <div>
                <h5 style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: '#dc2626' }}>❌ Before</h5>
                <pre style={{ 
                  fontSize: '10px', 
                  fontFamily: 'monospace', 
                  backgroundColor: '#ffffff', 
                  padding: '8px', 
                  borderRadius: '4px',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {before}
                </pre>
              </div>
              <div>
                <h5 style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: '#059669' }}>✅ After</h5>
                <pre style={{ 
                  fontSize: '10px', 
                  fontFamily: 'monospace', 
                  backgroundColor: '#ffffff', 
                  padding: '8px', 
                  borderRadius: '4px',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {after}
                </pre>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Best practices
  const BestPractices = () => (
    <div style={{ marginBottom: '32px' }}>
      <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
        💡 Best Practices & Recommendations
      </h3>
      
      <div style={{ display: 'grid', gap: '12px' }}>
        {[
          {
            title: 'Choose the Right Notification Type',
            description: 'Use toasts for temporary feedback, banners for persistent information',
            example: 'Toast: "Saved successfully!" | Banner: "You have 3 pending invitations"',
            icon: '🎯'
          },
          {
            title: 'Include Actionable Feedback',
            description: 'Provide users with clear next steps or recovery options',
            example: 'Error messages should include "Retry" or "Contact Support" actions',
            icon: '🔧'
          },
          {
            title: 'Respect User Attention',
            description: 'Don\'t overwhelm with too many notifications simultaneously',
            example: 'Limit to 3-5 active notifications, use appropriate duration',
            icon: '⚖️'
          },
          {
            title: 'Maintain Accessibility',
            description: 'Ensure notifications work with screen readers and keyboard navigation',
            example: 'Use proper ARIA roles, manage focus, provide keyboard shortcuts',
            icon: '♿'
          },
          {
            title: 'Consider Mobile Experience',
            description: 'Design for touch interactions and limited screen space',
            example: 'Larger tap targets, swipe-to-dismiss, bottom positioning',
            icon: '📱'
          },
          {
            title: 'Progressive Enhancement',
            description: 'Start with AlertAdapter, migrate to new system when beneficial',
            example: 'Form errors → AlertAdapter | Success feedback → Toast',
            icon: '📈'
          }
        ].map(({ title, description, example, icon }) => (
          <div 
            key={title}
            style={{ 
              padding: '12px', 
              backgroundColor: '#f8fafc', 
              border: '1px solid #e2e8f0', 
              borderRadius: '6px',
              display: 'flex',
              gap: '12px'
            }}
          >
            <div style={{ fontSize: '20px' }}>{icon}</div>
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>{title}</h4>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>{description}</p>
              <p style={{ fontSize: '11px', color: '#475569', fontStyle: 'italic' }}>{example}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Common pitfalls
  const CommonPitfalls = () => (
    <div>
      <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
        ⚠️ Common Pitfalls & Solutions
      </h3>
      
      <div style={{ display: 'grid', gap: '12px' }}>
        {[
          {
            problem: 'Notification Fatigue',
            solution: 'Limit simultaneous notifications and use appropriate persistence',
            example: 'Don\'t show 5 success messages for bulk operations - use one summary'
          },
          {
            problem: 'Missing Context',
            solution: 'Always provide clear, actionable messages',
            example: 'Instead of "Error occurred", use "Failed to save user preferences"'
          },
          {
            problem: 'Wrong Notification Type',
            solution: 'Match notification persistence to user workflow',
            example: 'Form validation errors should be persistent until fixed'
          },
          {
            problem: 'Accessibility Overlooked',
            solution: 'Test with keyboard navigation and screen readers',
            example: 'Ensure notifications can be dismissed via keyboard shortcuts'
          },
          {
            problem: 'Mobile Unfriendly',
            solution: 'Design for touch interactions and small screens',
            example: 'Action buttons should be at least 44px tall for touch targets'
          }
        ].map(({ problem, solution, example }) => (
          <div 
            key={problem}
            style={{ 
              padding: '12px', 
              backgroundColor: '#fef3c7', 
              border: '1px solid #f59e0b', 
              borderRadius: '6px'
            }}
          >
            <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
              <span style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '12px' }}>Problem:</span>
              <span style={{ fontSize: '12px' }}>{problem}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
              <span style={{ color: '#059669', fontWeight: 'bold', fontSize: '12px' }}>Solution:</span>
              <span style={{ fontSize: '12px' }}>{solution}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ color: '#7c2d12', fontWeight: 'bold', fontSize: '12px' }}>Example:</span>
              <span style={{ fontSize: '12px', fontStyle: 'italic' }}>{example}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ 
        marginBottom: '32px', 
        padding: '24px', 
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        textAlign: 'center'
      }}>
        <h1 style={{ marginBottom: '12px', fontSize: '28px', fontWeight: 'bold' }}>
          📚 Notification System Migration Guide
        </h1>
        <p style={{ fontSize: '16px', color: '#64748b', marginBottom: '16px' }}>
          Complete guide for migrating from legacy Alert components to the new notification system
        </p>
        <div style={{ fontSize: '14px', color: '#475569' }}>
          <strong>Migration Path:</strong> Legacy Alert → AlertAdapter (immediate) → New Notification System (progressive)
        </div>
      </div>

      <LegacyExamples />
      <ModernExamples />
      <NewSystemExamples />
      <MigrationSteps />
      <BestPractices />
      <CommonPitfalls />

      {/* Notification Display Area */}
      <div style={{ 
        marginTop: '32px',
        border: '2px dashed #cbd5e1', 
        borderRadius: '8px', 
        minHeight: '200px',
        position: 'relative',
        backgroundColor: '#ffffff'
      }}>
        <BannerContainer maxBanners={3} position="top" />
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
          <p>Interactive examples above will display notifications here</p>
        </div>
        <ToastContainer maxToasts={4} position="bottom-right" />
      </div>
    </div>
  );
};

// Wrapper with NotificationProvider
const MigrationWrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationProvider>
    {children}
  </NotificationProvider>
);

const meta: Meta<typeof MigrationGuideDemo> = {
  title: 'Notifications/Migration Guide',
  component: MigrationGuideDemo,
  decorators: [
    (Story) => (
      <MigrationWrapper>
        <Story />
      </MigrationWrapper>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
Comprehensive migration guide for transitioning from legacy Alert components to the modern notification system in the Viking Event Management application.

**Migration Overview:**

The notification system migration follows a two-phase approach designed to minimize disruption while enabling teams to adopt modern patterns progressively:

**Phase 1: Drop-in Replacement (AlertAdapter)**
- **Immediate Benefits:** Zero breaking changes, same API as legacy Alert
- **Implementation:** Change import statements only, all existing code works
- **Timeline:** Can be completed in a single sprint
- **Risk Level:** Very low - maintains exact same behavior and API

**Phase 2: Progressive Enhancement (New Notification System)**
- **Enhanced UX:** Better positioning, animations, mobile optimization
- **Modern Patterns:** Toast and Banner components with advanced features
- **Timeline:** Gradual adoption as features are updated
- **Risk Level:** Low - opt-in basis, can coexist with AlertAdapter

**Key Advantages of New System:**

🎯 **Better User Experience**
- Smart positioning that adapts to viewport and content
- Smooth animations and transitions with accessibility support
- Mobile-first design with touch-friendly interactions
- Contextual persistence (temporary vs. permanent notifications)

🛠️ **Developer Experience**
- Simple, intuitive API with TypeScript support
- Comprehensive action system for user interactions
- Built-in accessibility features (ARIA, keyboard navigation)
- Extensive customization options without complexity

📱 **Mobile Optimization**
- Touch gesture support for dismissal
- Safe area handling for devices with notches
- Responsive positioning and sizing
- Performance optimized for mobile browsers

♿ **Accessibility First**
- Screen reader compatibility with proper ARIA roles
- Keyboard navigation support
- Respects user motion preferences
- High contrast mode support

**Migration Strategy Recommendations:**

**Immediate (Week 1-2):**
1. Replace all \`Alert\` imports with \`AlertAdapter\`
2. Update variant names (danger → error)
3. Update compound component references
4. Test existing functionality

**Progressive (Ongoing):**
1. Identify high-impact areas (forms, actions, status updates)
2. Migrate to toast/banner patterns for better UX
3. Add action buttons where beneficial
4. Implement mobile-specific enhancements

**Compatibility Matrix:**

| Legacy Alert Feature | AlertAdapter | New System | Notes |
|---------------------|--------------|------------|-------|
| Basic variants | ✅ | ✅ | All variants preserved |
| Compound components | ✅ | ➖ | Different API in new system |
| Scout theme variants | ✅ | ➖ | Can be added if needed |
| Dismissible behavior | ✅ | ✅ | Enhanced in new system |
| Custom styling | ✅ | ✅ | More flexible in new system |
| Action buttons | ✅ | ✅ | Much more powerful in new system |

This migration guide ensures teams can adopt the new notification system at their own pace while immediately benefiting from improved reliability and future-proofing.
        `,
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const MigrationGuide: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Complete migration guide from legacy Alert components to the modern notification system.',
      },
    },
  },
};