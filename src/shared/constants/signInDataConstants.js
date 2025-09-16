/**
 * Sign-in data clearing constants
 *
 * These constants ensure consistent clearing behavior between individual and bulk operations
 */

// Text field clearing value - used for SignedInBy and SignedOutBy
export const CLEAR_STRING_SENTINEL = '---';

// Time field clearing value - used for SignedInWhen and SignedOutWhen
// Single space is used for API compatibility with OSM's multiUpdate endpoint
export const CLEAR_TIME_SENTINEL = ' ';

// Helper function to check if a value represents a cleared field
export const isFieldCleared = (value) => {
  if (!value) return true;
  return value === CLEAR_STRING_SENTINEL || value === CLEAR_TIME_SENTINEL;
};

// Helper function to check if a time field is cleared
export const isTimeFieldCleared = (value) => {
  if (!value) return true;
  return value === CLEAR_TIME_SENTINEL || value.trim() === '';
};

// Helper function to normalize clearing values for display
export const normalizeForDisplay = (value) => {
  if (isFieldCleared(value)) {
    return '';
  }
  return value;
};

/**
 * Normalizes when field values to ensure consistent display and prevent NaN issues
 *
 * @param {*} value - Raw when field value from FlexiRecord
 * @returns {string|null} Normalized value - null for empty/invalid dates, original string for valid dates
 */
export const normalizeWhenFieldForDisplay = (value) => {
  // Handle null, undefined, empty string, and space-only values
  if (!value || typeof value !== 'string' || value.trim() === '' || value.trim() === ' ') {
    return null; // Return null for truly empty values
  }

  // Handle special placeholder values that indicate empty/cleared fields
  if (value === CLEAR_STRING_SENTINEL || value === 'null' || value === 'undefined' || value === 'NaN' || value === 'Invalid Date') {
    return null;
  }

  // Try to parse as date to validate
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      // Invalid date - return null instead of the invalid value
      return null;
    }
    // Return the original value if it's a valid date string
    return value;
  } catch (error) {
    // Parsing failed - return null
    return null;
  }
};