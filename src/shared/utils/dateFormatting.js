/**
 * Date formatting utilities for the Viking Event Management application
 */

/**
 * Formats a date string to UK datetime format (DD/MM/YYYY HH:MM)
 * @param {string} dateString - The date string to format
 * @returns {string} Formatted date string or '---' if invalid
 */
export const formatUKDateTime = (dateString) => {
  if (!dateString) return '';

  // Handle cleared/placeholder values including single space from time field clearing
  if (dateString === '---' || dateString.trim() === '') return '---';

  try {
    const date = new Date(dateString);

    // Check if date is invalid (NaN)
    if (isNaN(date.getTime())) {
      return '---';
    }

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Failed to format date:', dateString, error);
    }
    return '---';
  }
};