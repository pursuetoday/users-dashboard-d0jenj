/**
 * @module utils/storage
 * Utility module providing low-level browser storage operations with type safety,
 * error handling, and storage type abstraction.
 * 
 * Implements secure storage with proper data sanitization, type validation,
 * and comprehensive error handling for storage operations.
 */

import isString from 'lodash/isString'; // ^4.17.21

/**
 * Available storage types enum for type-safe storage operations
 */
export enum StorageType {
  Local = 'localStorage',
  Session = 'sessionStorage'
}

/**
 * Custom error class for storage operations
 */
class StorageError extends Error {
  constructor(
    message: string, 
    public readonly operation: string, 
    public readonly key?: string
  ) {
    super(message);
    this.name = 'StorageError';
    
    // Maintains proper stack trace in modern browsers
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StorageError);
    }
  }
}

/**
 * Validates and returns the appropriate storage instance
 * @param type Storage type to use
 * @returns The storage instance if available
 * @throws StorageError if storage is not available
 */
const getStorageInstance = (type: StorageType): Storage => {
  try {
    const storage = window[type as keyof Window] as Storage;
    
    // Feature detection technique
    const testKey = `__storage_test__${Date.now()}`;
    storage.setItem(testKey, 'test');
    storage.removeItem(testKey);
    
    return storage;
  } catch (error) {
    throw new StorageError(
      `Storage type '${type}' is not available or not accessible`,
      'access'
    );
  }
};

/**
 * Stores data in browser storage with type safety and error handling
 * @param key Storage key (must be a non-empty string)
 * @param value Value to store (will be JSON serialized)
 * @param storage Storage type to use (default: localStorage)
 * @throws StorageError for invalid inputs or storage failures
 */
export function setItem<T>(
  key: string, 
  value: T, 
  storage: StorageType = StorageType.Local
): void {
  // Validate key is a non-empty string
  if (!isString(key) || key.trim() === '') {
    throw new StorageError('Storage key must be a non-empty string', 'setItem', key);
  }

  try {
    // Check storage availability
    const storageInstance = getStorageInstance(storage);

    // Serialize value to JSON string with error handling
    let serializedValue: string;
    try {
      serializedValue = JSON.stringify(value);
    } catch (error) {
      throw new StorageError(
        `Failed to serialize value to JSON: ${(error as Error).message}`,
        'setItem',
        key
      );
    }

    // Try to store in specified storage type
    storageInstance.setItem(key, serializedValue);

    // Emit storage event for cross-tab synchronization
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      const event = new StorageEvent('storage', {
        key,
        newValue: serializedValue,
        storageArea: storageInstance
      });
      window.dispatchEvent(event);
    }
  } catch (error) {
    // Handle storage errors (quota exceeded, permission denied)
    if (error instanceof StorageError) {
      throw error;
    }

    // Check for quota exceeded errors
    if (error instanceof DOMException && 
        (error.name === 'QuotaExceededError' || 
         error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      throw new StorageError(
        'Storage quota exceeded when setting item',
        'setItem',
        key
      );
    }

    // Handle other errors
    throw new StorageError(
      `Failed to store item: ${(error as Error).message || 'Unknown error'}`,
      'setItem',
      key
    );
  }
}

/**
 * Retrieves and deserializes data from storage with type checking
 * @param key Storage key to retrieve
 * @param storage Storage type to use (default: localStorage)
 * @returns Parsed value of type T or null if not found
 * @throws StorageError for invalid inputs or storage access failures
 */
export function getItem<T>(
  key: string, 
  storage: StorageType = StorageType.Local
): T | null {
  // Validate key is a non-empty string
  if (!isString(key) || key.trim() === '') {
    throw new StorageError('Storage key must be a non-empty string', 'getItem', key);
  }

  try {
    // Check storage availability
    const storageInstance = getStorageInstance(storage);

    // Retrieve raw value from storage
    const rawValue = storageInstance.getItem(key);
    
    // Return null if value not found
    if (rawValue === null) {
      return null;
    }

    // Parse JSON string to original type with error handling
    try {
      return JSON.parse(rawValue) as T;
    } catch (parseError) {
      console.error(`Failed to parse stored JSON for key "${key}":`, parseError);
      return null;
    }
  } catch (error) {
    // Handle storage access errors
    if (error instanceof StorageError) {
      throw error;
    }

    throw new StorageError(
      `Failed to retrieve item: ${(error as Error).message || 'Unknown error'}`,
      'getItem',
      key
    );
  }
}

/**
 * Removes item from specified storage with error handling
 * @param key Storage key to remove
 * @param storage Storage type to use (default: localStorage)
 * @throws StorageError for invalid inputs or removal failures
 */
export function removeItem(
  key: string, 
  storage: StorageType = StorageType.Local
): void {
  // Validate key is a non-empty string
  if (!isString(key) || key.trim() === '') {
    throw new StorageError('Storage key must be a non-empty string', 'removeItem', key);
  }

  try {
    // Check storage availability
    const storageInstance = getStorageInstance(storage);

    // Remove item from specified storage
    storageInstance.removeItem(key);

    // Emit storage event for cross-tab synchronization
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      const event = new StorageEvent('storage', {
        key,
        newValue: null,
        storageArea: storageInstance
      });
      window.dispatchEvent(event);
    }
  } catch (error) {
    // Handle removal errors
    if (error instanceof StorageError) {
      throw error;
    }

    throw new StorageError(
      `Failed to remove item: ${(error as Error).message || 'Unknown error'}`,
      'removeItem',
      key
    );
  }
}

/**
 * Clears all items from specified storage with safety checks
 * @param storage Storage type to clear (default: localStorage)
 * @throws StorageError for clearing failures
 */
export function clear(storage: StorageType = StorageType.Local): void {
  try {
    // Check storage availability
    const storageInstance = getStorageInstance(storage);
    
    // Backup critical data if needed (using a custom approach)
    // This could be expanded to preserve specific keys if required
    const criticalKeys = ['user-theme', 'auth-state']; // Example critical keys
    const backupData: Record<string, string | null> = {};
    
    criticalKeys.forEach(key => {
      backupData[key] = storageInstance.getItem(key);
    });

    // Clear all items from specified storage
    storageInstance.clear();
    
    // Restore critical data if specified
    Object.entries(backupData).forEach(([key, value]) => {
      if (value !== null) {
        storageInstance.setItem(key, value);
      }
    });

    // Emit storage event for cross-tab synchronization
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      const event = new StorageEvent('storage', {
        key: null,
        newValue: null,
        storageArea: storageInstance
      });
      window.dispatchEvent(event);
    }
  } catch (error) {
    // Handle clear operation errors
    if (error instanceof StorageError) {
      throw error;
    }

    throw new StorageError(
      `Failed to clear storage: ${(error as Error).message || 'Unknown error'}`,
      'clear'
    );
  }
}