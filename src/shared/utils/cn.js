import clsx from 'clsx';

/**
 * Utility function for conditionally joining class names
 * Uses clsx for better performance and conditional logic support
 * 
 * Examples:
 * cn('base', condition && 'conditional', { 'active': isActive })
 * cn(['base', 'other'], { 'variant': true })
 */

export function cn(...classes) {
  return clsx(classes);
}