import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { NotificationProvider } from '../contexts/notifications/NotificationContext';
import { useNotificationUtils } from '../contexts/notifications/notificationUtils';
import ToastContainer from '../components/notifications/ToastContainer';
import BannerContainer from '../components/notifications/BannerContainer';
import { Button } from '../components/ui';

// Animation and transitions demonstration component
const AnimationDemo = () => {
  const { toast, banner } = useNotificationUtils();
  const [motionPreference, setMotionPreference] = useState('normal');
  const [animationSpeed, setAnimationSpeed] = useState('normal');

  // Apply motion preference globally
  const applyMotionPreference = (preference: string) => {
    setMotionPreference(preference);
    const root = document.documentElement;
    
    if (preference === 'reduced') {
      root.style.setProperty('--animation-duration', '0.1s');
      root.style.setProperty('--transition-timing', 'ease');
      toast.info('Reduced motion enabled - animations minimized');
    } else if (preference === 'enhanced') {
      root.style.setProperty('--animation-duration', '0.8s');
      root.style.setProperty('--transition-timing', 'cubic-bezier(0.34, 1.56, 0.64, 1)');
      toast.info('Enhanced animations enabled - more dynamic effects');
    } else {
      root.style.setProperty('--animation-duration', '0.3s');
      root.style.setProperty('--transition-timing', 'ease-out');
      toast.info('Normal motion restored - standard animations');
    }
  };

  // Demonstrate different entrance animations
  const triggerEntranceAnimations = () => {
    toast.success('Slide in from right (default)');
    
    setTimeout(() => {
      banner.info('Slide down from top (banner)');
    }, 500);
    
    setTimeout(() => {
      toast.warning('Fade in with scale');
    }, 1000);
    
    setTimeout(() => {
      toast.error('Bounce entrance effect');
    }, 1500);
  };

  // Demonstrate stacking animations
  const triggerStackingDemo = () => {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        toast.info(`Notification ${i + 1}/5 - Watch stacking animation`, {
          duration: 8000 // Keep them visible longer
        });
      }, i * 200);
    }
  };

  // Demonstrate exit animations
  const triggerExitDemo = () => {
    const notifications = [
      { message: 'This will auto-dismiss in 2s', type: 'info' as const, duration: 2000 },
      { message: 'This will slide out right', type: 'success' as const, duration: 3000 },
      { message: 'This will fade out', type: 'warning' as const, duration: 4000 },
    ];
    
    notifications.forEach((notif, index) => {
      setTimeout(() => {
        toast[notif.type](notif.message, { duration: notif.duration });
      }, index * 300);
    });
    
    banner.warning('Watch the exit animations in sequence');
  };

  // Demonstrate interaction animations
  const triggerInteractionDemo = () => {
    toast.error('Hover over this notification to see interaction effects', {
      duration: 10000,
      actions: [
        { 
          label: 'Dismiss with Animation', 
          onClick: () => toast.success('Dismissed with custom animation') 
        }
      ]
    });
    
    setTimeout(() => {
      banner.info('This notification has hover and focus states', {
        persistent: true,
        actions: [
          { label: 'Test Focus', onClick: () => console.log('Button focused') },
          { label: 'Test Hover', onClick: () => console.log('Button hovered') }
        ]
      });
    }, 500);
  };

  // Performance test with many animations
  const triggerPerformanceTest = () => {
    banner.warning('Performance test: Creating many notifications rapidly');
    
    // Create many notifications quickly to test performance
    for (let i = 0; i < 15; i++) {
      setTimeout(() => {
        if (i % 3 === 0) {
          toast.success(`Batch notification ${i + 1}`);
        } else if (i % 3 === 1) {
          toast.warning(`Performance test ${i + 1}`);
        } else {
          toast.info(`Animation stress ${i + 1}`);
        }
      }, i * 50);
    }
    
    setTimeout(() => {
      banner.success('Performance test completed - all animations should be smooth');
    }, 1000);
  };

  // Accessibility-aware animations
  const triggerAccessibilityDemo = () => {
    toast.info('Testing accessibility-aware animations');
    
    setTimeout(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        toast.success('Reduced motion detected - using minimal animations');
      } else {
        toast.success('Standard motion enabled - using full animations');
      }
    }, 500);
    
    setTimeout(() => {
      banner.info('Animations respect user\'s motion preferences', {
        actions: [
          { 
            label: 'Toggle Motion', 
            onClick: () => {
              const newPreference = motionPreference === 'reduced' ? 'normal' : 'reduced';
              applyMotionPreference(newPreference);
            }
          }
        ]
      });
    }, 1000);
  };

  return (
    <div style={{ padding: '20px', minHeight: '700px', position: 'relative' }}>
      {/* Animation Controls */}
      <div style={{ 
        marginBottom: '24px', 
        padding: '16px', 
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px'
      }}>
        <h3 style={{ marginBottom: '12px', fontSize: '18px', fontWeight: 'bold' }}>
          🎬 Animation & Transition Controls
        </h3>
        
        {/* Motion Preferences */}
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Motion Preferences</h4>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button 
              size="sm" 
              variant={motionPreference === 'reduced' ? 'scout-blue' : 'outline'}
              onClick={() => applyMotionPreference('reduced')}
            >
              Reduced Motion
            </Button>
            <Button 
              size="sm" 
              variant={motionPreference === 'normal' ? 'scout-blue' : 'outline'}
              onClick={() => applyMotionPreference('normal')}
            >
              Normal Motion
            </Button>
            <Button 
              size="sm" 
              variant={motionPreference === 'enhanced' ? 'scout-blue' : 'outline'}
              onClick={() => applyMotionPreference('enhanced')}
            >
              Enhanced Motion
            </Button>
          </div>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Current: {motionPreference} | Respects prefers-reduced-motion CSS media query
          </p>
        </div>
        
        {/* Current Settings Display */}
        <div style={{ fontSize: '12px', color: '#475569', backgroundColor: '#f1f5f9', padding: '8px', borderRadius: '4px' }}>
          <strong>Active Settings:</strong> Motion = {motionPreference}, Speed = {animationSpeed}
          <br />
          <strong>CSS Variables:</strong> --animation-duration, --transition-timing applied globally
        </div>
      </div>

      {/* Animation Demos */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>
          🎭 Animation Demonstrations
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <Button variant="outline" onClick={triggerEntranceAnimations}>
            🎪 Entrance Effects
          </Button>
          <Button variant="outline" onClick={triggerStackingDemo}>
            📚 Stacking Animations
          </Button>
          <Button variant="outline" onClick={triggerExitDemo}>
            🚪 Exit Transitions
          </Button>
          <Button variant="outline" onClick={triggerInteractionDemo}>
            👆 Interaction States
          </Button>
          <Button variant="outline" onClick={triggerPerformanceTest}>
            ⚡ Performance Test
          </Button>
          <Button variant="outline" onClick={triggerAccessibilityDemo}>
            ♿ Accessibility Demo
          </Button>
        </div>
      </div>

      {/* Animation Technical Details */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>
          🔧 Technical Implementation
        </h4>
        <div style={{ display: 'grid', gap: '8px', fontSize: '12px' }}>
          <div style={{ padding: '8px', backgroundColor: '#f0f9ff', border: '1px solid #0ea5e9', borderRadius: '4px' }}>
            <strong>CSS Transforms:</strong> Use transform: translateX() for smooth hardware acceleration
          </div>
          <div style={{ padding: '8px', backgroundColor: '#f0fdf4', border: '1px solid #22c55e', borderRadius: '4px' }}>
            <strong>Timing Functions:</strong> ease-out for entrances, ease-in for exits, custom cubic-bezier for bounces
          </div>
          <div style={{ padding: '8px', backgroundColor: '#fffbeb', border: '1px solid #f59e0b', borderRadius: '4px' }}>
            <strong>Stacking Logic:</strong> Smooth repositioning when notifications are added/removed from stack
          </div>
          <div style={{ padding: '8px', backgroundColor: '#fef2f2', border: '1px solid #ef4444', borderRadius: '4px' }}>
            <strong>Performance:</strong> GPU acceleration, minimal reflows, efficient event handling
          </div>
          <div style={{ padding: '8px', backgroundColor: '#f3e8ff', border: '1px solid #a855f7', borderRadius: '4px' }}>
            <strong>Accessibility:</strong> Respects prefers-reduced-motion, maintains focus, screen reader friendly
          </div>
        </div>
      </div>

      {/* Animation States Preview */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>
          📊 Animation States Preview
        </h4>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <Button size="sm" onClick={() => toast.info('Entering...', { duration: 10000 })}>
            ↗️ Enter State
          </Button>
          <Button size="sm" onClick={() => {
            const notification = toast.warning('Hover me!', { 
              duration: 10000,
              actions: [{ label: 'Action', onClick: () => {} }]
            });
          }}>
            👆 Hover State
          </Button>
          <Button size="sm" onClick={() => toast.error('Exiting...', { duration: 1000 })}>
            ↙️ Exit State
          </Button>
          <Button size="sm" onClick={() => {
            // Create multiple notifications to show stacking
            toast.info('Stack item 1', { duration: 8000 });
            setTimeout(() => toast.info('Stack item 2', { duration: 8000 }), 100);
            setTimeout(() => toast.info('Stack item 3', { duration: 8000 }), 200);
          }}>
            📚 Stacked State
          </Button>
        </div>
      </div>

      {/* Custom Animation Showcase */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>
          ✨ Custom Animation Styles
        </h4>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button size="sm" variant="outline" onClick={() => {
            // Simulate a notification with custom animation class
            toast.success('Slide in from left!');
          }}>
            ← Slide Left
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            toast.info('Fade with scale transform!');
          }}>
            🔍 Fade + Scale
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            toast.warning('Bounce entrance effect!');
          }}>
            🏀 Bounce In
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            banner.error('Gentle slide down from top');
          }}>
            ↓ Slide Down
          </Button>
        </div>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
          💡 Each notification type can have custom entrance/exit animations
        </p>
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
        <BannerContainer maxBanners={3} position="top" />
        
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
          <h4 style={{ marginBottom: '8px' }}>Animation Playground</h4>
          <p>Test different animation effects and performance characteristics</p>
          
          <div style={{ marginTop: '20px', fontSize: '12px', opacity: 0.7 }}>
            <p>🎬 Watch entrance and exit animations</p>
            <p>👆 Hover over notifications to see interaction effects</p>
            <p>⚡ Test performance with rapid creation</p>
            <p>♿ Verify accessibility with motion preferences</p>
          </div>
        </div>
        
        <ToastContainer maxToasts={8} position="bottom-right" />
      </div>

      {/* CSS Animation Reference */}
      <div style={{ 
        marginTop: '24px', 
        padding: '12px', 
        backgroundColor: '#f8fafc', 
        border: '1px solid #e2e8f0', 
        borderRadius: '6px',
        fontSize: '11px',
        fontFamily: 'monospace'
      }}>
        <strong>CSS Animation Reference:</strong><br/>
        <code>
          @keyframes slideInRight {`{ from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}<br/>
          @keyframes slideOutRight {`{ from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }`}<br/>
          @media (prefers-reduced-motion: reduce) {`{ * { animation-duration: 0.01s !important; } }`}
        </code>
      </div>
    </div>
  );
};

// Wrapper with NotificationProvider
const AnimationWrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationProvider>
    {children}
  </NotificationProvider>
);

const meta: Meta<typeof AnimationDemo> = {
  title: 'Notifications/Animation & Transitions',
  component: AnimationDemo,
  decorators: [
    (Story) => (
      <AnimationWrapper>
        <Story />
      </AnimationWrapper>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
Comprehensive demonstration of the notification system's animation and transition capabilities, including accessibility considerations and performance optimization.

**Animation Features:**

🎬 **Entrance Animations**
- Slide-in transitions from appropriate directions
- Fade-in effects with optional scaling
- Bounce effects for emphasis
- Hardware-accelerated transforms for smooth performance

🚪 **Exit Animations**
- Smooth slide-out transitions
- Fade-out with optional scaling
- Coordinated timing with stacking adjustments
- Interrupt-safe animation handling

📚 **Stacking Animations**
- Smooth repositioning when notifications are added/removed
- Coordinated movement of multiple notifications
- Z-index management for proper layering
- Performance-optimized batch updates

👆 **Interaction States**
- Hover effects with smooth transitions
- Focus indicators for keyboard navigation
- Active states for touch interaction
- Button hover effects within notifications

**Accessibility & Performance:**

♿ **Motion Accessibility**
- Respects \`prefers-reduced-motion\` media query
- Provides user controls for motion preferences
- Maintains functionality with minimal animations
- Screen reader friendly transition announcements

⚡ **Performance Optimization**
- GPU acceleration using CSS transforms
- Efficient event handling and cleanup
- Minimal DOM reflows and repaints
- Optimized animation queuing for rapid notifications

🎛️ **Customization Options**
- Configurable animation duration and timing
- Custom easing functions (cubic-bezier)
- Per-notification animation overrides
- Global motion preference controls

**Technical Implementation:**

- **CSS Variables:** \`--animation-duration\`, \`--transition-timing\` for consistent theming
- **Transform-based:** Uses \`transform: translateX/Y()\` for optimal performance
- **Event-driven:** Animation states managed through component lifecycle
- **Accessible:** Maintains focus management during transitions

**Testing Scenarios:**
1. **Motion Preferences:** Test with reduced, normal, and enhanced motion settings
2. **Performance:** Rapid notification creation to verify smooth animations
3. **Interaction:** Hover, focus, and touch interaction testing
4. **Stacking:** Multiple notifications with coordinated movement
5. **Accessibility:** Screen reader compatibility and keyboard navigation
        `,
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const AnimationDemo: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Interactive playground for testing animation and transition effects.',
      },
    },
  },
};

