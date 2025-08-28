import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  ErrorIcon,
  WarningIcon,
  InfoIcon,
  SuccessIcon,
  notificationStyles,
  animations,
  getNotificationStyles,
  getAnimationClasses,
  getNotificationClasses,
  getNotificationIcon,
  isDefaultPersistent,
  getRecommendedDuration,
  getAccessibilityAttributes,
  type NotificationType
} from './NotificationStyles';

describe('NotificationStyles', () => {
  describe('Icon Components', () => {
    it('should render ErrorIcon with correct classes', () => {
      const { container } = render(<ErrorIcon />);
      const icon = container.querySelector('svg');
      expect(icon).toHaveClass('h-5', 'w-5', 'text-red-500', 'dark:text-red-400');
    });

    it('should render WarningIcon with correct classes', () => {
      const { container } = render(<WarningIcon />);
      const icon = container.querySelector('svg');
      expect(icon).toHaveClass('h-5', 'w-5', 'text-yellow-500', 'dark:text-yellow-400');
    });

    it('should render InfoIcon with correct classes', () => {
      const { container } = render(<InfoIcon />);
      const icon = container.querySelector('svg');
      expect(icon).toHaveClass('h-5', 'w-5', 'text-blue-500', 'dark:text-blue-400');
    });

    it('should render SuccessIcon with correct classes', () => {
      const { container } = render(<SuccessIcon />);
      const icon = container.querySelector('svg');
      expect(icon).toHaveClass('h-5', 'w-5', 'text-green-500', 'dark:text-green-400');
    });
  });

  describe('notificationStyles object', () => {
    it('should contain all required notification types', () => {
      expect(notificationStyles).toHaveProperty('error');
      expect(notificationStyles).toHaveProperty('warning');
      expect(notificationStyles).toHaveProperty('info');
      expect(notificationStyles).toHaveProperty('success');
      expect(notificationStyles).toHaveProperty('custom');
    });

    it('should have consistent style properties for each type', () => {
      Object.values(notificationStyles).forEach(style => {
        expect(style).toHaveProperty('background');
        expect(style).toHaveProperty('text');
        expect(style).toHaveProperty('border');
        expect(style).toHaveProperty('icon');
        
        expect(typeof style.background).toBe('string');
        expect(typeof style.text).toBe('string');
        expect(typeof style.border).toBe('string');
      });
    });

    it('should have dark mode classes for all color styles', () => {
      const styleEntries = Object.entries(notificationStyles);
      styleEntries.forEach(([type, style]) => {
        if (type !== 'custom') {
          expect(style.background).toContain('dark:');
          expect(style.text).toContain('dark:');
          expect(style.border).toContain('dark:');
        }
      });
    });

    it('should have appropriate color schemes for each type', () => {
      expect(notificationStyles.error.background).toContain('red');
      expect(notificationStyles.error.text).toContain('red');
      expect(notificationStyles.error.border).toContain('red');

      expect(notificationStyles.warning.background).toContain('yellow');
      expect(notificationStyles.warning.text).toContain('yellow');
      expect(notificationStyles.warning.border).toContain('yellow');

      expect(notificationStyles.info.background).toContain('blue');
      expect(notificationStyles.info.text).toContain('blue');
      expect(notificationStyles.info.border).toContain('blue');

      expect(notificationStyles.success.background).toContain('green');
      expect(notificationStyles.success.text).toContain('green');
      expect(notificationStyles.success.border).toContain('green');
    });
  });

  describe('animations object', () => {
    it('should contain animation classes for toast and banner', () => {
      expect(animations).toHaveProperty('toast');
      expect(animations).toHaveProperty('banner');
    });

    it('should have all required animation states', () => {
      ['toast', 'banner'].forEach(componentType => {
        expect(animations[componentType as keyof typeof animations]).toHaveProperty('enter');
        expect(animations[componentType as keyof typeof animations]).toHaveProperty('enterActive');
        expect(animations[componentType as keyof typeof animations]).toHaveProperty('exit');
        expect(animations[componentType as keyof typeof animations]).toHaveProperty('exitActive');
      });
    });

    it('should contain valid CSS transition classes', () => {
      Object.values(animations).forEach(animationSet => {
        Object.values(animationSet).forEach(animationClass => {
          expect(typeof animationClass).toBe('string');
          expect(animationClass.length).toBeGreaterThan(0);
          // Should contain transition-related classes
          expect(animationClass).toMatch(/(transition|transform|opacity|translate)/);
        });
      });
    });
  });

  describe('getNotificationStyles', () => {
    it('should return correct styles for valid types', () => {
      const types: NotificationType[] = ['error', 'warning', 'info', 'success', 'custom'];
      
      types.forEach(type => {
        const styles = getNotificationStyles(type);
        expect(styles).toEqual(notificationStyles[type]);
      });
    });

    it('should return info styles as default for undefined type', () => {
      const styles = getNotificationStyles();
      expect(styles).toEqual(notificationStyles.info);
    });

    it('should return info styles for invalid type', () => {
      const styles = getNotificationStyles('invalid' as NotificationType);
      expect(styles).toEqual(notificationStyles.info);
    });
  });

  describe('getAnimationClasses', () => {
    it('should return correct animation classes for toast', () => {
      expect(getAnimationClasses('toast', 'enter')).toBe(animations.toast.enter);
      expect(getAnimationClasses('toast', 'enterActive')).toBe(animations.toast.enterActive);
      expect(getAnimationClasses('toast', 'exit')).toBe(animations.toast.exit);
      expect(getAnimationClasses('toast', 'exitActive')).toBe(animations.toast.exitActive);
    });

    it('should return correct animation classes for banner', () => {
      expect(getAnimationClasses('banner', 'enter')).toBe(animations.banner.enter);
      expect(getAnimationClasses('banner', 'enterActive')).toBe(animations.banner.enterActive);
      expect(getAnimationClasses('banner', 'exit')).toBe(animations.banner.exit);
      expect(getAnimationClasses('banner', 'exitActive')).toBe(animations.banner.exitActive);
    });
  });

  describe('getNotificationClasses', () => {
    it('should return combined classes for toast', () => {
      const classes = getNotificationClasses('error', 'toast');
      
      expect(classes).toHaveProperty('container');
      expect(classes).toHaveProperty('text');
      expect(classes).toHaveProperty('icon');
      expect(classes).toHaveProperty('animations');
      
      expect(classes.container).toContain('bg-red-100');
      expect(classes.container).toContain('border-red-400');
      expect(classes.container).toContain('rounded-md');
      expect(classes.container).toContain('p-4');
      expect(classes.container).toContain('shadow-lg');
      
      expect(classes.text).toBe(notificationStyles.error.text);
      expect(classes.animations).toBe(animations.toast);
    });

    it('should return combined classes for banner', () => {
      const classes = getNotificationClasses('success', 'banner');
      
      expect(classes.container).toContain('bg-green-100');
      expect(classes.container).toContain('border-green-400');
      expect(classes.text).toBe(notificationStyles.success.text);
      expect(classes.animations).toBe(animations.banner);
    });

    it('should use info as default type', () => {
      const classes = getNotificationClasses(undefined, 'toast');
      expect(classes.container).toContain('bg-blue-100');
      expect(classes.text).toBe(notificationStyles.info.text);
    });
  });

  describe('getNotificationIcon', () => {
    it('should return correct icon components for each type', () => {
      const { container: errorContainer } = render(<>{getNotificationIcon('error')}</>);
      const { container: warningContainer } = render(<>{getNotificationIcon('warning')}</>);
      const { container: infoContainer } = render(<>{getNotificationIcon('info')}</>);
      const { container: successContainer } = render(<>{getNotificationIcon('success')}</>);
      
      expect(errorContainer.querySelector('svg')).toHaveClass('text-red-500');
      expect(warningContainer.querySelector('svg')).toHaveClass('text-yellow-500');
      expect(infoContainer.querySelector('svg')).toHaveClass('text-blue-500');
      expect(successContainer.querySelector('svg')).toHaveClass('text-green-500');
    });

    it('should return null for custom type', () => {
      const icon = getNotificationIcon('custom');
      expect(icon).toBeNull();
    });

    it('should return info icon as fallback for invalid type', () => {
      const icon = getNotificationIcon('invalid' as NotificationType);
      const { container } = render(<>{icon}</>);
      expect(container.querySelector('svg')).toHaveClass('text-blue-500');
    });
  });

  describe('isDefaultPersistent', () => {
    it('should return true only for error type', () => {
      expect(isDefaultPersistent('error')).toBe(true);
      expect(isDefaultPersistent('warning')).toBe(false);
      expect(isDefaultPersistent('info')).toBe(false);
      expect(isDefaultPersistent('success')).toBe(false);
      expect(isDefaultPersistent('custom')).toBe(false);
    });
  });

  describe('getRecommendedDuration', () => {
    it('should return appropriate durations for each type', () => {
      expect(getRecommendedDuration('error')).toBe(8000);
      expect(getRecommendedDuration('warning')).toBe(6000);
      expect(getRecommendedDuration('info')).toBe(5000);
      expect(getRecommendedDuration('success')).toBe(5000);
      expect(getRecommendedDuration('custom')).toBe(5000);
    });

    it('should return info duration as fallback', () => {
      const duration = getRecommendedDuration('invalid' as NotificationType);
      expect(duration).toBe(5000);
    });
  });

  describe('getAccessibilityAttributes', () => {
    it('should return correct attributes for error notifications', () => {
      const attrs = getAccessibilityAttributes('error', 'Test error message');
      
      expect(attrs.role).toBe('alert');
      expect(attrs['aria-live']).toBe('assertive');
      expect(attrs['aria-atomic']).toBe(true);
      expect(attrs['aria-label']).toBe('error notification: Test error message');
    });

    it('should return correct attributes for warning notifications', () => {
      const attrs = getAccessibilityAttributes('warning', 'Test warning message');
      
      expect(attrs.role).toBe('alert');
      expect(attrs['aria-live']).toBe('assertive');
      expect(attrs['aria-atomic']).toBe(true);
      expect(attrs['aria-label']).toBe('warning notification: Test warning message');
    });

    it('should return correct attributes for info notifications', () => {
      const attrs = getAccessibilityAttributes('info', 'Test info message');
      
      expect(attrs.role).toBe('status');
      expect(attrs['aria-live']).toBe('polite');
      expect(attrs['aria-atomic']).toBe(true);
      expect(attrs['aria-label']).toBe('info notification: Test info message');
    });

    it('should return correct attributes for success notifications', () => {
      const attrs = getAccessibilityAttributes('success', 'Test success message');
      
      expect(attrs.role).toBe('status');
      expect(attrs['aria-live']).toBe('polite');
      expect(attrs['aria-atomic']).toBe(true);
      expect(attrs['aria-label']).toBe('success notification: Test success message');
    });

    it('should return correct attributes for custom notifications', () => {
      const attrs = getAccessibilityAttributes('custom', 'Test custom message');
      
      expect(attrs.role).toBe('status');
      expect(attrs['aria-live']).toBe('polite');
      expect(attrs['aria-atomic']).toBe(true);
      expect(attrs['aria-label']).toBe('custom notification: Test custom message');
    });
  });

  describe('Type Safety', () => {
    it('should properly type notification styles', () => {
      // This test ensures TypeScript compilation - if it compiles, types are correct
      const errorStyle: typeof notificationStyles.error = notificationStyles.error;
      expect(errorStyle.background).toBeDefined();
      expect(errorStyle.text).toBeDefined();
      expect(errorStyle.border).toBeDefined();
      expect(errorStyle.icon).toBeDefined();
    });
  });
});