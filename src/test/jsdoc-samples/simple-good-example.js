/**
 * Utility function to format numbers with proper separators.
 *
 * Takes a numeric value and returns it formatted with thousand separators
 * using the user's locale.
 *
 * @param {number} value - The number to format
 * @param {string} [locale='en-US'] - The locale to use for formatting
 * @returns {string} The formatted number string
 * @throws {Error} When value is not a number
 * @example
 * formatNumber(1234.56); // "1,234.56"
 * formatNumber(1000, 'de-DE'); // "1.000"
 */
export const formatNumber = (value, locale = 'en-US') => {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new Error('Value must be a valid number');
  }
  
  return value.toLocaleString(locale);
};

/**
 * Calculates the sum of an array of numbers.
 *
 * Takes an array of numbers and returns their sum. Handles empty arrays
 * and filters out non-numeric values.
 *
 * @param {number[]} numbers - Array of numbers to sum
 * @returns {number} The sum of all valid numbers in the array
 * @example
 * calculateSum([1, 2, 3]); // 6
 * calculateSum([]); // 0
 * calculateSum([1, 'invalid', 3]); // 4
 */
const calculateSum = (numbers = []) => {
  return numbers
    .filter(num => typeof num === 'number' && !isNaN(num))
    .reduce((sum, num) => sum + num, 0);
};

export default calculateSum;