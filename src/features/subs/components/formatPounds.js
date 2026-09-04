/**
 * Currency formatting shared by the subs components.
 *
 * @module formatPounds
 */

/**
 * Formats a number as pounds sterling, dropping decimals when whole.
 *
 * @param {number} amount - Amount in pounds
 * @returns {string} Formatted amount, e.g. "£78"
 */
export function formatPounds(amount) {
  const value = Number(amount) || 0;
  return Number.isInteger(value) ? `£${value}` : `£${value.toFixed(2)}`;
}

export default formatPounds;