// Reduced motion story
export const ReducedMotion: Story = {
  render: () => {
    const ReducedMotionDemo = () => {
      const { toast } = useNotificationUtils();
      
      React.useEffect(() => {
        // Apply reduced motion on load
        const root = document.documentElement;
        root.style.setProperty('--animation-duration', '0.1s');
        
        // Show example
        setTimeout(() => {
          toast.info('Reduced motion demo - minimal animations');
        }, 500);
        
        return () => {
          root.style.setProperty('--animation-duration', '0.3s');
        };
      }, [toast]);
      
      return (
        <div style={{ padding: '20px', minHeight: '300px', position: 'relative' }}>
          <h3>Reduced Motion Mode</h3>
          <p>Demonstrates minimal animations for motion-sensitive users</p>
          <Button onClick={() => toast.success('Minimal animation example')}>
            Test Reduced Motion
          </Button>
          <ToastContainer maxToasts={3} position="top-right" />
        </div>
      );
    };
    
    return (
      <NotificationProvider>
        <ReducedMotionDemo />
      </NotificationProvider>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates reduced motion animations for accessibility.',
      },
    },
  },
};

export const PerformanceStressTest: Story = {
  render: () => {
    const StressTestDemo = () => {
      const { toast, banner } = useNotificationUtils();
      
      const runStressTest = () => {
        banner.info('Running animation stress test...');
        
        // Create many notifications rapidly
        for (let i = 0; i < 20; i++) {
          setTimeout(() => {
            toast.info(`Stress test notification ${i + 1}/20`);
          }, i * 50);
        }
        
        setTimeout(() => {
          banner.success('Stress test completed - check for smooth animations');
        }, 1500);
      };
      
      return (
        <div style={{ padding: '20px', minHeight: '400px', position: 'relative' }}>
          <h3>Performance Stress Test</h3>
          <p>Tests animation performance with rapid notification creation</p>
          <Button onClick={runStressTest}>Run Stress Test (20 notifications)</Button>
          
          <BannerContainer maxBanners={2} position="top" />
          <ToastContainer maxToasts={10} position="bottom-right" />
        </div>
      );
    };
    
    return (
      <NotificationProvider>
        <StressTestDemo />
      </NotificationProvider>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Performance test with rapid notification creation to verify smooth animations.',
      },
    },
  },
};