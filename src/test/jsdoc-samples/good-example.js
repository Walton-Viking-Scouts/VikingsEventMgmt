import { useState } from 'react';

/**
 * A sample React component that demonstrates proper JSDoc documentation.
 *
 * This component shows how to properly document React components with
 * parameters, return values, and descriptions.
 *
 * @component
 * @param {object} props - The component props
 * @param {string} props.title - The title to display
 * @param {number} props.count - Initial count value
 * @param {Function} props.onCountChange - Callback when count changes
 * @returns {ReactElement} The rendered component
 * @example
 * <SampleComponent
 *   title="My Counter"
 *   count={0}
 *   onCountChange={(newCount) => console.log(newCount)}
 * />
 */
export const SampleComponent = ({ title, count = 0, onCountChange }) => {
  const [currentCount, setCurrentCount] = useState(count);

  /**
   * Handles incrementing the counter.
   *
   * Updates the internal state and calls the onCountChange callback
   * with the new value.
   *
   * @returns {void}
   */
  const handleIncrement = () => {
    const newCount = currentCount + 1;
    setCurrentCount(newCount);
    onCountChange?.(newCount);
  };

  return (
    <div>
      <h2>{title}</h2>
      <p>Count: {currentCount}</p>
      <button onClick={handleIncrement}>Increment</button>
    </div>
  );
};

/**
 * Custom hook for managing counter state.
 *
 * Provides counter functionality with increment, decrement, and reset operations.
 *
 * @hook
 * @param {number} initialValue - The initial counter value
 * @returns {{count: number, increment: Function, decrement: Function, reset: Function}} The counter state and controls
 * @example
 * const { count, increment, decrement, reset } = useCounter(0);
 */
export const useCounter = (initialValue = 0) => {
  const [count, setCount] = useState(initialValue);

  /**
   * Increments the counter by 1.
   *
   * @returns {void}
   */
  const increment = () => setCount(prev => prev + 1);

  /**
   * Decrements the counter by 1.
   *
   * @returns {void}
   */
  const decrement = () => setCount(prev => prev - 1);

  /**
   * Resets the counter to the initial value.
   *
   * @returns {void}
   */
  const reset = () => setCount(initialValue);

  return { count, increment, decrement, reset };
};

/**
 * Utility function to format numbers with proper separators.
 *
 * Takes a numeric value and returns it formatted with thousand separators
 * using the user's locale.
 *
 * @param {number} value - The number to format
 * @param {string} locale - The locale to use for formatting (defaults to 'en-US')
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
 * Default export function that calculates the sum of an array.
 *
 * Takes an array of numbers and returns their sum. Handles empty arrays
 * and filters out non-numeric values.
 *
 * @param {Array<number>} numbers - Array of numbers to sum
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