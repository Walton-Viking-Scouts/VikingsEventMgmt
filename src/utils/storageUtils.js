// Safe storage utilities

/**
 * Safely get and parse an item from localStorage
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key doesn't exist or parsing fails
 * @returns {*} Parsed value or default value
 */
export function safeGetItem(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Failed to parse storage item ${key}:`, error);
    return defaultValue;
  }
}

/**
 * Safely set an item in localStorage with JSON serialization
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 * @returns {boolean} True if successful, false otherwise
 */
export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Failed to set storage item ${key}:`, error);
    return false;
  }
}

/**
 * Safely get and parse an item from sessionStorage
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key doesn't exist or parsing fails
 * @returns {*} Parsed value or default value
 */
export function safeGetSessionItem(key, defaultValue = null) {
  try {
    const item = sessionStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Failed to parse session storage item ${key}:`, error);
    return defaultValue;
  }
}

/**
 * Safely set an item in sessionStorage with JSON serialization
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 * @returns {boolean} True if successful, false otherwise
 */
export function safeSetSessionItem(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Failed to set session storage item ${key}:`, error);
    return false;
  }
}