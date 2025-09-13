import clsx from 'clsx';

/**
 * Utility function for conditionally joining class names
 * Uses clsx for better performance and conditional logic support
 * 
 * @param {...any} classes - Class names, objects, or arrays to join
 * @returns {string} Joined class names string
 * 
 * @example
 * cn('base', condition && 'conditional', { 'active': isActive })
 * cn(['base', 'other'], { 'variant': true })
 */
export function cn(...classes) {
  return clsx(classes);
}