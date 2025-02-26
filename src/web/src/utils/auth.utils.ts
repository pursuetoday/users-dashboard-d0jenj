/**
 * @module utils/auth
 * Utility functions for authentication operations including token management,
 * role validation, and authentication state helpers.
 * 
 * Implements security best practices for JWT handling, role-based access control,
 * and secure token storage with comprehensive error handling.
 */

import jwtDecode from 'jwt-decode'; // ^3.1.2
import { AuthUser, UserRole } from '../types/auth.types';
import { StorageType, setItem, getItem, removeItem } from './storage.utils';

// Constants for token storage
export const ACCESS_TOKEN_KEY = 'access_token';
export const REFRESH_TOKEN_KEY = 'refresh_token';
// Buffer time (in seconds) before token expiry to preemptively refresh (5 minutes)
export const TOKEN_EXPIRY_BUFFER = 300;

// Interface for decoded JWT token payload
interface JwtPayload {
  exp?: number;
  sub?: string;
  role?: string;
  iat?: number;
  [key: string]: unknown;
}

// Cache for token values to reduce storage access
let tokenCache = {
  accessToken: null as string | null,
  refreshToken: null as string | null,
  roleCache: new Map<string, boolean>(),
  adminCache: null as boolean | null
};

/**
 * Validates JWT token format with basic structural checks
 * @param token Token to validate
 * @returns True if token has valid JWT format, false otherwise
 */
function isValidJwtFormat(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  
  // JWT should have 3 parts separated by dots
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  
  // Each part should be base64url encoded
  const base64UrlRegex = /^[A-Za-z0-9_-]+$/;
  return parts.every(part => base64UrlRegex.test(part));
}

/**
 * Helper function to dispatch auth-related events
 * @param eventName Name of the event to dispatch
 */
function dispatchAuthEvent(eventName: string): void {
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    const event = new CustomEvent(eventName);
    window.dispatchEvent(event);
  }
}

/**
 * Securely retrieves and validates the access token from storage
 * @returns Valid access token if exists and not expired, null otherwise
 */
export function getAccessToken(): string | null {
  try {
    // Return from cache if available and valid
    if (tokenCache.accessToken && !isTokenExpired(tokenCache.accessToken)) {
      return tokenCache.accessToken;
    }
    
    // Clear invalid cached token
    tokenCache.accessToken = null;

    // Retrieve token from secure storage
    const token = getItem<string>(ACCESS_TOKEN_KEY, StorageType.Local);
    
    // Validate token and update cache if valid
    if (token && !isTokenExpired(token)) {
      tokenCache.accessToken = token;
      return token;
    }
    
    return null;
  } catch (error) {
    console.error('Error retrieving access token:', error);
    tokenCache.accessToken = null;
    return null;
  }
}

/**
 * Securely retrieves and validates the refresh token from storage
 * @returns Valid refresh token if exists and not expired, null otherwise
 */
export function getRefreshToken(): string | null {
  try {
    // Return from cache if available and valid
    if (tokenCache.refreshToken && !isTokenExpired(tokenCache.refreshToken)) {
      return tokenCache.refreshToken;
    }
    
    // Clear invalid cached token
    tokenCache.refreshToken = null;

    // Retrieve token from secure storage
    const token = getItem<string>(REFRESH_TOKEN_KEY, StorageType.Local);
    
    // Validate token and update cache if valid
    if (token && !isTokenExpired(token)) {
      tokenCache.refreshToken = token;
      return token;
    }
    
    return null;
  } catch (error) {
    console.error('Error retrieving refresh token:', error);
    tokenCache.refreshToken = null;
    return null;
  }
}

/**
 * Checks if a JWT token is expired with additional security validations
 * @param token JWT token to validate
 * @returns True if token is expired or invalid, false if valid
 */
export function isTokenExpired(token: string): boolean {
  try {
    // Validate token format
    if (!isValidJwtFormat(token)) {
      return true;
    }
    
    // Decode token to get payload
    const decoded = jwtDecode<JwtPayload>(token);
    
    // Check required claims
    if (!decoded.exp) {
      console.warn('Token has no expiration claim');
      return true;
    }
    
    // Validate token age (max 90 days)
    if (decoded.iat) {
      const currentTime = Math.floor(Date.now() / 1000);
      const maxTokenAge = 60 * 60 * 24 * 90; // 90 days in seconds
      
      if (currentTime - decoded.iat > maxTokenAge) {
        console.warn('Token exceeds maximum allowed age');
        return true;
      }
    }
    
    // Check if token is expired with buffer time for preemptive refresh
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < (currentTime + TOKEN_EXPIRY_BUFFER);
  } catch (error) {
    console.error('Error validating token expiration:', error);
    return true;
  }
}

/**
 * Securely stores both access and refresh tokens with encryption
 * @param accessToken JWT access token
 * @param refreshToken JWT refresh token
 * @throws Error if token format is invalid or storage fails
 */
