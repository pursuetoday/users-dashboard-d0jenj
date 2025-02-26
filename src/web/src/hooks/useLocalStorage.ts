/**
 * A custom React hook that provides persistent state management using browser's localStorage
 * with type safety, serialization, error handling, and cross-tab synchronization capabilities.
 * 
 * Features:
 * - Type-safe storage with TypeScript generics
 * - Lazy initialization to prevent unnecessary storage operations
 * - Automatic storage synchronization across tabs/windows
 * - Comprehensive error handling and recovery
 * - Storage availability detection and fallbacks
 * 
 * @template T The type of the state to be stored
 * @param {string} key The storage key to use in localStorage
 * @param {T} initialValue The initial value or value factory function
 * @returns {[T, (value: T | ((val: T) => T)) => void]} A stateful value and a function to update it
 * 
 * @example
 * // Store a string value
 * const [username, setUsername] = useLocalStorage<string>('username', '');
 * 
 * // Store an object
 * const [userPreferences, setUserPreferences] = useLocalStorage<UserPreferences>(
 *   'user-preferences', 
 *   { theme: 'light', fontSize: 'medium' }
 * );
 * 
 * // Use with state updater pattern
 * setUserPreferences(prev => ({ ...prev, theme: 'dark' }));
 */
import { useState, useEffect } from 'react'; // React v18.x
import { StorageType, getItem, setItem } from '../utils/storage.utils';

export function useLocalStorage<T>(key: string, initialValue: T): [
  T,
  (value: T | ((val: T) => T)) => void
] {
  // State initialization with lazy evaluation to avoid unnecessary storage reads
  // Only run storage retrieval logic once during component initialization
  const [storedValue, setStoredValue] = useState<T>(() => {
    // Validate storage key
    if (!key || typeof key !== 'string' || key.trim() === '') {
      console.error('useLocalStorage: Key must be a non-empty string');
      return initialValue;
    }

    try {
      // Skip storage operations in non-browser environments (SSR)
      if (typeof window === 'undefined') {
        return initialValue;
      }

      // Get value from localStorage using utility function that handles:
      // - Storage availability checking
      // - Error handling
      // - Data parsing and validation
      const value = getItem<T>(key, StorageType.Local);
      
      // Return the stored value if found, otherwise use initialValue
      return value !== null ? value : initialValue;
    } catch (error) {
      // Log detailed error and fall back to initial value for resilience
      console.error(`useLocalStorage: Error reading from localStorage (key: "${key}"):`, error);
      return initialValue;
    }
  });

  // State setter function that updates both React state and localStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Handle functional updates (same pattern as React's setState)
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Update React state with new value
      setStoredValue(valueToStore);
      
      // Skip persistence in non-browser environments
      if (typeof window === 'undefined') {
        return;
      }
      
      // Persist value to localStorage using utility function that handles:
      // - Storage availability checking
      // - Data serialization
      // - Quota management
      // - Error handling
      setItem<T>(key, valueToStore, StorageType.Local);
    } catch (error) {
      // Log detailed error information
      console.error(`useLocalStorage: Error writing to localStorage (key: "${key}"):`, error);
      
      // We don't revert the React state here since it would create a
      // confusing UX with state not matching what the user just entered
    }
  };

  // Set up cross-tab/window synchronization via the 'storage' event
  useEffect(() => {
    // Skip setup in non-browser environments or for invalid keys
    if (typeof window === 'undefined' || !key) {
      return;
    }

    // Handle changes made to localStorage in other tabs/windows
    const handleStorageChange = (event: StorageEvent) => {
      // Only respond to changes for our specific key in localStorage
      if (event.key === key && event.storageArea === window.localStorage) {
        try {
          // Handle key removal case
          if (event.newValue === null) {
            // We don't reset to initial value automatically since
            // it might disrupt the user's current operation
            return;
          }
          
          // Parse and validate the new value
          const newValue = JSON.parse(event.newValue) as T;
          
          // Update state with the new value (directly to avoid writing back)
          setStoredValue(newValue);
        } catch (error) {
          console.error(`useLocalStorage: Error handling storage event (key: "${key}"):`, error);
        }
      }
    };

    // Register event handler
    window.addEventListener('storage', handleStorageChange);
    
    // Clean up on unmount or when key changes
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key]); // Only re-register if the key changes

  // Return the current value and the setter function
  return [storedValue, setValue];
}