import { useEffect, useState } from 'react'; // react ^18.0.0

/**
 * A custom hook that returns a debounced version of the provided value.
 * Useful for optimizing performance in search inputs and other frequently changing values.
 * 
 * @template T - The type of the value being debounced
 * @param {T} value - The value to debounce
 * @param {number} delay - The delay in milliseconds before updating the debounced value
 * @returns {T} - The debounced value
 * 
 * @example
 * // Search input with debounce
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearchTerm = useDebounce(searchTerm, 300);
 * 
 * useEffect(() => {
 *   // Only fetch results when debouncedSearchTerm changes
 *   fetchSearchResults(debouncedSearchTerm);
 * }, [debouncedSearchTerm]);
 */
function useDebounce<T>(value: T, delay: number): T {
  // State to store the debounced value
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up a timer to update the debounced value after the specified delay
    const timerId = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up function to clear the timeout if value changes before the delay period
    // or if the component unmounts
    return () => {
      clearTimeout(timerId);
    };
  }, [value, delay]); // Only re-run the effect if value or delay changes

  return debouncedValue;
}

export default useDebounce;