export function setTokens(accessToken: string, refreshToken: string): void {
  try {
    // Validate tokens
    if (!isValidJwtFormat(accessToken)) {
      throw new Error('Invalid access token format');
    }
    
    if (!isValidJwtFormat(refreshToken)) {
      throw new Error('Invalid refresh token format');
    }
    
    // Try to decode tokens to ensure they are valid JWTs
    try {
      const decodedAccess = jwtDecode<JwtPayload>(accessToken);
      const decodedRefresh = jwtDecode<JwtPayload>(refreshToken);
      
      // Ensure tokens have required claims
      if (!decodedAccess.exp || !decodedAccess.sub) {
        throw new Error('Access token missing required claims');
      }
      
      if (!decodedRefresh.exp || !decodedRefresh.sub) {
        throw new Error('Refresh token missing required claims');
      }
    } catch (decodeError) {
      throw new Error(`Invalid token structure: ${(decodeError as Error).message}`);
    }
    
    // Store tokens in secure storage
    setItem(ACCESS_TOKEN_KEY, accessToken, StorageType.Local);
    setItem(REFRESH_TOKEN_KEY, refreshToken, StorageType.Local);
    
    // Update token cache
    tokenCache.accessToken = accessToken;
    tokenCache.refreshToken = refreshToken;
    
    // Reset role validation cache when tokens change
    tokenCache.roleCache.clear();
    tokenCache.adminCache = null;
    
    // Dispatch token update event
    dispatchAuthEvent('auth:tokensUpdated');
  } catch (error) {
    console.error('Error storing authentication tokens:', error);
    // Reset cache on error to maintain consistency
    tokenCache.accessToken = null;
    tokenCache.refreshToken = null;
    
    throw new Error(`Failed to store authentication tokens: ${(error as Error).message}`);
  }
}

/**
 * Securely removes both tokens and cleans up related storage
 */
export function removeTokens(): void {
  try {
    // Remove tokens from secure storage
    removeItem(ACCESS_TOKEN_KEY, StorageType.Local);
    removeItem(REFRESH_TOKEN_KEY, StorageType.Local);
    
    // Clear token cache
    tokenCache = {
      accessToken: null,
      refreshToken: null,
      roleCache: new Map(),
      adminCache: null
    };
    
    // Dispatch token removal event
    dispatchAuthEvent('auth:tokensRemoved');
  } catch (error) {
    console.error('Error removing authentication tokens:', error);
    // Fallback: direct removal using localStorage if available
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    } catch (backupError) {
      console.error('Backup token removal also failed:', backupError);
    }
    
    // Reset cache regardless of errors
    tokenCache = {
      accessToken: null,
      refreshToken: null,
      roleCache: new Map(),
      adminCache: null
    };
  }
}

/**
 * Role hierarchy map for determining if a role has sufficient permissions
 * Higher index in the array means higher permission level
 */
const roleHierarchy: Record<UserRole, number> = {
  [UserRole.GUEST]: 0,
  [UserRole.USER]: 1,
  [UserRole.MANAGER]: 2,
  [UserRole.ADMIN]: 3
};

/**
 * Validates if a user has a specific role with role hierarchy support
 * @param user User object to validate
 * @param role Required role
 * @returns True if user has required role or higher, false otherwise
 */
export function hasRole(user: AuthUser | null, role: UserRole): boolean {
  try {
    // User must exist and have a valid role
    if (!user || !user.role) {
      return false;
    }
    
    // Validate roles exist in hierarchy
    if (!(user.role in roleHierarchy) || !(role in roleHierarchy)) {
      console.warn('Unknown role detected:', user.role, role);
      return false;
    }
    
    // Check cached result if available
    const cacheKey = `${user.id}:${role}`;
    if (tokenCache.roleCache.has(cacheKey)) {
      return tokenCache.roleCache.get(cacheKey) || false;
    }
    
    // Get role hierarchy levels
    const userRoleLevel = roleHierarchy[user.role];
    const requiredRoleLevel = roleHierarchy[role];
    
    // User role must be at or above the required role level
    const hasRequiredRole = userRoleLevel >= requiredRoleLevel;
    
    // Cache the result
    tokenCache.roleCache.set(cacheKey, hasRequiredRole);
    
    return hasRequiredRole;
  } catch (error) {
    console.error('Error validating user role:', error);
    return false;
  }
}

/**
 * Checks if a user has admin role with enhanced validation
 * @param user User to validate
 * @returns True if user has admin privileges, false otherwise
 */
export function isAdmin(user: AuthUser | null): boolean {
  // User must exist to be an admin
  if (!user) {
    return false;
  }
  
  // Return cached result if available
  if (user.id && tokenCache.adminCache !== null) {
    return tokenCache.adminCache;
  }
  
  // Check if user has admin role
  const result = hasRole(user, UserRole.ADMIN);
  
  // Cache the result
  tokenCache.adminCache = result;
  
  return result;
}