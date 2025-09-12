import { useState } from 'react';

// This component has no JSDoc documentation
export const BadComponent = ({ title, count, onCountChange }) => {
  const [currentCount, setCurrentCount] = useState(count);

  // No JSDoc for this function
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

// Missing JSDoc documentation
export const useBadCounter = (initialValue = 0) => {
  const [count, setCount] = useState(initialValue);

  const increment = () => setCount(prev => prev + 1);
  const decrement = () => setCount(prev => prev - 1);
  const reset = () => setCount(initialValue);

  return { count, increment, decrement, reset };
};

/**
 * This function has incomplete JSDoc - missing parameters and return description
 */
export const incompleteDoc = (value, locale) => {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new Error('Value must be a valid number');
  }
  
  return value.toLocaleString(locale);
};

/**
 * Missing parameter descriptions
 * @param numbers
 * @param multiplier
 */
export const missingParamDescriptions = (numbers, multiplier = 1) => {
  return numbers
    .filter(num => typeof num === 'number' && !isNaN(num))
    .reduce((sum, num) => sum + (num * multiplier), 0);
};

/**
 * This has invalid JSDoc syntax and wrong parameter names
 * @param {Array<number>} wrongName - This parameter name doesn't match
 * @param {string} anotherWrong - This parameter doesn't exist
 * @returns The return description is missing type
 */
export const wrongParameterNames = (numbers = []) => {
  return numbers.length;
};

// Arrow function with no documentation at all
export const undocumentedArrow = (data) => data.map(item => item * 2);

// Function with missing return documentation
/**
 * Processes data but doesn't document what it returns
 * @param {Array} data - Input data
 */
export const missingReturnDoc = (data) => {
  return data.filter(Boolean);
};

// Default export with no documentation
const undocumentedDefault = (items) => items.sort();

export default undocumentedDefault;