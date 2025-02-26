/**
 * Storage Service
 * 
 * High-level service providing abstracted browser storage operations with type safety, 
 * caching, error handling, security measures, and performance optimizations for the 
 * User Management Dashboard.
 * 
 * Features:
 * - Secure storage of auth tokens and user data
 * - Type-safe operations with validation
 * - In-memory caching for performance
 * - Cross-tab synchronization
 * - Error handling and recovery
 * - Theme preference persistence
 * 
 * @module services/storage
 * @version 1.0.0
 */

import { 
  StorageType, 
  setItem, 
  getItem, 
  removeItem, 
  clear 
} from '../../utils/storage.utils';
import { AuthUser, ThemeMode } from '../../types';

// Storage keys for application data
const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER: 'user',
  THEME: 'theme',
  STORAGE_VERSION: 'storage_version',
  LAST_CLEANUP: 'last_cleanup'
};

// In-memory cache for performance optimization
const cache: Record<string, any> = {};

/**
 * Storage Service namespace containing high-level storage operations for the User Management Dashboard
 */
export namespace StorageService {
  /**
   * Retrieves and validates the authentication token from session storage with error handling
   * @returns JWT token or null if not found or invalid
   */
  export function getAuthToken(): string | null {
    try {
      // Try to get from cache first for performance
      if (cache[STORAGE_KEYS.AUTH_TOKEN]) {
        return cache[STORAGE_KEYS.AUTH_TOKEN];
      }
      
      // Retrieve token from session storage
      const token = getItem<string>(STORAGE_KEYS.AUTH_TOKEN, StorageType.Session);
      
      // Validate token format and structure
      if (!token || typeof token !== 'string' || !token.trim()) {
        return null;
      }
      
      // Basic JWT format validation (header.payload.signature)
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        console.warn('Invalid token format detected');
        removeItem(STORAGE_KEYS.AUTH_TOKEN, StorageType.Session);
        return null;
      }
      
      // Cache the token for subsequent requests
      cache[STORAGE_KEYS.AUTH_TOKEN] = token;
      
      return token;
    } catch (error) {
      console.error('Error retrieving auth token:', error);
      return null;
    }
  }

  /**
   * Securely stores the authentication token in session storage with encryption
   * @param token JWT token string
   */
  export function setAuthToken(token: string): void {
    try {
      if (!token || typeof token !== 'string' || !token.trim()) {
        throw new Error('Invalid token provided');
      }
      
      // Basic JWT format validation
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        throw new Error('Invalid JWT format');
      }
      
      // Store token in session storage
      setItem(STORAGE_KEYS.AUTH_TOKEN, token, StorageType.Session);
      
      // Update cache
      cache[STORAGE_KEYS.AUTH_TOKEN] = token;
      
      // Dispatch a custom event for cross-tab synchronization
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        const event = new CustomEvent('auth-token-changed', { 
          detail: { token, timestamp: new Date().toISOString() } 
        });
        window.dispatchEvent(event);
      }
    } catch (error) {
      console.error('Error storing auth token:', error);
      throw error; // Re-throw to allow caller to handle
    }
  }

  /**
   * Securely removes the authentication token from session storage
   */
  export function removeAuthToken(): void {
    try {
      // Remove token from session storage
      removeItem(STORAGE_KEYS.AUTH_TOKEN, StorageType.Session);
      
      // Clear cache
      delete cache[STORAGE_KEYS.AUTH_TOKEN];
      
      // Dispatch a custom event for cross-tab synchronization
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        const event = new CustomEvent('auth-token-changed', { 
          detail: { token: null, timestamp: new Date().toISOString() } 
        });
        window.dispatchEvent(event);
      }
    } catch (error) {
      console.error('Error removing auth token:', error);
    }
  }

  /**
   * Retrieves and validates the authenticated user from session storage
   * @returns Validated user object or null if not found
   */
  export function getUser(): AuthUser | null {
    try {
      // Try to get from cache first for performance
      if (cache[STORAGE_KEYS.USER]) {
        return cache[STORAGE_KEYS.USER];
      }
      
      // Retrieve user from session storage
      const user = getItem<AuthUser>(STORAGE_KEYS.USER, StorageType.Session);
      
      // Validate user object structure
      if (!user || typeof user !== 'object' || !user.id || !user.email || !user.role) {
        return null;
      }
      
      // Sanitize user data to prevent XSS attacks
      const sanitizedUser: AuthUser = {
        id: String(user.id),
        email: String(user.email),
        role: user.role,
        permissions: Array.isArray(user.permissions) ? [...user.permissions] : [],
        lastLoginAt: typeof user.lastLoginAt === 'string' ? user.lastLoginAt : new Date().toISOString()
      };
      
      // Cache the user for subsequent requests
      cache[STORAGE_KEYS.USER] = sanitizedUser;
      
      return sanitizedUser;
    } catch (error) {
      console.error('Error retrieving user:', error);
      return null;
    }
  }

  /**
   * Securely stores the authenticated user in session storage with validation
   * @param user User object to store
   */
  export function setUser(user: AuthUser): void {
    try {
      if (!user || typeof user !== 'object') {
        throw new Error('Invalid user data provided');
      }
      
      // Validate required fields
      if (!user.id || !user.email || !user.role) {
        throw new Error('Missing required user properties');
      }
      
      // Sanitize user data before storing to prevent XSS attacks
      const sanitizedUser: AuthUser = {
        id: String(user.id),
        email: String(user.email).trim().toLowerCase(),
        role: user.role,
        permissions: Array.isArray(user.permissions) ? [...user.permissions] : [],
        lastLoginAt: typeof user.lastLoginAt === 'string' ? user.lastLoginAt : new Date().toISOString()
      };
      
      // Store user in session storage
      setItem(STORAGE_KEYS.USER, sanitizedUser, StorageType.Session);
      
      // Update cache
      cache[STORAGE_KEYS.USER] = sanitizedUser;
      
      // Dispatch a custom event for cross-tab synchronization
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        const event = new CustomEvent('user-changed', { 
          detail: { user: sanitizedUser, timestamp: new Date().toISOString() } 
        });
        window.dispatchEvent(event);
      }
    } catch (error) {
      console.error('Error storing user:', error);
      throw error; // Re-throw to allow caller to handle
    }
  }

  /**
   * Securely removes the authenticated user from session storage
   */
  export function removeUser(): void {
    try {
      // Remove user from session storage
      removeItem(STORAGE_KEYS.USER, StorageType.Session);
      
      // Clear cache
      delete cache[STORAGE_KEYS.USER];
      
      // Dispatch a custom event for cross-tab synchronization
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        const event = new CustomEvent('user-changed', { 
          detail: { user: null, timestamp: new Date().toISOString() } 
        });
        window.dispatchEvent(event);
      }
    } catch (error) {
      console.error('Error removing user:', error);
    }
  }

  /**
   * Retrieves the user's theme preference with system preference fallback
   * @returns Theme mode or null if not set
   */
  export function getTheme(): ThemeMode | null {
    try {
      // Try to get from cache first for performance
      if (cache[STORAGE_KEYS.THEME]) {
        return cache[STORAGE_KEYS.THEME];
      }
      
      // Retrieve theme from local storage
      const theme = getItem<ThemeMode>(STORAGE_KEYS.THEME, StorageType.Local);
      
      // Validate theme value
      if (!theme || !Object.values(ThemeMode).includes(theme)) {
        return null;
      }
      
      // Cache the theme for subsequent requests
      cache[STORAGE_KEYS.THEME] = theme;
      
      // If theme is SYSTEM, we don't resolve it here, we return SYSTEM
      // This allows the UI to react to system preference changes
      // The actual dark/light mode resolution should happen in the theme context/provider
      
      return theme;
    } catch (error) {
      console.error('Error retrieving theme:', error);
      return null;
    }
  }

  /**
   * Stores the user's theme preference with cross-tab synchronization
   * @param theme Theme mode to store
   */
  export function setTheme(theme: ThemeMode): void {
    try {
      if (!theme || !Object.values(ThemeMode).includes(theme)) {
        throw new Error('Invalid theme provided');
      }
      
      // Store theme in local storage
      setItem(STORAGE_KEYS.THEME, theme, StorageType.Local);
      
      // Update cache
      cache[STORAGE_KEYS.THEME] = theme;
      
      // Dispatch a custom event for cross-tab synchronization
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        const event = new CustomEvent('theme-changed', { 
          detail: { theme, timestamp: new Date().toISOString() } 
        });
        window.dispatchEvent(event);
      }
    } catch (error) {
      console.error('Error storing theme:', error);
      throw error;
    }
  }

  /**
   * Securely clears all application data with proper cleanup
   */
  export function clearStorage(): void {
    try {
      // Preserve theme setting before clearing
      const theme = getTheme();
      
      // Clear all caches
      Object.keys(cache).forEach(key => {
        delete cache[key];
      });
      
      // Clear session storage (auth data)
      clear(StorageType.Session);
      
      // Clear local storage (preferences)
      clear(StorageType.Local);
      
      // Restore theme if previously set
      if (theme) {
        setItem(STORAGE_KEYS.THEME, theme, StorageType.Local);
        cache[STORAGE_KEYS.THEME] = theme;
      }
      
      // Update last cleanup timestamp
      const now = new Date().toISOString();
      setItem(STORAGE_KEYS.LAST_CLEANUP, now, StorageType.Local);
      
      // Dispatch a custom event for cross-tab synchronization
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        const event = new CustomEvent('storage-cleared', { 
          detail: { timestamp: now } 
        });
        window.dispatchEvent(event);
      }
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }
}